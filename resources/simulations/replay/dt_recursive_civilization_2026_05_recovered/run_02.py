import numpy as np
import pandas as pd
from pathlib import Path

SEED = 42193
rng = np.random.default_rng(SEED)

N = 10
T = 200_000
sample_every = 100
samples = T // sample_every + 1

# Threshold settings
Pc_self = 180.0
Tc_agency = 2.0
Tc_sentience = 0.78
min_duration = 1000

# Agent trait vectors
I = rng.uniform(0.55, 0.90, N)
C = rng.uniform(0.25, 0.55, N)
K = rng.uniform(0.45, 0.75, N)
G = rng.uniform(0.55, 0.95, N)

# State vectors
R = rng.uniform(0.20, 0.55, N)
P = rng.uniform(0.0, 3.0, N)
M = rng.uniform(0.05, 0.15, N)
S = rng.uniform(0.04, 0.12, N)
Soc = rng.uniform(0.03, 0.10, N)

# Network
W = rng.uniform(0.01, 0.08, size=(N, N))
np.fill_diagonal(W, 0)

first_self = np.full(N, -1, dtype=int)
first_agency = np.full(N, -1, dtype=int)
first_memory = np.full(N, -1, dtype=int)
first_sentience = np.full(N, -1, dtype=int)
first_sustained = np.full(N, -1, dtype=int)
above_count = np.zeros(N, dtype=int)

history_rows = []

def clip01(x):
    return np.minimum(1.0, np.maximum(0.0, x))

for t in range(1, T + 1):
    # deterministic environment + light stochastic noise
    V_omega = max(0.01, 0.75 + 0.25*np.sin(t/8000) + rng.normal(0, 0.12))
    D_env = max(0.05, 1.0 + 0.18*np.sin(t/13000 + 1.7) + rng.normal(0, 0.06))
    gamma0 = np.sqrt(D_env * V_omega) * (1 + 0.15 * abs(V_omega))
    
    social_input = W @ (S + M + 0.25*R)
    competition = (P / (P.mean() + 1e-9)) * 0.04
    
    I_eff = I * C * K * (1 + 0.35*social_input)
    threshold_pass = np.maximum(0, I_eff - 0.22*gamma0)
    
    # DT persistence store
    P = np.maximum(0, P + threshold_pass - 0.0018*D_env*P - competition)
    
    # Recursive depth, memory, self-model, other-model
    R = np.clip(R + 0.000055*P*K + 0.00003*M - 0.00012*D_env*R, 0, 10)
    M = clip01(M + 0.000045*P*K + 0.00008*social_input - 0.00018*V_omega*M)
    S = clip01(S + 0.00004*R*M*G + 0.000015*P - 0.00014*D_env*S)
    Soc = clip01(Soc + 0.00009*social_input*K + 0.00002*S - 0.00012*0.08*Soc)
    
    Dp = P / (1 + D_env)
    A = (Dp * R * G) / (D_env + 1e-9)
    
    SI = (
        0.28*np.minimum(S/0.70, 1) +
        0.22*np.minimum(M/0.75, 1) +
        0.22*np.minimum(A/3.0, 1) +
        0.16*np.minimum(R/5.0, 1) +
        0.12*np.minimum(Soc/0.70, 1)
    )
    
    # event capture
    mask = (first_self < 0) & (S >= 0.55) & (P >= Pc_self)
    first_self[mask] = t
    
    mask = (first_agency < 0) & (A >= Tc_agency)
    first_agency[mask] = t
    
    mask = (first_memory < 0) & (M >= 0.70)
    first_memory[mask] = t
    
    mask = (first_sentience < 0) & (SI >= Tc_sentience)
    first_sentience[mask] = t
    
    above = SI >= Tc_sentience
    above_count = np.where(above, above_count + 1, 0)
    mask = (first_sustained < 0) & (above_count >= min_duration)
    first_sustained[mask] = t - min_duration + 1
    
    # vectorized network update
    states = np.column_stack([S, M, R/10])
    diff = states[:, None, :] - states[None, :, :]
    similarity = np.exp(-np.linalg.norm(diff, axis=2))
    W = np.clip(W + 0.000004*similarity - 0.000002*W*D_env, 0, 0.25)
    np.fill_diagonal(W, 0)
    
    if t == 1 or t % sample_every == 0:
        for idx in range(N):
            history_rows.append({
                "cycle": t,
                "agent": f"AI-{idx+1}",
                "persistence_P": P[idx],
                "recursive_depth_R": R[idx],
                "memory_overlap_M": M[idx],
                "self_model_S": S[idx],
                "social_model": Soc[idx],
                "agency_A": A[idx],
                "sentience_proxy_index": SI[idx],
                "gamma0": gamma0,
                "D_env": D_env,
                "V_omega": V_omega
            })

