import numpy as np
import pandas as pd
from pathlib import Path

# ============================================================
# DT Self-Realization Loop v1.0
# ============================================================
# Runs recursive correction cycles until >10 consecutive no-change events.
#
# "Change" means a meaningful improvement in:
# - mean error
# - singularity index
# - tight viability
# - accessibility preservation
#
# Each cycle:
# 1. Test current branch state.
# 2. Diagnose the dominant failure/realization.
# 3. Apply the corresponding correction rule.
# 4. Rerun.
#
# This is a meta-simulation of recursive self-correction, not physical proof.

rng = np.random.default_rng(20260522)

branches = [
    "lithium_BBN",
    "black_hole",
    "AI_agency",
    "prism_defense",
    "biology",
    "institutional",
    "thermo_diffusion",
    "quantum_threshold"
]

features = ["L", "W", "K", "V", "C", "A"]
N = len(branches)

# Start from previous singularity-attempt final states.
state = pd.DataFrame({
    "branch": branches,
    "L": [0.876180,0.832212,0.733477,0.847229,0.718581,0.690004,0.632517,0.790434],
    "W": [0.849746,0.805779,0.721329,0.763525,0.820745,0.706428,0.734655,0.778286],
    "K": [0.733762,0.847823,0.805036,0.791411,0.762763,0.734186,0.662413,0.820330],
    "V": [0.558056,0.650688,0.491709,0.522720,0.509925,0.594231,0.701719,0.608910],
    "C": [0.769753,0.811500,0.712765,0.797946,0.683583,0.783614,0.626090,0.755436],
    "A": [0.641306,0.591952,0.812580,0.756099,0.713191,0.684588,0.669958,0.699304],
})

targets = pd.DataFrame({
    "branch": branches,
    "L": [0.92, 0.86, 0.72, 0.88, 0.70, 0.66, 0.58, 0.80],
    "W": [0.88, 0.82, 0.70, 0.76, 0.84, 0.68, 0.72, 0.78],
    "K": [0.72, 0.88, 0.82, 0.80, 0.76, 0.72, 0.62, 0.84],
    "V": [0.55, 0.68, 0.45, 0.50, 0.48, 0.60, 0.75, 0.62],
    "C": [0.78, 0.84, 0.70, 0.82, 0.66, 0.80, 0.58, 0.76],
    "A": [0.62, 0.54, 0.86, 0.78, 0.72, 0.68, 0.66, 0.70],
})

idx = {b:i for i,b in enumerate(branches)}

# Base learned coupling network.
M_base = np.zeros((N,N))
def couple(M, a,b,w):
    M[idx[a], idx[b]] += w
    M[idx[b], idx[a]] += w*0.65

couple(M_base,"lithium_BBN", "biology", 0.18)
couple(M_base,"lithium_BBN", "black_hole", 0.12)
couple(M_base,"black_hole", "quantum_threshold", 0.18)
couple(M_base,"AI_agency", "prism_defense", 0.20)
couple(M_base,"AI_agency", "institutional", 0.14)
couple(M_base,"thermo_diffusion", "black_hole", 0.10)
couple(M_base,"thermo_diffusion", "lithium_BBN", 0.10)
couple(M_base,"institutional", "prism_defense", 0.12)

# Realization rules that can be activated.
rules = {
    "freeze_out_protection": 0.0,
    "localization_priority": 0.0,
    "do_no_harm": 0.0,
    "accessibility_preservation": 0.0,
    "weaken_global_coherence": 0.0,
    "branch_differentiation": 0.0,
    "threshold_saturation": 0.0,
}

def branch_error(s):
    return np.sqrt(((s[features].to_numpy() - targets[features].to_numpy())**2).mean(axis=1))

def compute_metrics(s, correction_norm=0.0):
    err = branch_error(s)
    mat = s[features].to_numpy()
    spread = np.std(mat, axis=0).mean()
    access = s["A"].mean()*0.55 + s["V"].mean()*0.45
    tight = int((err < 0.05).sum())
    ultra = int((err < 0.02).sum())
    singular = int((err < 0.015).sum())
    spread_term = np.exp(-abs(spread - 0.06)/0.04)
    error_term = np.exp(-err.mean()/0.012)
    corr_term = np.exp(-correction_norm/0.004)
    access_term = 1/(1+np.exp(-(access-0.55)*20))
    singularity_index = error_term * corr_term * spread_term * access_term
    return {
        "mean_error": float(err.mean()),
        "max_error": float(err.max()),
        "parameter_spread": float(spread),
        "accessibility": float(access),
        "tight_viable": tight,
        "ultra_viable": ultra,
        "singularity_viable": singular,
        "singularity_index": float(singularity_index),
        "correction_norm": float(correction_norm),
    }

