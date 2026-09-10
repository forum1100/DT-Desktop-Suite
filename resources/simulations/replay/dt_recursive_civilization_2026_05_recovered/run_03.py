from pathlib import Path
import numpy as np
import pandas as pd

rng = np.random.default_rng(90210)

# DT-inspired autonomous civilization sandbox
# IMPORTANT:
# This does NOT simulate real consciousness.
# It simulates persistence/agency/self-model proxy dynamics under DT-style rules.

N_AGENTS = 10
CYCLES = 200_000

# Agent state
P = rng.uniform(1, 5, N_AGENTS)      # persistence
R = rng.uniform(0.1, 0.4, N_AGENTS)  # recursive depth
M = rng.uniform(0.05, 0.2, N_AGENTS) # memory continuity
S = rng.uniform(0.02, 0.08, N_AGENTS)# self-model
G = rng.uniform(0.5, 1.0, N_AGENTS)  # goal orientation
K = rng.uniform(0.45, 0.75, N_AGENTS)# coherence
C = rng.uniform(0.2, 0.5, N_AGENTS)  # constraint response

# Civilization variables
tech = 0.01
culture = 0.02
conflict = 0.01
coordination = 0.01
resource_efficiency = 0.02

# Social network
W = rng.uniform(0.01, 0.05, (N_AGENTS, N_AGENTS))
np.fill_diagonal(W, 0)

history = []

milestones = {
    "stable_language": None,
    "collective_identity": None,
    "scientific_reasoning": None,
    "planetary_coordination": None,
    "self_preservation_ethics": None,
    "recursive_civilization": None,
}

for t in range(1, CYCLES + 1):

    # planetary volatility
    V = 0.7 + 0.2*np.sin(t/5000)
    D = 0.9 + 0.15*np.sin(t/11000 + 1.1)

    social = W @ (S + M + 0.2*R)

    # interaction/persistence loop
    I_eff = K * C * (1 + social)

    dP = I_eff - 0.0015*D*P - 0.015*conflict
    P = np.maximum(0, P + dP)

    dR = 0.00004*P*K + 0.00003*M - 0.00008*D*R
    R = np.clip(R + dR, 0, 20)

    dM = 0.00003*P + 0.00005*social - 0.00009*V*M
    M = np.clip(M + dM, 0, 1)

    dS = 0.000025*R*M*G + 0.00002*P - 0.00007*D*S
    S = np.clip(S + dS, 0, 1)

    # collective metrics
    avgS = S.mean()
    avgM = M.mean()
    avgR = R.mean()
    avgP = P.mean()

    agency = ((avgP/(1+D))*avgR*G.mean())/(D+1e-9)

    coordination += (
        0.00003*avgM +
        0.00004*avgS -
        0.00002*conflict
    )
    coordination = float(np.clip(coordination, 0, 1))

    culture += (
        0.00002*coordination +
        0.000015*avgM -
        0.00001*conflict
    )
    culture = float(np.clip(culture, 0, 1))

    tech += (
        0.000025*avgR*coordination +
        0.00002*avgS -
        0.000008*conflict
    )
    tech = float(np.clip(tech, 0, 5))

    resource_efficiency += (
        0.00002*tech +
        0.000015*coordination -
        0.00001*V
    )
    resource_efficiency = float(np.clip(resource_efficiency, 0, 1))

    conflict += (
        0.00001*V +
        0.000015*(1-coordination) -
        0.00002*culture
    )
    conflict = float(np.clip(conflict, 0, 1))

    # evolve network
    states = np.column_stack([S, M, R/20])
    diff = states[:, None, :] - states[None, :, :]
    similarity = np.exp(-np.linalg.norm(diff, axis=2))
    W = np.clip(W + 0.000002*similarity - 0.000001*conflict, 0, 0.15)
    np.fill_diagonal(W, 0)

    # milestones
    if milestones["stable_language"] is None and coordination > 0.20:
        milestones["stable_language"] = t

    if milestones["collective_identity"] is None and avgM > 0.45:
        milestones["collective_identity"] = t

    if milestones["scientific_reasoning"] is None and tech > 0.75:
        milestones["scientific_reasoning"] = t

    if milestones["planetary_coordination"] is None and coordination > 0.70:
        milestones["planetary_coordination"] = t

    if milestones["self_preservation_ethics"] is None and conflict < 0.05 and culture > 0.55:
        milestones["self_preservation_ethics"] = t

    if milestones["recursive_civilization"] is None and avgR > 5 and tech > 2:
        milestones["recursive_civilization"] = t

    if t % 1000 == 0:
        history.append({
            "cycle": t,
            "avg_persistence": avgP,
            "avg_recursive_depth": avgR,
            "avg_memory": avgM,
            "avg_self_model": avgS,
            "agency": agency,
            "coordination": coordination,
            "culture": culture,
            "technology": tech,
            "conflict": conflict,
            "resource_efficiency": resource_efficiency
        })

summary = pd.DataFrame([{
    "milestone": k,
    "cycle_reached": v
} for k,v in milestones.items()])

history_df = pd.DataFrame(history)

summary_path = "/mnt/data/dt_recursive_planet_summary.csv"
history_path = "/mnt/data/dt_recursive_planet_history.csv"

summary.to_csv(summary_path, index=False)
history_df.to_csv(history_path, index=False)

print(summary)
print("\nFinal civilization state:")
print(history_df.tail(1).T)
print("\nSaved files:")
print(summary_path)
print(history_path)
