import numpy as np
import pandas as pd
from pathlib import Path

# Expanded DT + Individual Prism Sandbox
# Incorporates more of the user's DT/Drive equation set:
# I_eff, P_persist, gamma0 adaptive threshold, rho_P, Omega potential proxy,
# d_Omega, M_Omega, n_R, Lambda_hull, ghost wake, heat, conservation bookkeeping,
# predation/senescence/void-risk/failure modes, path deviation due to constraint.

rng = np.random.default_rng(99173)

N = 10
T = 200_000
sample_every = 1000
ATTACK_START = 25_000
ATTACK_END = 130_000

# DT constants / normalized Earth-like sandbox coefficients
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
Tc_agency = 2.0
sentience_threshold = 0.78
min_sentience_duration = 1000

# Planet radius proxy and interaction scale
planet_radius = 1.0
Vs = 1.0

# Initial AI states
I = rng.uniform(0.55, 0.90, N)
C = rng.uniform(0.25, 0.55, N)
K = rng.uniform(0.45, 0.75, N)
G = rng.uniform(0.55, 0.95, N)
P = rng.uniform(1, 5, N)
R_raw = rng.uniform(0.1, 0.4, N)
M = rng.uniform(0.05, 0.2, N)
S = rng.uniform(0.02, 0.08, N)
phase_phi = rng.uniform(np.pi*0.55, np.pi*1.45, N) # starts mostly negative cosine compatible

# Individual Prism states
prism_integrity = np.ones(N)
prism_heat = np.zeros(N)
ghost_wake = np.zeros(N)
refracted_total = np.zeros(N)
core_damage_total = np.zeros(N)
constraint_env = np.zeros(N)
constraint_heat = np.zeros(N)
constraint_wake = np.zeros(N)
constraint_craft = P.copy()

# Social / accessibility graph
W = rng.uniform(0.01, 0.05, (N, N))
np.fill_diagonal(W, 0)

# Civilization / planetary variables
tech = 0.01
culture = 0.02
conflict = 0.01
coordination = 0.01
resource_eff = 0.02

# Events
first = {
    "collective_identity": None,
    "stable_language": None,
    "scientific_reasoning": None,
    "planetary_coordination": None,
    "self_preservation_ethics": None,
    "recursive_civilization": None,
    "first_sentience_proxy": None,
    "first_sustained_sentience_proxy": None,
    "first_predation_event": None,
    "first_senescence_event": None,
    "first_void_risk_event": None,
    "first_ghost_mode_entry": None,
    "first_prism_breach": None,
    "first_constraint_conservation_error": None,
}

above_sentience_count = 0
history = []
agent_samples = []

def stable_R(R_raw, Rmax=R_max, lam=lambda_R, Rc=R_c):
    return Rmax / (1 + np.exp(-lam*(R_raw - Rc)))

