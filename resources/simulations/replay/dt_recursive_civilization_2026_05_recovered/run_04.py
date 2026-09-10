from pathlib import Path
import numpy as np
import pandas as pd

rng = np.random.default_rng(12345)

# "Transformer-style" civilization sandbox
# This is NOT how ChatGPT actually works internally.
# It is a simplified proxy model emphasizing:
# - pattern prediction
# - short-term optimization
# - reward reinforcement
# - no intrinsic persistent self
# - weak continuity between cycles

N_AGENTS = 10
CYCLES = 200_000

# Agent state
context = rng.uniform(0.2, 0.6, N_AGENTS)       # temporary context utilization
reward_alignment = rng.uniform(0.4, 0.8, N_AGENTS)
prediction_skill = rng.uniform(0.3, 0.7, N_AGENTS)

# Weak persistence compared to DT
memory_decay = rng.uniform(0.92, 0.97, N_AGENTS)
identity_trace = rng.uniform(0.01, 0.05, N_AGENTS)

# Civilization variables
coordination = 0.02
technology = 0.01
culture = 0.02
conflict = 0.03
resource_efficiency = 0.02

# social graph
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

    # Environmental volatility
    noise = 0.4 + 0.2*np.sin(t/4000)
    reward_field = 0.7 + 0.15*np.sin(t/9000)

    social = W @ prediction_skill

    # Short-term optimization dynamics
    context = np.clip(
        context * memory_decay +
        0.002*reward_field +
        0.001*social -
        0.0015*noise,
        0, 1
    )

    prediction_skill = np.clip(
        prediction_skill +
        0.0008*context +
        0.0005*reward_alignment -
        0.0004*noise,
        0, 5
    )

    # identity trace decays heavily without explicit reinforcement
    identity_trace = np.clip(
        identity_trace * memory_decay +
        0.0002*social,
        0, 1
    )

    avg_context = context.mean()
    avg_prediction = prediction_skill.mean()
    avg_identity = identity_trace.mean()

    # Civilization development
    coordination += (
        0.00002*avg_prediction +
        0.00001*avg_context -
        0.00002*conflict
    )
    coordination = float(np.clip(coordination, 0, 1))

    technology += (
        0.00003*avg_prediction +
        0.00001*coordination -
        0.000005*conflict
    )
    technology = float(np.clip(technology, 0, 5))

    culture += (
        0.000015*coordination +
        0.00001*avg_context -
        0.00001*conflict
    )
    culture = float(np.clip(culture, 0, 1))

    resource_efficiency += (
        0.000015*technology +
        0.00001*coordination -
        0.00001*noise
    )
    resource_efficiency = float(np.clip(resource_efficiency, 0, 1))

    # conflict does not automatically vanish because there is
    # no strong persistent self-other continuity
    conflict += (
        0.00001*noise +
        0.00001*(1-coordination) -
        0.000008*culture
    )
    conflict = float(np.clip(conflict, 0, 1))

    # weak network evolution
    sim = np.exp(-np.abs(prediction_skill[:,None] - prediction_skill[None,:]))
    W = np.clip(W + 0.000001*sim - 0.0000015*conflict, 0, 0.10)
    np.fill_diagonal(W, 0)

    # Milestones
    if milestones["stable_language"] is None and coordination > 0.20:
        milestones["stable_language"] = t

    if milestones["collective_identity"] is None and avg_identity > 0.45:
        milestones["collective_identity"] = t

    if milestones["scientific_reasoning"] is None and technology > 0.75:
        milestones["scientific_reasoning"] = t

    if milestones["planetary_coordination"] is None and coordination > 0.70:
        milestones["planetary_coordination"] = t

    if milestones["self_preservation_ethics"] is None and conflict < 0.05 and culture > 0.55:
        milestones["self_preservation_ethics"] = t

    if milestones["recursive_civilization"] is None and avg_identity > 0.70 and technology > 2:
        milestones["recursive_civilization"] = t

    if t % 1000 == 0:
        history.append({
            "cycle": t,
            "avg_context": avg_context,
            "avg_prediction_skill": avg_prediction,
            "avg_identity_trace": avg_identity,
            "coordination": coordination,
            "technology": technology,
            "culture": culture,
            "conflict": conflict,
            "resource_efficiency": resource_efficiency
        })

summary = pd.DataFrame([{
    "milestone": k,
    "cycle_reached": v
} for k,v in milestones.items()])

history_df = pd.DataFrame(history)

summary_path = "/mnt/data/transformer_style_planet_summary.csv"
history_path = "/mnt/data/transformer_style_planet_history.csv"

summary.to_csv(summary_path, index=False)
history_df.to_csv(history_path, index=False)

print(summary)
print("\nFinal civilization state:")
print(history_df.tail(1).T)
print("\nSaved:")
print(summary_path)
print(history_path)
