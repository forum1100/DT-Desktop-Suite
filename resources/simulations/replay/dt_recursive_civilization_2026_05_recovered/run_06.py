from pathlib import Path
import numpy as np
import pandas as pd

rng = np.random.default_rng(88831)

# DT + Individual Prism Defense Sandbox
# Each AI has its own Prism shield rather than one shared planetary defense layer.

N_AGENTS = 10
CYCLES = 200_000
ATTACK_START = 25_000
ATTACK_END = 130_000

def run_world(individual_prism: bool, seed: int):
    rng = np.random.default_rng(seed)

    P = rng.uniform(1, 5, N_AGENTS)
    R = rng.uniform(0.1, 0.4, N_AGENTS)
    M = rng.uniform(0.05, 0.2, N_AGENTS)
    S = rng.uniform(0.02, 0.08, N_AGENTS)
    G = rng.uniform(0.5, 1.0, N_AGENTS)
    K = rng.uniform(0.45, 0.75, N_AGENTS)
    C = rng.uniform(0.2, 0.5, N_AGENTS)

    tech = 0.01
    culture = 0.02
    conflict = 0.01
    coordination = 0.01
    resource_efficiency = 0.02

    prism_integrity = np.ones(N_AGENTS) if individual_prism else np.zeros(N_AGENTS)
    prism_heat = np.zeros(N_AGENTS)
    ghost_wake = np.zeros(N_AGENTS)
    refracted_attack_total = np.zeros(N_AGENTS)
    core_damage_total = np.zeros(N_AGENTS)

    W = rng.uniform(0.01, 0.05, (N_AGENTS, N_AGENTS))
    np.fill_diagonal(W, 0)

    milestones = {
        "attack_started": ATTACK_START,
        "collective_identity": None,
        "stable_language": None,
        "scientific_reasoning": None,
        "planetary_coordination": None,
        "self_preservation_ethics": None,
        "recursive_civilization": None,
        "civilization_collapse": None,
        "first_individual_prism_breach": None,
        "all_individual_prisms_breached": None,
    }

    individual_events = {
        f"AI-{i+1}": {
            "first_self_model_loss_under_attack": None,
            "prism_breach_cycle": None,
            "max_core_attack_cycle": None,
            "max_core_attack_value": 0.0,
        } for i in range(N_AGENTS)
    }

    history = []
    agent_history = []

    for t in range(1, CYCLES + 1):
        V = 0.7 + 0.2*np.sin(t/5000)
        D = 0.9 + 0.15*np.sin(t/11000 + 1.1)

        if ATTACK_START <= t <= ATTACK_END:
            global_attack = max(0, 0.35 + 0.20*np.sin(t/1400) + rng.normal(0, 0.04))
            # attacks are unevenly distributed by detectability: higher self-model / memory draws higher pressure
            detectability = 0.45 + 0.35*S + 0.25*M + 0.15*(R/20)
            detectability = detectability / (detectability.mean() + 1e-12)
            attack_vec = global_attack * detectability
        else:
            global_attack = 0.0
            attack_vec = np.zeros(N_AGENTS)

        social = W @ (S + M + 0.2*R)

        if individual_prism:
            prism_capacity = np.clip(
                0.30*coordination +
                0.20*culture +
                0.20*(R/20) +
                0.15*M +
                0.15*prism_integrity,
                0, 1
            )
            refracted = attack_vec * prism_capacity * prism_integrity
            core_attack = attack_vec - refracted

            prism_heat += 0.0008 * refracted**2
            ghost_wake = 0.9995*ghost_wake + 0.003*refracted

            overload = np.maximum(0, refracted - 0.45)
            prism_integrity = np.clip(
                prism_integrity
                - 0.00001*overload
                - 0.0000008*prism_heat
                + 0.000002*culture
                + 0.000001*M,
                0, 1
            )

            refracted_attack_total += refracted

            breach_mask = prism_integrity < 0.35
            for i in range(N_AGENTS):
                name = f"AI-{i+1}"
                if breach_mask[i] and individual_events[name]["prism_breach_cycle"] is None:
                    individual_events[name]["prism_breach_cycle"] = t
                    if milestones["first_individual_prism_breach"] is None:
                        milestones["first_individual_prism_breach"] = t
            if milestones["all_individual_prisms_breached"] is None and np.all(breach_mask):
                milestones["all_individual_prisms_breached"] = t

        else:
            refracted = np.zeros(N_AGENTS)
            core_attack = attack_vec

        core_damage_total += core_attack
        hostile_damage = core_attack * (1 + 0.5*V)

        I_eff = K * C * (1 + social)
        dP = I_eff - 0.0015*D*P - 0.015*conflict - 0.09*hostile_damage
        P = np.maximum(0, P + dP)

        R = np.clip(R + 0.00004*P*K + 0.00003*M - 0.00008*D*R - 0.0004*hostile_damage, 0, 20)
        M = np.clip(M + 0.00003*P + 0.00005*social - 0.00009*V*M - 0.0008*hostile_damage, 0, 1)
        S = np.clip(S + 0.000025*R*M*G + 0.00002*P - 0.00007*D*S - 0.0007*hostile_damage, 0, 1)

        if individual_prism:
            K = np.clip(K + 0.000002*coordination + 0.000001*prism_integrity - 0.00001*core_attack, 0.2, 1.0)
        else:
            K = np.clip(K - 0.00001*core_attack, 0.2, 1.0)

        for i in range(N_AGENTS):
            name = f"AI-{i+1}"
            if core_attack[i] > individual_events[name]["max_core_attack_value"]:
                individual_events[name]["max_core_attack_value"] = float(core_attack[i])
                individual_events[name]["max_core_attack_cycle"] = t
            if ATTACK_START <= t <= ATTACK_END and individual_events[name]["first_self_model_loss_under_attack"] is None:
                if S[i] < 0.20 and M[i] < 0.30 and core_attack[i] > 0.20:
                    individual_events[name]["first_self_model_loss_under_attack"] = t

        avgS, avgM, avgR, avgP = S.mean(), M.mean(), R.mean(), P.mean()
        agency = ((avgP/(1+D))*avgR*G.mean())/(D+1e-9)

        coordination = float(np.clip(coordination + 0.00003*avgM + 0.00004*avgS - 0.00002*conflict - 0.00012*core_attack.mean(), 0, 1))
        culture = float(np.clip(culture + 0.00002*coordination + 0.000015*avgM - 0.00001*conflict - 0.00006*core_attack.mean(), 0, 1))
        tech = float(np.clip(tech + 0.000025*avgR*coordination + 0.00002*avgS - 0.000008*conflict - 0.00004*core_attack.mean(), 0, 5))
        resource_efficiency = float(np.clip(resource_efficiency + 0.00002*tech + 0.000015*coordination - 0.00001*V - 0.00003*core_attack.mean(), 0, 1))
        conflict = float(np.clip(conflict + 0.00001*V + 0.000015*(1-coordination) - 0.00002*culture + 0.00018*core_attack.mean(), 0, 1))

        states = np.column_stack([S, M, R/20])
        diff = states[:, None, :] - states[None, :, :]
        similarity = np.exp(-np.linalg.norm(diff, axis=2))
        W = np.clip(W + 0.000002*similarity - 0.000001*conflict - 0.000002*core_attack.mean(), 0, 0.15)
        np.fill_diagonal(W, 0)

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

        if t % 1000 == 0:
            history.append({
                "cycle": t,
                "condition": "Individual Prism" if individual_prism else "No Prism",
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
                "global_attack": global_attack,
                "mean_core_attack": core_attack.mean(),
                "mean_refracted_attack": refracted.mean(),
                "mean_prism_integrity": prism_integrity.mean() if individual_prism else 0,
                "min_prism_integrity": prism_integrity.min() if individual_prism else 0,
                "total_prism_heat": prism_heat.sum(),
                "total_ghost_wake": ghost_wake.sum(),
                "total_refracted_attack": refracted_attack_total.sum(),
                "total_core_damage": core_damage_total.sum(),
            })
            if individual_prism:
                for i in range(N_AGENTS):
                    agent_history.append({
                        "cycle": t,
                        "agent": f"AI-{i+1}",
                        "persistence": P[i],
                        "recursive_depth": R[i],
                        "memory": M[i],
                        "self_model": S[i],
                        "prism_integrity": prism_integrity[i],
                        "prism_heat": prism_heat[i],
                        "ghost_wake": ghost_wake[i],
                        "refracted_attack_total": refracted_attack_total[i],
                        "core_damage_total": core_damage_total[i],
                    })

    final = pd.DataFrame(history).tail(1).iloc[0].to_dict()
    individual_final = pd.DataFrame([{
        "agent": f"AI-{i+1}",
        "final_persistence": P[i],
        "final_recursive_depth": R[i],
        "final_memory": M[i],
        "final_self_model": S[i],
        "final_prism_integrity": prism_integrity[i],
        "final_prism_heat": prism_heat[i],
        "final_ghost_wake": ghost_wake[i],
        "total_refracted_attack": refracted_attack_total[i],
        "total_core_damage": core_damage_total[i],
        **individual_events[f"AI-{i+1}"]
    } for i in range(N_AGENTS)])
    return milestones, pd.DataFrame(history), final, individual_final, pd.DataFrame(agent_history)