def diagnose(s, previous_metrics=None):
    err = branch_error(s)
    mat = s[features].to_numpy()
    spread = np.std(mat, axis=0).mean()
    access = s["A"].mean()*0.55 + s["V"].mean()*0.45
    
    worst_i = int(np.argmax(err))
    worst_branch = branches[worst_i]
    
    # Diagnose by dominant pattern.
    if spread < 0.045:
        return "overcollapse", "Preserve branch differentiation; singularity is not zero spread.", worst_branch
    if access < 0.60:
        return "accessibility_low", "Preserve accessibility; dead convergence is collapse.", worst_branch
    if worst_branch in ["lithium_BBN", "biology"] and err[worst_i] > 0.02:
        return "freezeout", "Persistence must include timing/pathway closure, not only stability.", worst_branch
    if worst_branch in ["black_hole", "quantum_threshold"] and err[worst_i] > 0.02:
        return "threshold", "Singularity-like branches need saturation, not stronger compression.", worst_branch
    if worst_branch in ["AI_agency", "prism_defense", "institutional"] and err[worst_i] > 0.02:
        return "localization", "Recursive systems improve through localized correction, not global pressure.", worst_branch
    if previous_metrics and previous_metrics["mean_error"] <= compute_metrics(s)["mean_error"] + 0.0001:
        return "do_no_harm", "Near convergence, correction must weaken or rollback.", worst_branch
    return "micro_adjust", "Only surgical branch-specific micro-corrections remain.", worst_branch

def apply_cycle(s, cycle, diagnosis, worst_branch):
    current = s[features].to_numpy()
    target = targets[features].to_numpy()
    err_vec = target - current
    errors = branch_error(s)
    
    M = M_base.copy()
    # Update rule activations.
    if diagnosis == "freezeout":
        rules["freeze_out_protection"] += 0.15
    elif diagnosis == "localization":
        rules["localization_priority"] += 0.15
    elif diagnosis == "threshold":
        rules["threshold_saturation"] += 0.15
    elif diagnosis == "accessibility_low":
        rules["accessibility_preservation"] += 0.15
    elif diagnosis == "overcollapse":
        rules["branch_differentiation"] += 0.15
        rules["weaken_global_coherence"] += 0.10
    elif diagnosis == "do_no_harm":
        rules["do_no_harm"] += 0.20
    else:
        # micro-adjust means no large new rule.
        pass
    
    # Saturate rule strengths.
    for k in rules:
        rules[k] = min(rules[k], 1.0)
    
    # Adaptive controls learned from rules.
    base_learning = 0.024 * (1 - 0.55*rules["do_no_harm"])
    localization_gain = 1 + 0.65*rules["localization_priority"]
    cross_scale = 0.014 * (1 - 0.55*rules["weaken_global_coherence"])
    coherence_strength = 0.004 * (1 - 0.75*rules["branch_differentiation"])
    noise = max(0.00008, 0.0012 * (0.94 ** cycle))
    
    direct = base_learning * err_vec
    
    # Localize correction to worst branch and its nearest coupled partners.
    local_weights = np.ones((N,1)) * (0.35 + 0.65*(1-rules["localization_priority"]))
    local_weights[branches.index(worst_branch)] = localization_gain
    direct = direct * local_weights
    
    pressure = M @ (errors - errors.mean())
    cross = cross_scale * pressure[:, None] * np.sign(err_vec)
    
    centroid = current.mean(axis=0)
    coherence = -coherence_strength * (current - centroid)
    
    # Accessibility preservation
    access_push = np.zeros_like(current)
    A_i = features.index("A")
    V_i = features.index("V")
    access_push[:, A_i] = np.maximum(0, 0.64 - current[:, A_i]) * (0.006 + 0.012*rules["accessibility_preservation"])
    access_push[:, V_i] = np.maximum(0, 0.54 - current[:, V_i]) * (0.004 + 0.010*rules["accessibility_preservation"])
    
    # Threshold saturation: black_hole and quantum move less aggressively in compression variables.
    saturation = np.ones_like(current)
    for b in ["black_hole","quantum_threshold"]:
        bi = branches.index(b)
        saturation[bi, :] *= (1 - 0.35*rules["threshold_saturation"])
    direct *= saturation
    
    # Freeze-out/pathway closure: lithium and biology become more timing-window aligned (W) and less volatility-overcorrected.
    freeze = np.zeros_like(current)
    if rules["freeze_out_protection"] > 0:
        for b in ["lithium_BBN", "biology"]:
            bi = branches.index(b)
            W_i = features.index("W")
            V_i = features.index("V")
            freeze[bi, W_i] += 0.006 * rules["freeze_out_protection"] * np.sign(target[bi,W_i]-current[bi,W_i])
            freeze[bi, V_i] += 0.003 * rules["freeze_out_protection"] * np.sign(target[bi,V_i]-current[bi,V_i])
    
    # Branch differentiation prevents collapse into identical states.
    differentiation = np.zeros_like(current)
    if rules["branch_differentiation"] > 0:
        differentiation += 0.004 * rules["branch_differentiation"] * (current - centroid)
    
    random = rng.normal(0, noise, current.shape)
    update = direct + cross + coherence + access_push + freeze + differentiation + random
    
    proposal = np.clip(current + update, 0, 1)
    return proposal, float(np.sqrt((update**2).mean())), dict(rules)