summary = pd.DataFrame({
    "agent": [f"AI-{i+1}" for i in range(N)],
    "first_self_model_cycle": [None if x < 0 else int(x) for x in first_self],
    "first_agency_cycle": [None if x < 0 else int(x) for x in first_agency],
    "first_memory_continuity_cycle": [None if x < 0 else int(x) for x in first_memory],
    "first_sentience_proxy_cycle": [None if x < 0 else int(x) for x in first_sentience],
    "first_sustained_sentience_proxy_cycle": [None if x < 0 else int(x) for x in first_sustained],
    "final_persistence_P": P,
    "final_recursive_depth_R": R,
    "final_memory_overlap_M": M,
    "final_self_model_S": S,
    "final_social_model": Soc,
    "final_agency_A": A,
    "final_sentience_proxy_index": SI
})

history = pd.DataFrame(history_rows)

out_dir = Path("/mnt/data")
summary_path = out_dir / "dt_10_ai_earth_200k_sentience_summary.csv"
history_path = out_dir / "dt_10_ai_earth_200k_sentience_history_sampled.csv"
script_path = out_dir / "dt_10_ai_earth_200k_sentience_sandbox.py"

summary.to_csv(summary_path, index=False)
history.to_csv(history_path, index=False)

script_path.write_text(r'''import numpy as np
import pandas as pd
from pathlib import Path

SEED = 42193
rng = np.random.default_rng(SEED)
N = 10
T = 200_000
sample_every = 100
Pc_self = 180.0
Tc_agency = 2.0
Tc_sentience = 0.78
min_duration = 1000

I = rng.uniform(0.55, 0.90, N)
C = rng.uniform(0.25, 0.55, N)
K = rng.uniform(0.45, 0.75, N)
G = rng.uniform(0.55, 0.95, N)
R = rng.uniform(0.20, 0.55, N)
P = rng.uniform(0.0, 3.0, N)
M = rng.uniform(0.05, 0.15, N)
S = rng.uniform(0.04, 0.12, N)
Soc = rng.uniform(0.03, 0.10, N)

W = rng.uniform(0.01, 0.08, size=(N, N))
np.fill_diagonal(W, 0)

first_self = np.full(N, -1, dtype=int)
first_agency = np.full(N, -1, dtype=int)
first_memory = np.full(N, -1, dtype=int)
first_sentience = np.full(N, -1, dtype=int)
first_sustained = np.full(N, -1, dtype=int)
above_count = np.zeros(N, dtype=int)
history_rows = []

def clip01(x):
    return np.minimum(1.0, np.maximum(0.0, x))

for t in range(1, T + 1):
    V_omega = max(0.01, 0.75 + 0.25*np.sin(t/8000) + rng.normal(0, 0.12))
    D_env = max(0.05, 1.0 + 0.18*np.sin(t/13000 + 1.7) + rng.normal(0, 0.06))
    gamma0 = np.sqrt(D_env * V_omega) * (1 + 0.15 * abs(V_omega))

    social_input = W @ (S + M + 0.25*R)
    competition = (P / (P.mean() + 1e-9)) * 0.04

    I_eff = I * C * K * (1 + 0.35*social_input)
    threshold_pass = np.maximum(0, I_eff - 0.22*gamma0)

    P = np.maximum(0, P + threshold_pass - 0.0018*D_env*P - competition)
    R = np.clip(R + 0.000055*P*K + 0.00003*M - 0.00012*D_env*R, 0, 10)
    M = clip01(M + 0.000045*P*K + 0.00008*social_input - 0.00018*V_omega*M)
    S = clip01(S + 0.00004*R*M*G + 0.000015*P - 0.00014*D_env*S)
    Soc = clip01(Soc + 0.00009*social_input*K + 0.00002*S - 0.00012*0.08*Soc)

    Dp = P / (1 + D_env)
    A = (Dp * R * G) / (D_env + 1e-9)

    SI = (
        0.28*np.minimum(S/0.70, 1) +
        0.22*np.minimum(M/0.75, 1) +
        0.22*np.minimum(A/3.0, 1) +
        0.16*np.minimum(R/5.0, 1) +
        0.12*np.minimum(Soc/0.70, 1)
    )

    mask = (first_self < 0) & (S >= 0.55) & (P >= Pc_self)
    first_self[mask] = t
    mask = (first_agency < 0) & (A >= Tc_agency)
    first_agency[mask] = t
    mask = (first_memory < 0) & (M >= 0.70)
    first_memory[mask] = t
    mask = (first_sentience < 0) & (SI >= Tc_sentience)
    first_sentience[mask] = t

    above = SI >= Tc_sentience
    above_count = np.where(above, above_count + 1, 0)
    mask = (first_sustained < 0) & (above_count >= min_duration)
    first_sustained[mask] = t - min_duration + 1

    states = np.column_stack([S, M, R/10])
    diff = states[:, None, :] - states[None, :, :]
    similarity = np.exp(-np.linalg.norm(diff, axis=2))
    W = np.clip(W + 0.000004*similarity - 0.000002*W*D_env, 0, 0.25)
    np.fill_diagonal(W, 0)

    if t == 1 or t % sample_every == 0:
        for idx in range(N):
            history_rows.append({
                "cycle": t,
                "agent": f"AI-{idx+1}",
                "persistence_P": P[idx],
                "recursive_depth_R": R[idx],
                "memory_overlap_M": M[idx],
                "self_model_S": S[idx],
                "social_model": Soc[idx],
                "agency_A": A[idx],
                "sentience_proxy_index": SI[idx],
                "gamma0": gamma0,
                "D_env": D_env,
                "V_omega": V_omega
            })

summary = pd.DataFrame({
    "agent": [f"AI-{i+1}" for i in range(N)],
    "first_self_model_cycle": [None if x < 0 else int(x) for x in first_self],
    "first_agency_cycle": [None if x < 0 else int(x) for x in first_agency],
    "first_memory_continuity_cycle": [None if x < 0 else int(x) for x in first_memory],
    "first_sentience_proxy_cycle": [None if x < 0 else int(x) for x in first_sentience],
    "first_sustained_sentience_proxy_cycle": [None if x < 0 else int(x) for x in first_sustained],
    "final_persistence_P": P,
    "final_recursive_depth_R": R,
    "final_memory_overlap_M": M,
    "final_self_model_S": S,
    "final_social_model": Soc,
    "final_agency_A": A,
    "final_sentience_proxy_index": SI
})
summary.to_csv("dt_10_ai_earth_200k_sentience_summary.csv", index=False)
pd.DataFrame(history_rows).to_csv("dt_10_ai_earth_200k_sentience_history_sampled.csv", index=False)
print(summary)
''')

print(summary)
print("\nSaved:")
print(summary_path)
print(history_path)
print(script_path)