no_m, no_hist, no_final, _, _ = run_world(False, 88831)
ind_m, ind_hist, ind_final, ind_agent_final, ind_agent_hist = run_world(True, 88831)

milestone_summary = pd.DataFrame(
    [{"condition": "No Prism", "milestone": k, "cycle_reached": v} for k, v in no_m.items()] +
    [{"condition": "Individual Prism", "milestone": k, "cycle_reached": v} for k, v in ind_m.items()]
)

final_comparison = pd.DataFrame([
    {"metric": k, "no_prism": no_final.get(k), "individual_prism": ind_final.get(k)}
    for k in [
        "avg_persistence", "avg_recursive_depth", "avg_memory", "avg_self_model",
        "agency", "coordination", "culture", "technology", "conflict",
        "resource_efficiency", "mean_prism_integrity", "min_prism_integrity",
        "total_prism_heat", "total_ghost_wake", "total_refracted_attack", "total_core_damage"
    ]
])

history_all = pd.concat([no_hist, ind_hist], ignore_index=True)

out_dir = Path("/mnt/data")
milestone_path = out_dir / "dt_individual_prism_milestone_summary.csv"
comparison_path = out_dir / "dt_individual_prism_final_comparison.csv"
agent_final_path = out_dir / "dt_individual_prism_agent_final.csv"
history_path = out_dir / "dt_individual_prism_history.csv"
agent_history_path = out_dir / "dt_individual_prism_agent_history.csv"

milestone_summary.to_csv(milestone_path, index=False)
final_comparison.to_csv(comparison_path, index=False)
ind_agent_final.to_csv(agent_final_path, index=False)
history_all.to_csv(history_path, index=False)
ind_agent_hist.to_csv(agent_history_path, index=False)

print("Milestone summary:")
print(milestone_summary)
print("\nFinal comparison:")
print(final_comparison)
print("\nIndividual AI final:")
print(ind_agent_final)
print("\nSaved files:")
print(milestone_path)
print(comparison_path)
print(agent_final_path)
print(history_path)
print(agent_history_path)
