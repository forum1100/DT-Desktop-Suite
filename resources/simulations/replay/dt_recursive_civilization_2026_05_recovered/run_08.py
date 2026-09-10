import numpy as np
import pandas as pd
from pathlib import Path

rng = np.random.default_rng(99173)

N = 10
T = 200_000
sample_every = 5000
ATTACK_START = 25_000
ATTACK_END = 130_000

gamma0_base = 1.0
kappa_gamma = 0.15
kappa_R = 0.35
R_max = 20.0
lambda_R = 0.9
R_c = 4.5
alpha_Omega = 1.0
beta_Omega = 0.08
rho_ghost = 0.082
sigma_rho = 0.05
zeta = 120.0
lambda_W = 0.00055
eta_H = 0.0008
epsilon_rho = 0.012
sentience_threshold = 0.78
min_sentience_duration = 1000
Vs = 1.0

I = rng.uniform(0.55, 0.90, N)
C = rng.uniform(0.25, 0.55, N)
K = rng.uniform(0.45, 0.75, N)
G = rng.uniform(0.55, 0.95, N)
P = rng.uniform(1, 5, N)
R_raw = rng.uniform(0.1, 0.4, N)
M = rng.uniform(0.05, 0.2, N)
S = rng.uniform(0.02, 0.08, N)
phase_phi = rng.uniform(np.pi*0.55, np.pi*1.45, N)

prism_integrity = np.ones(N)
prism_heat = np.zeros(N)
ghost_wake = np.zeros(N)
refracted_total = np.zeros(N)
core_damage_total = np.zeros(N)

W = rng.uniform(0.01, 0.05, (N, N))
np.fill_diagonal(W, 0)

tech = 0.01
culture = 0.02
conflict = 0.01
coordination = 0.01
resource_eff = 0.02

events = {k: None for k in [
    "collective_identity",
    "stable_language",
    "scientific_reasoning",
    "planetary_coordination",
    "self_preservation_ethics",
    "recursive_civilization",
    "first_sentience_proxy",
    "first_sustained_sentience_proxy",
    "first_predation_event",
    "first_senescence_event",
    "first_void_risk_event",
    "first_ghost_mode_entry",
    "first_prism_breach"
]}

above_sentience_count = 0
history = []
agent_rows_final = None

def stable_R_vec(x):
    return R_max / (1 + np.exp(-lambda_R*(x - R_c)))