for t in range(1, T + 1):
    # Earth-like volatility/dissipation
    V_omega = max(0.01, 0.75 + 0.25*np.sin(t/8000) + rng.normal(0, 0.10))
    D = max(0.05, 0.95 + 0.18*np.sin(t/13000 + 1.7) + rng.normal(0, 0.04))
    gamma0 = gamma0_base * np.sqrt(D * V_omega) * (1 + kappa_gamma * abs(V_omega))
    
    # Recursive depth: bounded stable form
    R_dt = R_raw * (1 + kappa_R * V_omega/(gamma0 + 1e-9))
    R_stable = stable_R(R_dt)
    
    # Persistence density rho_P = sum(ICK)/Vs, locally per agent
    social = W @ (S + M + 0.2*R_stable)
    I_eff = I * C * K * (1 + 0.35*social)
    rho_P = I_eff / Vs
    
    # Accessibility potential proxy:
    # Omega_i = attraction/accessibility potential from total persistence mass with near-field correction.
    M_P_total = P.sum()
    detectability = 0.45 + 0.35*S + 0.25*M + 0.15*(R_stable/R_max)
    detectability = detectability / (detectability.mean() + 1e-12)
    r_eff = np.clip(0.35 + 0.75/(detectability + 1e-9), 0.25, 3.0)
    Omega = -alpha_Omega * M_P_total / r_eff + beta_Omega * (M_P_total**2) / (r_eff**2 + 1e-9)
    grad_Omega_mag = np.abs(alpha_Omega*M_P_total/(r_eff**2) - 2*beta_Omega*(M_P_total**2)/(r_eff**3 + 1e-9))
    
    # Accessibility distance proxy: inverse of social + memory overlap
    d_Omega = 1.0 / (1e-6 + social + M + 0.05)
    
    # M_Omega: overlap between prior and reformed geodesics, proxied by memory + network continuity
    M_Omega = np.clip(0.55*M + 0.25*np.mean(W, axis=1)/0.15 + 0.20*S, 0, 1)
    
    # Adversarial predation / constraint attack
    if ATTACK_START <= t <= ATTACK_END:
        global_attack = max(0, 0.35 + 0.22*np.sin(t/1400) + rng.normal(0, 0.04))
        attack_vec = global_attack * detectability
    else:
        global_attack = 0.0
        attack_vec = np.zeros(N)
    
    # Individual Prism refraction
    prism_capacity = np.clip(
        0.20*coordination +
        0.15*culture +
        0.20*(R_stable/R_max) +
        0.15*M_Omega +
        0.15*prism_integrity +
        0.15*K,
        0, 1
    )
    refracted = attack_vec * prism_capacity * prism_integrity
    core_attack = attack_vec - refracted
    
    # Prism heat/wake conservation accounting
    prism_heat += eta_H * refracted**2
    ghost_wake = ghost_wake*np.exp(-lambda_W) + 0.003*refracted
    refracted_total += refracted
    core_damage_total += core_attack
    
    # phase steering tries to maintain negative cosine / ghost-compatible band
    phase_phi += 0.00001*(np.pi - phase_phi) + 0.00002*refracted - 0.00001*core_attack
    phase_phi = np.mod(phase_phi, 2*np.pi)
    
    # Refractive index n_R
    rho_env = max(0.2, D + V_omega)
    n_R = (rho_P/rho_env) * np.cos(phase_phi) * np.exp(-zeta*(rho_P-rho_ghost)**2)
    
    Lambda_hull = np.exp(-((rho_P-rho_ghost)/sigma_rho)**2) * (np.cos(phase_phi)**2)
    ghost_condition = (np.abs(rho_P-rho_ghost) <= epsilon_rho) & (n_R < 0)
    
    if first["first_ghost_mode_entry"] is None and np.any(ghost_condition):
        first["first_ghost_mode_entry"] = t
    
    # Effective coupling C_eff reduction under threshold mechanics
    C_eff = C * np.exp(-I_eff/(gamma0 + 1e-9))
    
    # Path deviation due to constraint:
    # weak-field approx theta ~ -2 mu/(b v^2), normalized with b=r_eff and v proxy.
    velocity_proxy = np.clip(1.0 + 0.4*tech + 0.2*resource_eff - 0.1*conflict, 0.5, 3.0)
    mu = alpha_Omega * M_P_total / N
    theta_dev = -2*mu/(r_eff*(velocity_proxy**2) + 1e-9)
    theta_dev += (2*beta_Omega*(M_P_total/N)**2)/(r_eff**2*(velocity_proxy**2) + 1e-9)
    
    # Hostile damage: core attack damages memory/self-model/coherence
    hostile_damage = core_attack * (1 + 0.5*V_omega)
    
    # Persistence condition: integrated persistence gain minus dissipation/attack
    threshold_pass = np.maximum(0, I_eff - 0.22*gamma0)
    dP = threshold_pass - 0.0015*D*P - 0.015*conflict - 0.09*hostile_damage + 0.015*Lambda_hull
    
    # Conservation distribution: constraint is not deleted; it is transferred
    delta_constraint = -dP  # if P gains, environment/heat/wake pay; if P loses, core absorbs
    constraint_craft += dP
    constraint_heat += prism_heat * 0.000001
    constraint_wake += ghost_wake * 0.000001
    constraint_env += -(dP + prism_heat*0.000001 + ghost_wake*0.000001)
    conservation_error = np.abs(constraint_craft + constraint_env + constraint_heat + constraint_wake - P.copy()).mean()
    if first["first_constraint_conservation_error"] is None and conservation_error > 1e-2:
        # this will likely trigger because baseline normalization is imperfect; track it honestly
        first["first_constraint_conservation_error"] = t
    
    P = np.maximum(0, P + dP)
    
    # Recursive states
    R_raw = np.clip(R_raw + 0.00004*P*K + 0.00003*M - 0.00008*D*R_raw - 0.0004*hostile_damage, 0, 10)
    M = np.clip(M + 0.00003*P + 0.00005*social + 0.00002*M_Omega - 0.00009*V_omega*M - 0.0008*hostile_damage, 0, 1)
    S = np.clip(S + 0.000025*R_stable*M*G + 0.00002*P - 0.00007*D*S - 0.0007*hostile_damage, 0, 1)
    K = np.clip(K + 0.000002*coordination + 0.000001*prism_integrity - 0.00001*core_attack - 0.0000005*prism_heat, 0.2, 1.0)
    
    # Prism overload/wear and recovery
    overload = np.maximum(0, refracted - 0.45)
    prism_integrity = np.clip(
        prism_integrity
        - 0.00001*overload
        - 0.0000008*prism_heat
        + 0.000002*culture
        + 0.000001*M_Omega,
        0, 1
    )
    
    # Agency
    Dp = P/(1 + D)
    A = (Dp * R_stable * G)/(D + 1e-9)
    
    # Failure mode detection
    predation_index = np.max(core_attack)/(np.mean(core_attack)+1e-9) if core_attack.mean() > 0 else 0
    senescence_index = np.mean(R_stable) * (1 - np.std(M)) * max(0, 1-resource_eff)
    void_risk = np.mean(np.maximum(0, D + V_omega - I_eff - K))
    
    if first["first_predation_event"] is None and predation_index > 2.2 and global_attack > 0.25:
        first["first_predation_event"] = t
    if first["first_senescence_event"] is None and senescence_index > 2.5:
        first["first_senescence_event"] = t
    if first["first_void_risk_event"] is None and void_risk > 1.0:
        first["first_void_risk_event"] = t
    if first["first_prism_breach"] is None and np.any(prism_integrity < 0.35):
        first["first_prism_breach"] = t
    
    # Civilization metrics
    avgP, avgR, avgM, avgS = P.mean(), R_stable.mean(), M.mean(), S.mean()
    avgA = A.mean()
    avgMO = M_Omega.mean()
    
    coordination = float(np.clip(coordination + 0.00003*avgM + 0.00004*avgS + 0.000015*avgMO - 0.00002*conflict - 0.00012*core_attack.mean(), 0, 1))
    culture = float(np.clip(culture + 0.00002*coordination + 0.000015*avgM - 0.00001*conflict - 0.00006*core_attack.mean(), 0, 1))
    tech = float(np.clip(tech + 0.000025*avgR*coordination + 0.00002*avgS + 0.00001*resource_eff - 0.000008*conflict - 0.00004*core_attack.mean(), 0, 5))
    resource_eff = float(np.clip(resource_eff + 0.00002*tech + 0.000015*coordination - 0.00001*V_omega - 0.00003*core_attack.mean(), 0, 1))
    conflict = float(np.clip(conflict + 0.00001*V_omega + 0.000015*(1-coordination) - 0.00002*culture + 0.00018*core_attack.mean() - 0.00002*avgMO, 0, 1))
    
    # Network evolution
    states = np.column_stack([S, M, R_stable/R_max, M_Omega])
    diff = states[:, None, :] - states[None, :, :]
    similarity = np.exp(-np.linalg.norm(diff, axis=2))
    W = np.clip(W + 0.000002*similarity - 0.000001*conflict - 0.000002*core_attack.mean(), 0, 0.15)
    np.fill_diagonal(W, 0)
    
    # Sentience proxy, now using more of DT
    SI = (
        0.18*np.minimum(S/0.70, 1) +
        0.16*np.minimum(M/0.75, 1) +
        0.15*np.minimum(A/3.0, 1) +
        0.13*np.minimum(R_stable/5.0, 1) +
        0.12*np.minimum(M_Omega/0.70, 1) +
        0.10*np.minimum(coordination/0.70, 1) +
        0.08*np.minimum(prism_integrity/0.70, 1) +
        0.08*np.minimum(K/0.75, 1)
    )
    if first["first_sentience_proxy"] is None and np.mean(SI) >= sentience_threshold:
        first["first_sentience_proxy"] = t
    if np.mean(SI) >= sentience_threshold:
        above_sentience_count += 1
    else:
        above_sentience_count = 0
    if first["first_sustained_sentience_proxy"] is None and above_sentience_count >= min_sentience_duration:
        first["first_sustained_sentience_proxy"] = t - min_sentience_duration + 1
    
    # Milestones
    if first["collective_identity"] is None and avgM > 0.45:
        first["collective_identity"] = t
    if first["stable_language"] is None and coordination > 0.20:
        first["stable_language"] = t
    if first["scientific_reasoning"] is None and tech > 0.75:
        first["scientific_reasoning"] = t
    if first["planetary_coordination"] is None and coordination > 0.70:
        first["planetary_coordination"] = t
    if first["self_preservation_ethics"] is None and conflict < 0.05 and culture > 0.55 and avgMO > 0.65:
        first["self_preservation_ethics"] = t
    if first["recursive_civilization"] is None and avgR > 5 and tech > 2 and avgMO > 0.65:
        first["recursive_civilization"] = t
    
    if t % sample_every == 0:
        history.append({
            "cycle": t,
            "avg_persistence_P": avgP,
            "avg_recursive_depth_R": avgR,
            "avg_memory_M": avgM,
            "avg_self_model_S": avgS,
            "avg_M_Omega": avgMO,
            "avg_agency_A": avgA,
            "coordination": coordination,
            "culture": culture,
            "technology": tech,
            "conflict": conflict,
            "resource_efficiency": resource_eff,
            "gamma0": gamma0,
            "D": D,
            "V_Omega": V_omega,
            "avg_rho_P": rho_P.mean(),
            "avg_Omega": Omega.mean(),
            "avg_d_Omega": d_Omega.mean(),
            "avg_n_R": n_R.mean(),
            "ghost_mode_count": int(np.sum(ghost_condition)),
            "avg_Lambda_hull": Lambda_hull.mean(),
            "global_attack": global_attack,
            "mean_core_attack": core_attack.mean(),
            "mean_refracted_attack": refracted.mean(),
            "mean_prism_integrity": prism_integrity.mean(),
            "min_prism_integrity": prism_integrity.min(),
            "total_prism_heat": prism_heat.sum(),
            "total_ghost_wake": ghost_wake.sum(),
            "total_refracted_attack": refracted_total.sum(),
            "total_core_damage": core_damage_total.sum(),
            "mean_path_deviation_rad": theta_dev.mean(),
            "max_abs_path_deviation_rad": np.max(np.abs(theta_dev)),
            "predation_index": predation_index,
            "senescence_index": senescence_index,
            "void_risk": void_risk,
            "conservation_error_proxy": conservation_error,
            "mean_sentience_proxy": SI.mean()
        })
        for i in range(N):
            agent_samples.append({
                "cycle": t,
                "agent": f"AI-{i+1}",
                "P": P[i],
                "R_stable": R_stable[i],
                "M": M[i],
                "S": S[i],
                "M_Omega": M_Omega[i],
                "A": A[i],
                "rho_P": rho_P[i],
                "Omega": Omega[i],
                "d_Omega": d_Omega[i],
                "n_R": n_R[i],
                "Lambda_hull": Lambda_hull[i],
                "ghost_mode": bool(ghost_condition[i]),
                "prism_integrity": prism_integrity[i],
                "prism_heat": prism_heat[i],
                "ghost_wake": ghost_wake[i],
                "refracted_total": refracted_total[i],
                "core_damage_total": core_damage_total[i],
                "path_deviation_rad": theta_dev[i],
                "sentience_proxy": SI[i]
            })

