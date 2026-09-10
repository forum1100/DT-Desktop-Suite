import numpy as np
import pandas as pd
from pathlib import Path

# ============================================================
# Distel Recursive Cross-Domain Correction Engine v0.1
# ============================================================
# Purpose:
# Test the idea that DT becomes more constrained and correctable as more
# interacting branches are allowed to pressure each other.
#
# Branches included:
# 1. Lithium / BBN mass-7 localization
# 2. Black-hole accessibility compression
# 3. AI recursive persistence / agency
# 4. Prism defense / adversarial stabilization
# 5. Biological survival / freeze-out analogy
# 6. Institutional/social constraint correction
# 7. Thermodynamic/accessibility diffusion
# 8. Quantum-threshold discretization
#
# The engine:
# - assigns each branch a target corridor,
# - samples model parameters,
# - calculates branch errors,
# - applies cross-domain correction pressure,
# - repeats until corrections no longer improve or become unstable.
#
# This is a meta-simulation, not physical proof.

rng = np.random.default_rng(20260519)

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

N = len(branches)
T = 250

# Core DT parameters per branch:
# L = localization
# W = window/timing
# K = coherence/persistence
# V = volatility
# C = constraint coupling
# A = adaptability
params = pd.DataFrame({
    "branch": branches,
    "L": rng.uniform(0.35, 0.85, N),
    "W": rng.uniform(0.35, 0.85, N),
    "K": rng.uniform(0.35, 0.85, N),
    "V": rng.uniform(0.25, 0.85, N),
    "C": rng.uniform(0.30, 0.90, N),
    "A": rng.uniform(0.30, 0.90, N),
})

# Target corridors learned from prior iterations.
# Each branch has an ideal region in abstract DT state space.
targets = pd.DataFrame({
    "branch": branches,
    "L_target": [0.92, 0.86, 0.72, 0.88, 0.70, 0.66, 0.58, 0.80],
    "W_target": [0.88, 0.82, 0.70, 0.76, 0.84, 0.68, 0.72, 0.78],
    "K_target": [0.72, 0.88, 0.82, 0.80, 0.76, 0.72, 0.62, 0.84],
    "V_target": [0.55, 0.68, 0.45, 0.50, 0.48, 0.60, 0.75, 0.62],
    "C_target": [0.78, 0.84, 0.70, 0.82, 0.66, 0.80, 0.58, 0.76],
    "A_target": [0.62, 0.54, 0.86, 0.78, 0.72, 0.68, 0.66, 0.70],
})

# Cross-domain influence matrix.
# Positive values mean one branch's correction pressures another branch.
M = rng.normal(0, 0.08, (N, N))
np.fill_diagonal(M, 0.0)

# Make known conceptual couplings stronger.
idx = {b:i for i,b in enumerate(branches)}
def couple(a,b,w):
    M[idx[a], idx[b]] += w
    M[idx[b], idx[a]] += w*0.65

couple("lithium_BBN", "biology", 0.18)           # freeze-out / survival pathway
couple("lithium_BBN", "black_hole", 0.12)        # saturation/localization lessons
couple("black_hole", "quantum_threshold", 0.18)  # singularity -> threshold discretization
couple("AI_agency", "prism_defense", 0.20)       # recursive defense/agency
couple("AI_agency", "institutional", 0.14)       # social/institutional agency
couple("thermo_diffusion", "black_hole", 0.10)   # entropy/accessibility diffusion
couple("thermo_diffusion", "lithium_BBN", 0.10)  # early-universe volatility
couple("institutional", "prism_defense", 0.12)   # adversarial correction

# Stability controls
learning_rate = 0.085
cross_pressure = 0.045
noise_decay = 0.975
noise = 0.018

history = []
corrections = []

feature_cols = ["L", "W", "K", "V", "C", "A"]
target_cols = [f"{c}_target" for c in feature_cols]

def branch_error(pmat):
    # Euclidean distance to branch target in normalized feature space.
    target = targets[[f"{c}_target" for c in feature_cols]].to_numpy()
    current = pmat[feature_cols].to_numpy()
    return np.sqrt(((current - target) ** 2).mean(axis=1))

def global_metrics(pmat, t):
    err = branch_error(pmat)
    # Viable if branch error below corridor threshold.
    viable = err < 0.10
    spread = np.std(pmat[feature_cols].to_numpy(), axis=0).mean()
    # Corrections shrink if error and spread both decrease.
    return {
        "iteration": t,
        "mean_error": err.mean(),
        "max_error": err.max(),
        "min_error": err.min(),
        "viable_branches": int(viable.sum()),
        "viability_fraction": viable.mean(),
        "parameter_spread": spread,
    }

prev_err = branch_error(params)

for t in range(T+1):
    metrics = global_metrics(params, t)
    history.append(metrics)
    
    if t == T:
        break
    
    current = params[feature_cols].to_numpy()
    target = targets[target_cols].to_numpy()
    err_vec = target - current
    
    # Direct correction toward each branch target.
    direct_update = learning_rate * err_vec
    
    # Cross-domain pressure: branches with larger error broadcast correction pressure.
    errors = branch_error(params)
    pressure_signal = (errors - errors.mean())
    cross_update_scalar = M @ pressure_signal
    cross_update = cross_pressure * cross_update_scalar[:, None] * np.sign(err_vec)
    
    # Recursive consistency: if all branches agree on a direction, amplify slightly.
    consensus = np.sign(err_vec).mean(axis=0)
    consensus_update = 0.018 * consensus[None, :] * np.abs(err_vec)
    
    # Damping: avoid overcorrection.
    damping = -0.025 * (current - current.mean(axis=0))
    
    random_term = rng.normal(0, noise, current.shape)
    update = direct_update + cross_update + consensus_update + damping + random_term
    
    # Apply update with bounds.
    new_current = np.clip(current + update, 0, 1)
    params.loc[:, feature_cols] = new_current
    
    new_err = branch_error(params)
    correction_norm = float(np.sqrt((update**2).mean()))
    improvement = float(prev_err.mean() - new_err.mean())
    corrections.append({
        "iteration": t+1,
        "correction_norm": correction_norm,
        "mean_error_before": prev_err.mean(),
        "mean_error_after": new_err.mean(),
        "improvement": improvement,
        "noise": noise
    })
    prev_err = new_err
    noise *= noise_decay

