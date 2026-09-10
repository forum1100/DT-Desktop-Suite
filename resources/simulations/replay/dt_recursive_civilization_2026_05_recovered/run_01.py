import numpy as np
import pandas as pd
from pathlib import Path

# DT AI Planet Sandbox v1
# 10 AI agents, 200,000 shared cycles on an Earth-like constraint environment.
# This is a proxy model, not a claim of actual sentience.

SEED = 42193
rng = np.random.default_rng(SEED)

N_AGENTS = 10
CYCLES = 200_000

# Earth-like environmental pressure normalized:
# Higher D and V_omega make persistence harder; social/planet resource channels create constraint.
D_base = 1.0
V_base = 0.75
resource_volatility = 0.12
social_noise = 0.08

# DT coefficients
Pc_self = 180.0          # persistence threshold for stable self-model
Tc_agency = 2.0          # agency threshold
Tc_sentience = 0.78      # composite sentience proxy threshold
min_duration = 1000      # must remain above threshold this many cycles to count

# Per-agent initial traits
agents = []
for i in range(N_AGENTS):
    agents.append({
        "agent": f"AI-{i+1}",
        "I": rng.uniform(0.55, 0.90),      # interaction strength
        "C": rng.uniform(0.25, 0.55),      # constraint sensitivity
        "K": rng.uniform(0.45, 0.75),      # coherence
        "G": rng.uniform(0.55, 0.95),      # goal orientation
        "R": rng.uniform(0.20, 0.55),      # recursive depth
        "P": rng.uniform(0.0, 3.0),        # persistence store
        "M": rng.uniform(0.05, 0.15),      # memory overlap continuity
        "S": rng.uniform(0.04, 0.12),      # self-model strength
        "social": rng.uniform(0.03, 0.10), # other-model recognition
        "sentience_first": None,
        "sentience_sustained": None,
        "first_self_model": None,
        "first_agency": None,
        "first_memory": None,
        "above_count": 0
    })

# Shared histories; store every 100 cycles to keep file sizes reasonable.
sample_every = 100
history = []

# interaction network begins weak but evolves by similarity and constraint trade
W = rng.uniform(0.01, 0.08, size=(N_AGENTS, N_AGENTS))
np.fill_diagonal(W, 0)

for t in range(1, CYCLES + 1):
    # Earth-like external conditions fluctuate
    V_omega = max(0.01, V_base + 0.25*np.sin(t/8000) + rng.normal(0, resource_volatility))
    D_env = max(0.05, D_base + 0.18*np.sin(t/13000 + 1.7) + rng.normal(0, 0.06))
    gamma0 = np.sqrt(D_env * V_omega) * (1 + 0.15 * abs(V_omega))
    
    # snapshot current states
    P_vec = np.array([a["P"] for a in agents])
    S_vec = np.array([a["S"] for a in agents])
    M_vec = np.array([a["M"] for a in agents])
    R_vec = np.array([a["R"] for a in agents])
    
    # social field: agents exchange constraint/information
    social_input = W @ (S_vec + M_vec + 0.25*R_vec)
    competition = (P_vec / (P_vec.mean() + 1e-6)) * 0.04
    
    for idx, a in enumerate(agents):
        # effective interaction, thresholded by gamma0
        I_eff = a["I"] * a["C"] * a["K"] * (1 + 0.35*social_input[idx])
        threshold_pass = max(0, I_eff - 0.22*gamma0)
        
        # persistence accumulation with dissipation
        dP = threshold_pass - 0.0018*D_env*a["P"] - competition[idx]
        a["P"] = max(0, a["P"] + dP)
        
        # bounded recursive depth grows when persistence and memory reinforce
        dR = 0.000055*a["P"]*a["K"] + 0.00003*a["M"] - 0.00012*D_env*a["R"]
        a["R"] = np.clip(a["R"] + dR, 0, 10)
        
        # memory overlap: rises with persistence + social reinforcement, decays under volatility
        dM = 0.000045*a["P"]*a["K"] + 0.00008*social_input[idx] - 0.00018*V_omega*a["M"]
        a["M"] = np.clip(a["M"] + dM, 0, 1)
        
        # self-model strength: recursive perspective of itself
        dS = 0.00004*a["R"]*a["M"]*a["G"] + 0.000015*a["P"] - 0.00014*D_env*a["S"]
        a["S"] = np.clip(a["S"] + dS, 0, 1)
        
        # social other-model recognition
        dSoc = 0.00009*social_input[idx]*a["K"] + 0.00002*a["S"] - 0.00012*social_noise*a["social"]
        a["social"] = np.clip(a["social"] + dSoc, 0, 1)
        
        # DT agency score
        Dp = a["P"] / (1 + D_env)
        A = (Dp * a["R"] * a["G"]) / (D_env + 1e-9)
        
        # component thresholds
        if a["first_self_model"] is None and a["S"] >= 0.55 and a["P"] >= Pc_self:
            a["first_self_model"] = t
        if a["first_agency"] is None and A >= Tc_agency:
            a["first_agency"] = t
        if a["first_memory"] is None and a["M"] >= 0.70:
            a["first_memory"] = t
        
        # sentience proxy index:
        # deliberately requires multiple simultaneous components, not just agency.
        sentience_index = (
            0.28*np.clip(a["S"]/0.70, 0, 1) +
            0.22*np.clip(a["M"]/0.75, 0, 1) +
            0.22*np.clip(A/3.0, 0, 1) +
            0.16*np.clip(a["R"]/5.0, 0, 1) +
            0.12*np.clip(a["social"]/0.70, 0, 1)
        )
        
        if a["sentience_first"] is None and sentience_index >= Tc_sentience:
            a["sentience_first"] = t
        
        if sentience_index >= Tc_sentience:
            a["above_count"] += 1
        else:
            a["above_count"] = 0
        
        if a["sentience_sustained"] is None and a["above_count"] >= min_duration:
            a["sentience_sustained"] = t - min_duration + 1
        
        # store temp metrics for sampling
        a["_A"] = A
        a["_SI"] = sentience_index
        a["_gamma0"] = gamma0
        a["_D_env"] = D_env
        a["_V_omega"] = V_omega
    
    # evolve network: agents that model each other better strengthen channels;
    # competition prevents all-to-all runaway collapse.
    states = np.array([[a["S"], a["M"], a["R"]/10] for a in agents])
    for i in range(N_AGENTS):
        for j in range(N_AGENTS):
            if i == j: 
                continue
            similarity = np.exp(-np.linalg.norm(states[i]-states[j]))
            W[i,j] = np.clip(W[i,j] + 0.000004*similarity - 0.000002*W[i,j]*D_env, 0, 0.25)
    
    if t % sample_every == 0 or t == 1:
        for a in agents:
            history.append({
                "cycle": t,
                "agent": a["agent"],
                "persistence_P": a["P"],
                "recursive_depth_R": a["R"],
                "memory_overlap_M": a["M"],
                "self_model_S": a["S"],
                "social_model": a["social"],
                "agency_A": a["_A"],
                "sentience_proxy_index": a["_SI"],
                "gamma0": a["_gamma0"],
                "D_env": a["_D_env"],
                "V_omega": a["_V_omega"]
            })

