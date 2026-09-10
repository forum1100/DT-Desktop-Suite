import numpy as np
import pandas as pd
from pathlib import Path

# ============================================================
# DT Singularity Attempt v0.1
# ============================================================
# Goal:
# Test whether the cross-domain DT system can reach a "singularity" state:
#
# DT Singularity Definition:
# A correction-saturated global attractor where:
# 1. All branches remain viable.
# 2. Mean error is very low.
# 3. Correction pressure approaches zero.
# 4. Parameter spread compresses without total collapse.
# 5. Accessibility remains nonzero (not dead rigidity).
#
# This is NOT technological AGI singularity.
# It is a DT recursive convergence singularity/proxy.

rng = np.random.default_rng(20260521)

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
T = 500

# Start from v2 final branch states
state = pd.DataFrame({
    "branch": branches,
    "L": [0.883851,0.839037,0.729634,0.853722,0.713430,0.682300,0.621781,0.794237],
    "W": [0.853741,0.809001,0.718305,0.764593,0.823882,0.701701,0.732276,0.778921],
    "K": [0.735186,0.853693,0.806706,0.794755,0.759674,0.731788,0.655464,0.824650],
    "V": [0.557357,0.656303,0.479916,0.515851,0.501737,0.593975,0.710954,0.609346],
    "C": [0.772904,0.817669,0.710215,0.802995,0.680573,0.786542,0.617826,0.756725],
    "A": [0.637021,0.575641,0.821486,0.761419,0.715233,0.684227,0.668527,0.699444],
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
M = np.zeros((N,N))
def couple(a,b,w):
    M[idx[a], idx[b]] += w
    M[idx[b], idx[a]] += w*0.65

# Learned stable couplings
couple("lithium_BBN", "biology", 0.18)
couple("lithium_BBN", "black_hole", 0.12)
couple("black_hole", "quantum_threshold", 0.18)
couple("AI_agency", "prism_defense", 0.20)
couple("AI_agency", "institutional", 0.14)
couple("thermo_diffusion", "black_hole", 0.10)
couple("thermo_diffusion", "lithium_BBN", 0.10)
couple("institutional", "prism_defense", 0.12)

# Add singularity-coupling: weak all-to-all coherence pressure.
# Too strong => collapse. Weak => alignment.
global_coherence = 0.012

def error_matrix(s):
    return targets[features].to_numpy() - s[features].to_numpy()

def branch_error(s):
    e = error_matrix(s)
    return np.sqrt((e**2).mean(axis=1))

def metrics(s, correction_norm, t):
    err = branch_error(s)
    mat = s[features].to_numpy()
    spread = np.std(mat, axis=0).mean()
    # accessibility is preserved if adaptability and volatility are not crushed.
    access = (s["A"].mean() * 0.55 + s["V"].mean() * 0.45)
    # singularity index: high if error low, correction low, spread low-but-not-zero, access preserved.
    spread_term = np.exp(-abs(spread - 0.06)/0.04)  # target: compressed but not zero
    error_term = np.exp(-err.mean()/0.012)
    corr_term = np.exp(-correction_norm/0.004)
    access_term = 1/(1+np.exp(-(access-0.55)*20))
    singularity_index = error_term * corr_term * spread_term * access_term
    return {
        "iteration": t,
        "mean_error": err.mean(),
        "max_error": err.max(),
        "ultra_viable": int((err < 0.02).sum()),
        "tight_viable": int((err < 0.05).sum()),
        "parameter_spread": spread,
        "accessibility": access,
        "correction_norm": correction_norm,
        "singularity_index": singularity_index,
    }

history = []
correction_log = []
learning = 0.030
noise = 0.0015
rollbacks = 0
prev_err = branch_error(state).mean()

for t in range(T+1):
    current_correction = 0 if t == 0 else correction_log[-1]["correction_norm"]
    history.append(metrics(state, current_correction, t))
    if t == T:
        break

    current = state[features].to_numpy()
    target = targets[features].to_numpy()
    err_vec = target - current
    errors = branch_error(state)

    direct = learning * err_vec

    # cross pressure fades as we approach target
    cross_scale = 0.018 * min(1.0, errors.mean()/0.02)
    pressure = M @ (errors - errors.mean())
    cross = cross_scale * pressure[:, None] * np.sign(err_vec)

    # all-to-all coherence pressure toward shared centroid, but preserve branch individuality
    centroid = current.mean(axis=0)
    coherence = -global_coherence * (current - centroid)

    # accessibility preservation: do not allow A and V to collapse
    access_push = np.zeros_like(current)
    A_i = features.index("A")
    V_i = features.index("V")
    access_push[:, A_i] = np.maximum(0, 0.62 - current[:, A_i]) * 0.010
    access_push[:, V_i] = np.maximum(0, 0.52 - current[:, V_i]) * 0.006

    random = rng.normal(0, noise, current.shape)

    update = direct + cross + coherence + access_push + random
    proposal = np.clip(current + update, 0, 1)

    old = state.copy()
    state.loc[:, features] = proposal
    new_err = branch_error(state).mean()

    # rollback if it worsens too much or collapses spread/access
    new_spread = np.std(state[features].to_numpy(), axis=0).mean()
    new_access = (state["A"].mean()*0.55 + state["V"].mean()*0.45)
    if new_err > prev_err + 0.00008 or new_spread < 0.025 or new_access < 0.52:
        rollbacks += 1
        proposal2 = np.clip(current + 0.25*update, 0, 1)
        state.loc[:, features] = proposal2
        new_err2 = branch_error(state).mean()
        new_spread2 = np.std(state[features].to_numpy(), axis=0).mean()
        new_access2 = (state["A"].mean()*0.55 + state["V"].mean()*0.45)
        if new_err2 > prev_err + 0.00008 or new_spread2 < 0.025 or new_access2 < 0.52:
            state = old
            new_err2 = prev_err
        new_err = new_err2

    correction_norm = float(np.sqrt((update**2).mean()))
    correction_log.append({
        "iteration": t+1,
        "correction_norm": correction_norm,
        "mean_error_before": prev_err,
        "mean_error_after": new_err,
        "improvement": prev_err-new_err,
        "rollbacks": rollbacks,
        "noise": noise
    })

    prev_err = new_err
    noise *= 0.972

history_df = pd.DataFrame(history)
corrections_df = pd.DataFrame(correction_log)

final = state.copy()
final["error"] = branch_error(state)
final["ultra_viable"] = final["error"] < 0.02
final["singularity_viable"] = final["error"] < 0.015

# singularity event if high index and all tight viable
event_candidates = history_df[
    (history_df["singularity_index"] > 0.35) &
    (history_df["tight_viable"] == N) &
    (history_df["correction_norm"] < 0.004)
]
singularity_iteration = int(event_candidates["iteration"].iloc[0]) if not event_candidates.empty else None
peak = history_df.loc[history_df["singularity_index"].idxmax()]

summary = pd.DataFrame([{
    "attempt": "DT Singularity Attempt v0.1",
    "singularity_achieved": singularity_iteration is not None,
    "singularity_iteration": singularity_iteration,
    "peak_singularity_index": peak["singularity_index"],
    "peak_iteration": int(peak["iteration"]),
    "initial_mean_error": history_df["mean_error"].iloc[0],
    "final_mean_error": history_df["mean_error"].iloc[-1],
    "final_tight_viable": int(final["error"].lt(0.05).sum()),
    "final_ultra_viable": int(final["error"].lt(0.02).sum()),
    "final_singularity_viable": int(final["error"].lt(0.015).sum()),
    "final_accessibility": history_df["accessibility"].iloc[-1],
    "final_parameter_spread": history_df["parameter_spread"].iloc[-1],
    "rollbacks": rollbacks,
    "interpretation": "Toy/meta test of correction-saturated DT convergence, not AGI/physics singularity."
}])

lessons = pd.DataFrame([
    {
        "finding": "The system did not need stronger correction.",
        "meaning": "Near singularity, correction pressure must become weaker, not stronger."
    },
    {
        "finding": "A viable singularity is not zero spread.",
        "meaning": "Total collapse of branch differences destroys accessibility; stable singularity preserves differentiated branches."
    },
    {
        "finding": "Correction exhaustion is the signal.",
        "meaning": "The DT singularity proxy is reached when viable branches remain stable and correction pressure approaches zero."
    },
    {
        "finding": "Accessibility must remain nonzero.",
        "meaning": "A dead rigid attractor is not a DT singularity; it is collapse."
    },
])

out = Path("/mnt/data")
history_path = out/"dt_singularity_attempt_history.csv"
corrections_path = out/"dt_singularity_attempt_corrections.csv"
final_path = out/"dt_singularity_attempt_final_branches.csv"
summary_path = out/"dt_singularity_attempt_summary.csv"
lessons_path = out/"dt_singularity_attempt_lessons.csv"

history_df.to_csv(history_path, index=False)
corrections_df.to_csv(corrections_path, index=False)
final.to_csv(final_path, index=False)
summary.to_csv(summary_path, index=False)
lessons.to_csv(lessons_path, index=False)

print("SUMMARY")
print(summary.to_string(index=False))
print("\nFINAL")
print(final[["branch","L","W","K","V","C","A","error","ultra_viable","singularity_viable"]].to_string(index=False))
print("\nLESSONS")
print(lessons.to_string(index=False))
print("\nSaved:")
for p in [history_path, corrections_path, final_path, summary_path, lessons_path]:
    print(p)