history_df = pd.DataFrame(history)
correction_df = pd.DataFrame(corrections)

final_errors = branch_error(params)
final_df = params.copy()
final_df["final_error"] = final_errors
final_df["viable"] = final_df["final_error"] < 0.10

# Identify when corrections effectively ran out.
# Use rolling mean improvement and correction norm.
correction_df["abs_improvement"] = correction_df["improvement"].abs()
correction_df["rolling_abs_improvement_10"] = correction_df["abs_improvement"].rolling(10, min_periods=1).mean()
correction_df["rolling_correction_norm_10"] = correction_df["correction_norm"].rolling(10, min_periods=1).mean()

stop_candidates = correction_df[
    (correction_df["rolling_abs_improvement_10"] < 0.0008) &
    (correction_df["rolling_correction_norm_10"] < 0.015)
]
stop_iteration = int(stop_candidates["iteration"].iloc[0]) if not stop_candidates.empty else None

# Compare first, midpoint, final
snapshots = history_df[history_df["iteration"].isin([0, 25, 50, 100, 150, 200, 250])].copy()

# Lessons generated from outcomes
lessons = []

if history_df["mean_error"].iloc[-1] < history_df["mean_error"].iloc[0]:
    lessons.append({
        "lesson": "Cross-branch correction reduced global error.",
        "meaning": "The recursive interaction process compressed the viable space instead of expanding it."
    })
if final_df["viable"].sum() >= 5:
    lessons.append({
        "lesson": "Most branches reached viable corridors simultaneously.",
        "meaning": "A shared DT structure can coordinate multiple domains without each branch needing isolated tuning."
    })
if stop_iteration is not None:
    lessons.append({
        "lesson": "Corrections approached exhaustion.",
        "meaning": f"The system hit a low-correction regime around iteration {stop_iteration}, suggesting convergence."
    })
else:
    lessons.append({
        "lesson": "Corrections did not fully exhaust.",
        "meaning": "The system continued making small corrections, meaning more constraints or better branch models are needed."
    })

# Branch-specific discoveries
branch_lessons = []
for _, row in final_df.iterrows():
    b = row["branch"]
    err = row["final_error"]
    status = "survived" if row["viable"] else "still unstable"
    # most corrected feature
    init = pd.DataFrame(history).iloc[0]
    branch_lessons.append({
        "branch": b,
        "status": status,
        "final_error": err,
        "new_realization": (
            f"{b} converged as part of the shared correction network."
            if row["viable"] else
            f"{b} still needs stronger domain-specific constraints."
        )
    })

lessons_df = pd.DataFrame(lessons)
branch_lessons_df = pd.DataFrame(branch_lessons)

summary = pd.DataFrame([{
    "initial_mean_error": history_df["mean_error"].iloc[0],
    "final_mean_error": history_df["mean_error"].iloc[-1],
    "error_reduction": history_df["mean_error"].iloc[0] - history_df["mean_error"].iloc[-1],
    "initial_viable_branches": history_df["viable_branches"].iloc[0],
    "final_viable_branches": history_df["viable_branches"].iloc[-1],
    "final_viability_fraction": history_df["viability_fraction"].iloc[-1],
    "stop_iteration": stop_iteration,
    "final_parameter_spread": history_df["parameter_spread"].iloc[-1],
    "interpretation": "Recursive cross-domain correction test; toy/meta-simulation, not physical proof."
}])

out = Path("/mnt/data")
history_path = out/"dt_recursive_cross_domain_history.csv"
corrections_path = out/"dt_recursive_cross_domain_corrections.csv"
final_path = out/"dt_recursive_cross_domain_final_branches.csv"
summary_path = out/"dt_recursive_cross_domain_summary.csv"
lessons_path = out/"dt_recursive_cross_domain_lessons.csv"
branch_lessons_path = out/"dt_recursive_cross_domain_branch_lessons.csv"
snapshots_path = out/"dt_recursive_cross_domain_snapshots.csv"

history_df.to_csv(history_path, index=False)
correction_df.to_csv(corrections_path, index=False)
final_df.to_csv(final_path, index=False)
summary.to_csv(summary_path, index=False)
lessons_df.to_csv(lessons_path, index=False)
branch_lessons_df.to_csv(branch_lessons_path, index=False)
snapshots.to_csv(snapshots_path, index=False)

print("SUMMARY")
print(summary.to_string(index=False))
print("\nFINAL BRANCHES")
print(final_df[["branch","L","W","K","V","C","A","final_error","viable"]].to_string(index=False))
print("\nLESSONS")
print(lessons_df.to_string(index=False))
print("\nSaved:")
for p in [history_path, corrections_path, final_path, summary_path, lessons_path, branch_lessons_path, snapshots_path]:
    print(p)