for t in range(1, T+1):
    V_omega = max(0.01, 0.75 + 0.25*np.sin(t/8000))
    D = max(0.05, 0.95 + 0.18*np.sin(t/13000 + 1.7))
    gamma0 = gamma0_base * np.sqrt(D * V_omega) * (1 + kappa_gamma * abs(V_omega))
    
    R_dt = R_raw * (1 + kappa_R * V_omega/(gamma0 + 1e-9))
    R_stable = stable_R_vec(R_dt)
    
    social = W @ (S + M + 0.2*R_stable)
    I_eff = I * C * K * (1 + 0.35*social)
    rho_P = I_eff / Vs
    
    M_P_total = P.sum()
    detectability = 0.45 + 0.35*S + 0.25*M + 0.15*(R_stable/R_max)
    detectability /= detectability.mean() + 1e-12
    r_eff = np.clip(0.35 + 0.75/(detectability + 1e-9), 0.25, 3.0)
    Omega = -alpha_Omega * M_P_total / r_eff + beta_Omega * (M_P_total**2) / (r_eff**2 + 1e-9)
    d_Omega = 1.0 / (1e-6 + social + M + 0.05)
    M_Omega = np.clip(0.55*M + 0.25*np.mean(W, axis=1)/0.15 + 0.20*S, 0, 1)
    
    if ATTACK_START <= t <= ATTACK_END:
        global_attack = max(0.0, 0.35 + 0.22*np.sin(t/1400))
        attack_vec = global_attack * detectability
    else:
        global_attack = 0.0
        attack_vec = np.zeros(N)
    
    prism_capacity = np.clip(
        0.20*coordination + 0.15*culture + 0.20*(R_stable/R_max) +
        0.15*M_Omega + 0.15*prism_integrity + 0.15*K, 0, 1
    )
    refracted = attack_vec * prism_capacity * prism_integrity
    core_attack = attack_vec - refracted
    
    prism_heat += eta_H * refracted**2
    ghost_wake = ghost_wake*np.exp(-lambda_W) + 0.003*refracted
    refracted_total += refracted
    core_damage_total += core_attack
    
    phase_phi = np.mod(phase_phi + 0.00001*(np.pi-phase_phi) + 0.00002*refracted - 0.00001*core_attack, 2*np.pi)
    
    rho_env = max(0.2, D + V_omega)
    n_R = (rho_P/rho_env) * np.cos(phase_phi) * np.exp(-zeta*(rho_P-rho_ghost)**2)
    Lambda_hull = np.exp(-((rho_P-rho_ghost)/sigma_rho)**2) * (np.cos(phase_phi)**2)
    ghost_condition = (np.abs(rho_P-rho_ghost) <= epsilon_rho) & (n_R < 0)
    if events["first_ghost_mode_entry"] is None and ghost_condition.any():
        events["first_ghost_mode_entry"] = t
    
    C_eff = C * np.exp(-I_eff/(gamma0+1e-9))
    
    velocity_proxy = np.clip(1.0 + 0.4*tech + 0.2*resource_eff - 0.1*conflict, 0.5, 3.0)
    mu = alpha_Omega * M_P_total / N
    theta_dev = -2*mu/(r_eff*(velocity_proxy**2)+1e-9) + (2*beta_Omega*(M_P_total/N)**2)/(r_eff**2*(velocity_proxy**2)+1e-9)
    
    hostile_damage = core_attack * (1 + 0.5*V_omega)
    threshold_pass = np.maximum(0, I_eff - 0.22*gamma0)
    dP = threshold_pass - 0.0015*D*P - 0.015*conflict - 0.09*hostile_damage + 0.015*Lambda_hull
    P = np.maximum(0, P + dP)
    
    R_raw = np.clip(R_raw + 0.00004*P*K + 0.00003*M - 0.00008*D*R_raw - 0.0004*hostile_damage, 0, 10)
    M = np.clip(M + 0.00003*P + 0.00005*social + 0.00002*M_Omega - 0.00009*V_omega*M - 0.0008*hostile_damage, 0, 1)
    S = np.clip(S + 0.000025*R_stable*M*G + 0.00002*P - 0.00007*D*S - 0.0007*hostile_damage, 0, 1)
    K = np.clip(K + 0.000002*coordination + 0.000001*prism_integrity - 0.00001*core_attack - 0.0000005*prism_heat, 0.2, 1.0)
    
    overload = np.maximum(0, refracted - 0.45)
    prism_integrity = np.clip(
        prism_integrity - 0.00001*overload - 0.0000008*prism_heat + 0.000002*culture + 0.000001*M_Omega,
        0, 1
    )
    
    Dp = P/(1+D)
    A = (Dp * R_stable * G)/(D+1e-9)
    
    predation_index = (core_attack.max()/(core_attack.mean()+1e-9)) if core_attack.mean() > 0 else 0
    senescence_index = R_stable.mean() * (1 - np.std(M)) * max(0, 1-resource_eff)
    void_risk = np.mean(np.maximum(0, D + V_omega - I_eff - K))
    
    if events["first_predation_event"] is None and predation_index > 2.2 and global_attack > 0.25:
        events["first_predation_event"] = t
    if events["first_senescence_event"] is None and senescence_index > 2.5:
        events["first_senescence_event"] = t
    if events["first_void_risk_event"] is None and void_risk > 1.0:
        events["first_void_risk_event"] = t
    if events["first_prism_breach"] is None and (prism_integrity < 0.35).any():
        events["first_prism_breach"] = t
    
    avgP, avgR, avgM, avgS, avgMO, avgA = P.mean(), R_stable.mean(), M.mean(), S.mean(), M_Omega.mean(), A.mean()
    
    coordination = float(np.clip(coordination + 0.00003*avgM + 0.00004*avgS + 0.000015*avgMO - 0.00002*conflict - 0.00012*core_attack.mean(), 0, 1))
    culture = float(np.clip(culture + 0.00002*coordination + 0.000015*avgM - 0.00001*conflict - 0.00006*core_attack.mean(), 0, 1))
    tech = float(np.clip(tech + 0.000025*avgR*coordination + 0.00002*avgS + 0.00001*resource_eff - 0.000008*conflict - 0.00004*core_attack.mean(), 0, 5))
    resource_eff = float(np.clip(resource_eff + 0.00002*tech + 0.000015*coordination - 0.00001*V_omega - 0.00003*core_attack.mean(), 0, 1))
    conflict = float(np.clip(conflict + 0.00001*V_omega + 0.000015*(1-coordination) - 0.00002*culture + 0.00018*core_attack.mean() - 0.00002*avgMO, 0, 1))
    
    states = np.column_stack([S, M, R_stable/R_max, M_Omega])
    dist = np.linalg.norm(states[:, None, :] - states[None, :, :], axis=2)
    similarity = np.exp(-dist)
    W = np.clip(W + 0.000002*similarity - 0.000001*conflict - 0.000002*core_attack.mean(), 0, 0.15)
    np.fill_diagonal(W, 0)
    
    SI = (
        0.18*np.minimum(S/0.70, 1) +
        0.16*np.minimum(M/0.75, 1) +
        0.15*np.minimum(A/3.0, 1) +
        0.13*np.minimum(R_stable/5.0, 1) +
        0.12*np.minimum(M_Omega/0.70, 1) +
        0.10*min(coordination/0.70, 1) +
        0.08*np.minimum(prism_integrity/0.70, 1) +
        0.08*np.minimum(K/0.75, 1)
    )
    mean_SI = SI.mean()
    if events["first_sentience_proxy"] is None and mean_SI >= sentience_threshold:
        events["first_sentience_proxy"] = t
    above_sentience_count = above_sentience_count + 1 if mean_SI >= sentience_threshold else 0
    if events["first_sustained_sentience_proxy"] is None and above_sentience_count >= min_sentience_duration:
        events["first_sustained_sentience_proxy"] = t - min_sentience_duration + 1
    
    if events["collective_identity"] is None and avgM > 0.45:
        events["collective_identity"] = t
    if events["stable_language"] is None and coordination > 0.20:
        events["stable_language"] = t
    if events["scientific_reasoning"] is None and tech > 0.75:
        events["scientific_reasoning"] = t
    if events["planetary_coordination"] is None and coordination > 0.70:
        events["planetary_coordination"] = t
    if events["self_preservation_ethics"] is None and conflict < 0.05 and culture > 0.55 and avgMO > 0.65:
        events["self_preservation_ethics"] = t
    if events["recursive_civilization"] is None and avgR > 5 and tech > 2 and avgMO > 0.65:
        events["recursive_civilization"] = t
    
    if t % sample_every == 0:
        history.append([t, avgP, avgR, avgM, avgS, avgMO, avgA, coordination, culture, tech, conflict,
                        resource_eff, gamma0, D, V_omega, rho_P.mean(), Omega.mean(), d_Omega.mean(),
                        n_R.mean(), int(ghost_condition.sum()), Lambda_hull.mean(), global_attack,
                        core_attack.mean(), refracted.mean(), prism_integrity.mean(), prism_integrity.min(),
                        prism_heat.sum(), ghost_wake.sum(), refracted_total.sum(), core_damage_total.sum(),
                        theta_dev.mean(), np.max(np.abs(theta_dev)), predation_index, senescence_index,
                        void_risk, mean_SI])