max_cycles = 500
no_change_events = 0
cycle_rows = []
realization_rows = []
previous_metrics = compute_metrics(state)
best_state = state.copy()
best_score = previous_metrics["singularity_index"] - previous_metrics["mean_error"]
best_metrics = previous_metrics.copy()

for cycle in range(1, max_cycles+1):
    diagnosis, realization, worst_branch = diagnose(state, previous_metrics)
    proposal, correction_norm, active_rules = apply_cycle(state, cycle, diagnosis, worst_branch)
    
    old_state = state.copy()
    old_metrics = compute_metrics(state)
    state.loc[:, features] = proposal
    new_metrics = compute_metrics(state, correction_norm)
    
    # do-no-harm at meta level
    old_score = old_metrics["singularity_index"] - old_metrics["mean_error"]
    new_score = new_metrics["singularity_index"] - new_metrics["mean_error"]
    changed = False
    
    if new_score < old_score - 0.0002:
        # rollback / half-step
        half = old_state[features].to_numpy() + 0.25*(proposal - old_state[features].to_numpy())
        state.loc[:, features] = np.clip(half, 0, 1)
        new_metrics = compute_metrics(state, correction_norm*0.25)
        new_score = new_metrics["singularity_index"] - new_metrics["mean_error"]
        if new_score < old_score - 0.0002:
            state = old_state
            new_metrics = old_metrics
            correction_norm = 0.0
            rules["do_no_harm"] = min(1.0, rules["do_no_harm"] + 0.05)
    
    # Determine meaningful change
    improvement = old_metrics["mean_error"] - new_metrics["mean_error"]
    singularity_gain = new_metrics["singularity_index"] - old_metrics["singularity_index"]
    viable_gain = new_metrics["ultra_viable"] - old_metrics["ultra_viable"]
    changed = (improvement > 0.00015) or (singularity_gain > 0.002) or (viable_gain > 0)
    
    if changed:
        no_change_events = 0
    else:
        no_change_events += 1
    
    current_score = new_metrics["singularity_index"] - new_metrics["mean_error"]
    if current_score > best_score:
        best_score = current_score
        best_state = state.copy()
        best_metrics = new_metrics.copy()
    
    cycle_rows.append({
        "cycle": cycle,
        "diagnosis": diagnosis,
        "realization": realization,
        "worst_branch": worst_branch,
        "mean_error": new_metrics["mean_error"],
        "max_error": new_metrics["max_error"],
        "singularity_index": new_metrics["singularity_index"],
        "accessibility": new_metrics["accessibility"],
        "parameter_spread": new_metrics["parameter_spread"],
        "tight_viable": new_metrics["tight_viable"],
        "ultra_viable": new_metrics["ultra_viable"],
        "singularity_viable": new_metrics["singularity_viable"],
        "correction_norm": correction_norm,
        "improvement": improvement,
        "singularity_gain": singularity_gain,
        "changed": changed,
        "no_change_events": no_change_events,
        **{f"rule_{k}": v for k,v in active_rules.items()}
    })
    
    realization_rows.append({
        "cycle": cycle,
        "diagnosis": diagnosis,
        "new_realization": realization,
        "applied_change": ", ".join([k for k,v in active_rules.items() if v > 0.01]) or "micro-adjust only",
        "changed": changed,
        "no_change_events": no_change_events
    })
    
    previous_metrics = new_metrics
    
    if no_change_events > 10:
        break

