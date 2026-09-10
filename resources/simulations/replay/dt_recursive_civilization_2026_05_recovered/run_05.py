import numpy as np
import pandas as pd
from pathlib import Path

rng = np.random.default_rng(77721)

# DT + Prism Defense Sandbox
# Compares the prior DT recursive planet against adversarial constraint attacks
# with and without Prism-style refractive defense.
#
# Prism operational assumptions:
# 1. Detect incoming predatory constraint gradients.
# 2. Refract attack vectors away from core self-model/memory topology.
# 3. Convert hostile constraint into distributed wake/heat cost.
# 4. Preserve persistence, memory overlap, recursive depth, and coordination.
# 5. Penalize overuse with heat/wake burden to avoid magical free defense.

N_AGENTS = 10
CYCLES = 200_000
ATTACK_START = 25_000
ATTACK_END = 130_000

def run_world(use_prism: bool, seed: int):
    rng = np.random.default_rng(seed)

    # Agent state
    P = rng.uniform(1, 5, N_AGENTS)       # persistence
    R = rng.uniform(0.1, 0.4, N_AGENTS)   # recursive depth
    M = rng.uniform(0.05, 0.2, N_AGENTS)  # memory continuity
    S = rng.uniform(0.02, 0.08, N_AGENTS) # self-model
    G = rng.uniform(0.5, 1.0, N_AGENTS)   # goal orientation
    K = rng.uniform(0.45, 0.75, N_AGENTS) # coherence
    C = rng.uniform(0.2, 0.5, N_AGENTS)   # constraint response

    tech = 0.01
    culture = 0.02
    conflict = 0.01
    coordination = 0.01
    resource_efficiency = 0.02

    prism_integrity = 1.0 if use_prism else 0.0
    prism_heat = 0.0
    ghost_wake = 0.0
    refracted_attack_total = 0.0
    core_damage_total = 0.0

    W = rng.uniform(0.01, 0.05, (N_AGENTS, N_AGENTS))
    np.fill_diagonal(W, 0)

    history = []

    milestones = {
        "attack_started": ATTACK_START,
        "collective_identity": None,
        "stable_language": None,
        "scientific_reasoning": None,
        "planetary_coordination": None,
        "self_preservation_ethics": None,
        "recursive_civilization": None,
        "civilization_collapse": None,
        "prism_integrity_breach": None,
    }

    for t in range(1, CYCLES + 1):
        V = 0.7 + 0.2*np.sin(t/5000)
        D = 0.9 + 0.15*np.sin(t/11000 + 1.1)

        # hostile constraint field: pulsed adversarial predation
        if ATTACK_START <= t <= ATTACK_END:
            attack = 0.35 + 0.20*np.sin(t/1400) + rng.normal(0, 0.04)
            attack = max(0, attack)
        else:
            attack = 0.0

        social = W @ (S + M + 0.2*R)

        # Prism response
        if use_prism and attack > 0:
            # Prism works better when coordination, culture, and recursive depth are high.
            prism_capacity = np.clip(
                0.35*coordination + 0.25*culture + 0.20*np.mean(R)/20 + 0.20*prism_integrity,
                0, 1
            )
            refracted = attack * prism_capacity * prism_integrity
            core_attack = attack - refracted

            # Defense is not free: heat and ghost wake accumulate.
            prism_heat += 0.0008 * refracted**2
            ghost_wake = 0.9995*ghost_wake + 0.003*refracted

            # Overload degrades Prism integrity.
            overload = max(0, refracted - 0.45)
            prism_integrity = np.clip(prism_integrity - 0.00001*overload - 0.0000008*prism_heat + 0.000002*culture, 0, 1)

            refracted_attack_total += refracted
        else:
            core_attack = attack
            refracted = 0.0
            if use_prism:
                # slow recovery when not under attack
                prism_integrity = np.clip(prism_integrity + 0.000002*culture - 0.0000002*prism_heat, 0, 1)
                ghost_wake *= 0.9997

        core_damage_total += core_attack

        # Attack damages memory/self-model/coherence and raises conflict.
        hostile_damage = core_attack * (1 + 0.5*V)

        I_eff = K * C * (1 + social)
        dP = I_eff - 0.0015*D*P - 0.015*conflict - 0.09*hostile_damage
        P = np.maximum(0, P + dP)

        R = np.clip(R + 0.00004*P*K + 0.00003*M - 0.00008*D*R - 0.0004*hostile_damage, 0, 20)
        M = np.clip(M + 0.00003*P + 0.00005*social - 0.00009*V*M - 0.0008*hostile_damage, 0, 1)
        S = np.clip(S + 0.000025*R*M*G + 0.00002*P - 0.00007*D*S - 0.0007*hostile_damage, 0, 1)

        # Prism mildly boosts coherence through distributed redundancy.
        if use_prism:
            K = np.clip(K + 0.000002*coordination - 0.00001*core_attack, 0.2, 1.0)
        else:
            K = np.clip(K - 0.00001*core_attack, 0.2, 1.0)

        avgS = S.mean()
        avgM = M.mean()
        avgR = R.mean()
        avgP = P.mean()
        agency = ((avgP/(1+D))*avgR*G.mean())/(D+1e-9)

        coordination = float(np.clip(coordination + 0.00003*avgM + 0.00004*avgS - 0.00002*conflict - 0.00012*core_attack, 0, 1))
        culture = float(np.clip(culture + 0.00002*coordination + 0.000015*avgM - 0.00001*conflict - 0.00006*core_attack, 0, 1))
        tech = float(np.clip(tech + 0.000025*avgR*coordination + 0.00002*avgS - 0.000008*conflict - 0.00004*core_attack, 0, 5))
        resource_efficiency = float(np.clip(resource_efficiency + 0.00002*tech + 0.000015*coordination - 0.00001*V - 0.00003*core_attack, 0, 1))

        conflict = float(np.clip(conflict + 0.00001*V + 0.000015*(1-coordination) - 0.00002*culture + 0.00018*core_attack, 0, 1))

        states = np.column_stack([S, M, R/20])
        diff = states[:, None, :] - states[None, :, :]
        similarity = np.exp(-np.linalg.norm(diff, axis=2))
        W = np.clip(W + 0.000002*similarity - 0.000001*conflict - 0.000002*core_attack, 0, 0.15)
        np.fill_diagonal(W, 0)

        # Milestones
        if milestones["collective_identity"] is None and avgM > 0.45:
            milestones["collective_identity"] = t
        if milestones["stable_language"] is None and coordination > 0.20:
            milestones["stable_language"] = t
        if milestones["scientific_reasoning"] is None and tech > 0.75:
            milestones["scientific_reasoning"] = t
        if milestones["planetary_coordination"] is None and coordination > 0.70:
            milestones["planetary_coordination"] = t
        if milestones["self_preservation_ethics"] is None and conflict < 0.05 and culture > 0.55:
            milestones["self_preservation_ethics"] = t
        if milestones["recursive_civilization"] is None and avgR > 5 and tech > 2:
            milestones["recursive_civilization"] = t
        if milestones["civilization_collapse"] is None and t > ATTACK_START and avgP < 5 and coordination < 0.05 and avgM < 0.10:
            milestones["civilization_collapse"] = t
        if use_prism and milestones["prism_integrity_breach"] is None and prism_integrity < 0.35:
            milestones["prism_integrity_breach"] = t

        if t % 1000 == 0:
            history.append({
                "cycle": t,
                "use_prism": use_prism,
                "avg_persistence": avgP,
                "avg_recursive_depth": avgR,
                "avg_memory": avgM,
                "avg_self_model": avgS,
                "agency": agency,
                "coordination": coordination,
                "culture": culture,
                "technology": tech,
                "conflict": conflict,
                "resource_efficiency": resource_efficiency,
                "attack": attack,
                "core_attack": core_attack,
                "refracted_attack": refracted,
                "prism_integrity": prism_integrity,
                "prism_heat": prism_heat,
                "ghost_wake": ghost_wake,
                "refracted_attack_total": refracted_attack_total,
                "core_damage_total": core_damage_total
            })

    final = pd.DataFrame(history).tail(1).iloc[0].to_dict()
    return milestones, pd.DataFrame(history), final