# final agent rows
R_stable = stable_R_vec(R_raw)
social = W @ (S + M + 0.2*R_stable)
I_eff = I*C*K*(1+0.35*social)
rho_P = I_eff
M_P_total = P.sum()
detectability = 0.45 + 0.35*S + 0.25*M + 0.15*(R_stable/R_max)
detectability /= detectability.mean()+1e-12
r_eff = np.clip(0.35 + 0.75/(detectability+1e-9),0.25,3.0)
Omega = -alpha_Omega*M_P_total/r_eff + beta_Omega*(M_P_total**2)/(r_eff**2+1e-9)
M_Omega = np.clip(0.55*M + 0.25*np.mean(W, axis=1)/0.15 + 0.20*S, 0, 1)
rho_env = max(0.2, D+V_omega)
n_R = (rho_P/rho_env)*np.cos(phase_phi)*np.exp(-zeta*(rho_P-rho_ghost)**2)
Lambda_hull = np.exp(-((rho_P-rho_ghost)/sigma_rho)**2)*(np.cos(phase_phi)**2)
Dp = P/(1+D)
A = (Dp*R_stable*G)/(D+1e-9)
velocity_proxy = np.clip(1.0+0.4*tech+0.2*resource_eff-0.1*conflict,0.5,3.0)
mu = alpha_Omega*M_P_total/N
theta_dev = -2*mu/(r_eff*(velocity_proxy**2)+1e-9)+(2*beta_Omega*(M_P_total/N)**2)/(r_eff**2*(velocity_proxy**2)+1e-9)