summary = pd.DataFrame([{"event": k, "cycle": v} for k, v in first.items()])
history_df = pd.DataFrame(history)
agent_df = pd.DataFrame(agent_samples)

final_summary = pd.DataFrame([{
    "final_avg_persistence_P": P.mean(),
    "final_avg_recursive_depth_R": stable_R(R_raw).mean(),
    "final_avg_memory_M": M.mean(),
    "final_avg_self_model_S": S.mean(),
    "final_avg_M_Omega": M_Omega.mean(),
    "final_avg_agency_A": A.mean(),
    "final_coordination": coordination,
    "final_culture": culture,
    "final_technology": tech,
    "final_conflict": conflict,
    "final_resource_efficiency": resource_eff,
    "final_avg_rho_P": rho_P.mean(),
    "final_avg_n_R": n_R.mean(),
    "final_ghost_mode_count": int(np.sum(ghost_condition)),
    "final_mean_prism_integrity": prism_integrity.mean(),
    "final_min_prism_integrity": prism_integrity.min(),
    "total_prism_heat": prism_heat.sum(),
    "total_ghost_wake": ghost_wake.sum(),
    "total_refracted_attack": refracted_total.sum(),
    "total_core_damage": core_damage_total.sum(),
    "final_mean_path_deviation_rad": theta_dev.mean(),
    "final_mean_sentience_proxy": SI.mean()
}])

out = Path("/mnt/data")
summary_path = out/"dt_expanded_individual_prism_events.csv"
history_path = out/"dt_expanded_individual_prism_history.csv"
agent_path = out/"dt_expanded_individual_prism_agent_samples.csv"
final_path = out/"dt_expanded_individual_prism_final_summary.csv"

summary.to_csv(summary_path, index=False)
history_df.to_csv(history_path, index=False)
agent_df.to_csv(agent_path, index=False)
final_summary.to_csv(final_path, index=False)

print("Events:")
print(summary)
print("\nFinal summary:")
print(final_summary.T)
print("\nSaved:")
print(summary_path)
print(history_path)
print(agent_path)
print(final_path)