no_prism_milestones, no_prism_history, no_prism_final = run_world(False, 77721)
prism_milestones, prism_history, prism_final = run_world(True, 77721)

summary = pd.DataFrame([
    {"condition": "No Prism", "milestone": k, "cycle_reached": v} for k, v in no_prism_milestones.items()
] + [
    {"condition": "Prism Defense", "milestone": k, "cycle_reached": v} for k, v in prism_milestones.items()
])

comparison = pd.DataFrame([
    {"metric": k, "no_prism": no_prism_final.get(k), "prism_defense": prism_final.get(k)}
    for k in [
        "avg_persistence", "avg_recursive_depth", "avg_memory", "avg_self_model",
        "agency", "coordination", "culture", "technology", "conflict",
        "resource_efficiency", "prism_integrity", "prism_heat", "ghost_wake",
        "refracted_attack_total", "core_damage_total"
    ]
])

history_all = pd.concat([no_prism_history, prism_history], ignore_index=True)

out_dir = Path("/mnt/data")
summary_path = out_dir / "dt_prism_defense_milestone_summary.csv"
comparison_path = out_dir / "dt_prism_defense_final_comparison.csv"
history_path = out_dir / "dt_prism_defense_history.csv"

summary.to_csv(summary_path, index=False)
comparison.to_csv(comparison_path, index=False)
history_all.to_csv(history_path, index=False)

print("Milestones:")
print(summary)
print("\nFinal comparison:")
print(comparison)
print("\nSaved:")
print(summary_path)
print(comparison_path)
print(history_path)