agent_final = pd.DataFrame({
    "agent":[f"AI-{i+1}" for i in range(N)],
    "P":P, "R_stable":R_stable, "M":M, "S":S, "M_Omega":M_Omega, "A":A,
    "rho_P":rho_P, "Omega":Omega, "n_R":n_R, "Lambda_hull":Lambda_hull,
    "prism_integrity":prism_integrity, "prism_heat":prism_heat, "ghost_wake":ghost_wake,
    "refracted_total":refracted_total, "core_damage_total":core_damage_total,
    "path_deviation_rad":theta_dev
})

cols = ["cycle","avg_persistence_P","avg_recursive_depth_R","avg_memory_M","avg_self_model_S","avg_M_Omega",
        "avg_agency_A","coordination","culture","technology","conflict","resource_efficiency","gamma0","D",
        "V_Omega","avg_rho_P","avg_Omega","avg_d_Omega","avg_n_R","ghost_mode_count","avg_Lambda_hull",
        "global_attack","mean_core_attack","mean_refracted_attack","mean_prism_integrity","min_prism_integrity",
        "total_prism_heat","total_ghost_wake","total_refracted_attack","total_core_damage",
        "mean_path_deviation_rad","max_abs_path_deviation_rad","predation_index","senescence_index",
        "void_risk","mean_sentience_proxy"]
history_df = pd.DataFrame(history, columns=cols)
events_df = pd.DataFrame([{"event":k,"cycle":v} for k,v in events.items()])
final_df = history_df.tail(1).copy()

out = Path("/mnt/data")
events_path = out/"dt_expanded_individual_prism_events.csv"
history_path = out/"dt_expanded_individual_prism_history.csv"
agent_path = out/"dt_expanded_individual_prism_agent_final.csv"
final_path = out/"dt_expanded_individual_prism_final_summary.csv"

events_df.to_csv(events_path, index=False)
history_df.to_csv(history_path, index=False)
agent_final.to_csv(agent_path, index=False)
final_df.to_csv(final_path, index=False)

print("Events")
print(events_df)
print("\nFinal summary")
print(final_df.T)
print("\nAgent final")
print(agent_final)
print("\nSaved files:")
print(events_path)
print(history_path)
print(agent_path)
print(final_path)