cycles_df = pd.DataFrame(cycle_rows)
realizations_df = pd.DataFrame(realization_rows)

final_state = state.copy()
final_state["error"] = branch_error(state)
final_state["tight_viable"] = final_state["error"] < 0.05
final_state["ultra_viable"] = final_state["error"] < 0.02
final_state["singularity_viable"] = final_state["error"] < 0.015

best_state_out = best_state.copy()
best_state_out["error"] = branch_error(best_state)
best_state_out["tight_viable"] = best_state_out["error"] < 0.05
best_state_out["ultra_viable"] = best_state_out["error"] < 0.02
best_state_out["singularity_viable"] = best_state_out["error"] < 0.015

summary = pd.DataFrame([{
    "cycles_run": len(cycles_df),
    "stop_reason": ">10 consecutive no-change events" if no_change_events > 10 else "max cycles reached",
    "final_no_change_events": no_change_events,
    "initial_mean_error": cycles_df["mean_error"].iloc[0] if not cycles_df.empty else np.nan,
    "final_mean_error": compute_metrics(state)["mean_error"],
    "best_mean_error": best_metrics["mean_error"],
    "final_singularity_index": compute_metrics(state)["singularity_index"],
    "best_singularity_index": best_metrics["singularity_index"],
    "final_tight_viable": int(final_state["tight_viable"].sum()),
    "final_ultra_viable": int(final_state["ultra_viable"].sum()),
    "final_singularity_viable": int(final_state["singularity_viable"].sum()),
    "best_tight_viable": int(best_state_out["tight_viable"].sum()),
    "best_ultra_viable": int(best_state_out["ultra_viable"].sum()),
    "best_singularity_viable": int(best_state_out["singularity_viable"].sum()),
    "active_rules_final": ", ".join([f"{k}:{v:.2f}" for k,v in rules.items() if v > 0]),
    "interpretation": "Recursive self-realization loop stopped after correction exhaustion/no-change."
}])

# Condense unique insights
unique_realizations = realizations_df.drop_duplicates("diagnosis").copy()

out = Path("/mnt/data")
cycles_path = out/"dt_self_realization_cycles.csv"
realizations_path = out/"dt_self_realization_realizations.csv"
final_path = out/"dt_self_realization_final_state.csv"
best_path = out/"dt_self_realization_best_state.csv"
summary_path = out/"dt_self_realization_summary.csv"
unique_path = out/"dt_self_realization_unique_realizations.csv"

cycles_df.to_csv(cycles_path, index=False)
realizations_df.to_csv(realizations_path, index=False)
final_state.to_csv(final_path, index=False)
best_state_out.to_csv(best_path, index=False)
summary.to_csv(summary_path, index=False)
unique_realizations.to_csv(unique_path, index=False)

print("SUMMARY")
print(summary.to_string(index=False))
print("\nUNIQUE REALIZATIONS")
print(unique_realizations[["diagnosis","new_realization","applied_change"]].to_string(index=False))
print("\nFINAL STATE")
print(final_state[["branch","L","W","K","V","C","A","error","tight_viable","ultra_viable","singularity_viable"]].to_string(index=False))
print("\nBEST STATE")
print(best_state_out[["branch","error","tight_viable","ultra_viable","singularity_viable"]].to_string(index=False))
print("\nSaved:")
for p in [cycles_path, realizations_path, final_path, best_path, summary_path, unique_path]:
    print(p)