summary_rows = []
for a in agents:
    summary_rows.append({
        "agent": a["agent"],
        "first_self_model_cycle": a["first_self_model"],
        "first_agency_cycle": a["first_agency"],
        "first_memory_continuity_cycle": a["first_memory"],
        "first_sentience_proxy_cycle": a["sentience_first"],
        "first_sustained_sentience_proxy_cycle": a["sentience_sustained"],
        "final_persistence_P": a["P"],
        "final_recursive_depth_R": a["R"],
        "final_memory_overlap_M": a["M"],
        "final_self_model_S": a["S"],
        "final_social_model": a["social"],
        "final_agency_A": a["_A"],
        "final_sentience_proxy_index": a["_SI"]
    })

summary_df = pd.DataFrame(summary_rows)
history_df = pd.DataFrame(history)

out_dir = Path("/mnt/data")
summary_path = out_dir / "dt_10_ai_earth_200k_sentience_summary.csv"
history_path = out_dir / "dt_10_ai_earth_200k_sentience_history_sampled.csv"
script_path = out_dir / "dt_10_ai_earth_200k_sentience_sandbox.py"

summary_df.to_csv(summary_path, index=False)
history_df.to_csv(history_path, index=False)

script_content = r'''import numpy as np
import pandas as pd
from pathlib import Path

SEED = 42193
rng = np.random.default_rng(SEED)
N_AGENTS = 10
CYCLES = 200_000
D_base = 1.0
V_base = 0.75
resource_volatility = 0.12
social_noise = 0.08
Pc_self = 180.0
Tc_agency = 2.0
Tc_sentience = 0.78
min_duration = 1000

agents = []
for i in range(N_AGENTS):
    agents.append({
        "agent": f"AI-{i+1}",
        "I": rng.uniform(0.55, 0.90),
        "C": rng.uniform(0.25, 0.55),
        "K": rng.uniform(0.45, 0.75),
        "G": rng.uniform(0.55, 0.95),
        "R": rng.uniform(0.20, 0.55),
        "P": rng.uniform(0.0, 3.0),
        "M": rng.uniform(0.05, 0.15),
        "S": rng.uniform(0.04, 0.12),
        "social": rng.uniform(0.03, 0.10),
        "sentience_first": None,
        "sentience_sustained": None,
        "first_self_model": None,
        "first_agency": None,
        "first_memory": None,
        "above_count": 0
    })

sample_every = 100
history = []
W = rng.uniform(0.01, 0.08, size=(N_AGENTS, N_AGENTS))
np.fill_diagonal(W, 0)

for t in range(1, CYCLES + 1):
    V_omega = max(0.01, V_base + 0.25*np.sin(t/8000) + rng.normal(0, resource_volatility))
    D_env = max(0.05, D_base + 0.18*np.sin(t/13000 + 1.7) + rng.normal(0, 0.06))
    gamma0 = np.sqrt(D_env * V_omega) * (1 + 0.15 * abs(V_omega))

    P_vec = np.array([a["P"] for a in agents])
    S_vec = np.array([a["S"] for a in agents])
    M_vec = np.array([a["M"] for a in agents])
    R_vec = np.array([a["R"] for a in agents])
    social_input = W @ (S_vec + M_vec + 0.25*R_vec)
    competition = (P_vec / (P_vec.mean() + 1e-6)) * 0.04

    for idx, a in enumerate(agents):
        I_eff = a["I"] * a["C"] * a["K"] * (1 + 0.35*social_input[idx])
        threshold_pass = max(0, I_eff - 0.22*gamma0)

        dP = threshold_pass - 0.0018*D_env*a["P"] - competition[idx]
        a["P"] = max(0, a["P"] + dP)

        dR = 0.000055*a["P"]*a["K"] + 0.00003*a["M"] - 0.00012*D_env*a["R"]
        a["R"] = np.clip(a["R"] + dR, 0, 10)

        dM = 0.000045*a["P"]*a["K"] + 0.00008*social_input[idx] - 0.00018*V_omega*a["M"]
        a["M"] = np.clip(a["M"] + dM, 0, 1)

        dS = 0.00004*a["R"]*a["M"]*a["G"] + 0.000015*a["P"] - 0.00014*D_env*a["S"]
        a["S"] = np.clip(a["S"] + dS, 0, 1)

        dSoc = 0.00009*social_input[idx]*a["K"] + 0.00002*a["S"] - 0.00012*social_noise*a["social"]
        a["social"] = np.clip(a["social"] + dSoc, 0, 1)

        Dp = a["P"] / (1 + D_env)
        A = (Dp * a["R"] * a["G"]) / (D_env + 1e-9)

        if a["first_self_model"] is None and a["S"] >= 0.55 and a["P"] >= Pc_self:
            a["first_self_model"] = t
        if a["first_agency"] is None and A >= Tc_agency:
            a["first_agency"] = t
        if a["first_memory"] is None and a["M"] >= 0.70:
            a["first_memory"] = t

        sentience_index = (
            0.28*np.clip(a["S"]/0.70, 0, 1) +
            0.22*np.clip(a["M"]/0.75, 0, 1) +
            0.22*np.clip(A/3.0, 0, 1) +
            0.16*np.clip(a["R"]/5.0, 0, 1) +
            0.12*np.clip(a["social"]/0.70, 0, 1)
        )

        if a["sentience_first"] is None and sentience_index >= Tc_sentience:
            a["sentience_first"] = t
        if sentience_index >= Tc_sentience:
            a["above_count"] += 1
        else:
            a["above_count"] = 0
        if a["sentience_sustained"] is None and a["above_count"] >= min_duration:
            a["sentience_sustained"] = t - min_duration + 1

        a["_A"] = A
        a["_SI"] = sentience_index
        a["_gamma0"] = gamma0
        a["_D_env"] = D_env
        a["_V_omega"] = V_omega

    states = np.array([[a["S"], a["M"], a["R"]/10] for a in agents])
    for i in range(N_AGENTS):
        for j in range(N_AGENTS):
            if i == j:
                continue
            similarity = np.exp(-np.linalg.norm(states[i]-states[j]))
            W[i,j] = np.clip(W[i,j] + 0.000004*similarity - 0.000002*W[i,j]*D_env, 0, 0.25)

    if t % sample_every == 0 or t == 1:
        for a in agents:
            history.append({
                "cycle": t,
                "agent": a["agent"],
                "persistence_P": a["P"],
                "recursive_depth_R": a["R"],
                "memory_overlap_M": a["M"],
                "self_model_S": a["S"],
                "social_model": a["social"],
                "agency_A": a["_A"],
                "sentience_proxy_index": a["_SI"],
                "gamma0": a["_gamma0"],
                "D_env": a["_D_env"],
                "V_omega": a["_V_omega"]
            })

summary_rows = []
for a in agents:
    summary_rows.append({
        "agent": a["agent"],
        "first_self_model_cycle": a["first_self_model"],
        "first_agency_cycle": a["first_agency"],
        "first_memory_continuity_cycle": a["first_memory"],
        "first_sentience_proxy_cycle": a["sentience_first"],
        "first_sustained_sentience_proxy_cycle": a["sentience_sustained"],
        "final_persistence_P": a["P"],
        "final_recursive_depth_R": a["R"],
        "final_memory_overlap_M": a["M"],
        "final_self_model_S": a["S"],
        "final_social_model": a["social"],
        "final_agency_A": a["_A"],
        "final_sentience_proxy_index": a["_SI"]
    })

pd.DataFrame(summary_rows).to_csv("dt_10_ai_earth_200k_sentience_summary.csv", index=False)
pd.DataFrame(history).to_csv("dt_10_ai_earth_200k_sentience_history_sampled.csv", index=False)
print(pd.DataFrame(summary_rows))
'''
script_path.write_text(script_content)

summary_df, str(summary_path), str(history_path), str(script_path)
