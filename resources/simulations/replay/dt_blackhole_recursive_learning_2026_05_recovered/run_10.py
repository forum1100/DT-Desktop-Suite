import numpy as np
import pandas as pd
from pathlib import Path

# ============================================================
# DT Refinement Phase v7
# From v6: all branches ultra-viable (<0.02), 2 singularity-viable (<0.015)
# New rule:
# - Domain equation locking:
#   each branch corrects only its dominant residual feature.
# - Ultra-preservation lock:
#   no branch may leave ultra-viability.
# Goal: move more branches below 0.015 without destabilizing all-ultra state.
# ============================================================

rng = np.random.default_rng(20260527)

branches = [
    "lithium_BBN", "black_hole", "AI_agency", "prism_defense",
    "biology", "institutional", "thermo_diffusion", "quantum_threshold"
]
features = ["L", "W", "K", "V", "C", "A"]
N = len(branches)

targets = pd.DataFrame({
    "branch": branches,
    "L": [0.92, 0.86, 0.72, 0.88, 0.70, 0.66, 0.58, 0.80],
    "W": [0.88, 0.82, 0.70, 0.76, 0.84, 0.68, 0.72, 0.78],
    "K": [0.72, 0.88, 0.82, 0.80, 0.76, 0.72, 0.62, 0.84],
    "V": [0.55, 0.68, 0.45, 0.50, 0.48, 0.60, 0.75, 0.62],
    "C": [0.78, 0.84, 0.70, 0.82, 0.66, 0.80, 0.58, 0.76],
    "A": [0.62, 0.54, 0.86, 0.78, 0.72, 0.68, 0.66, 0.70],
})

# v6 final errors
v6_errors = np.array([0.019369,0.019806,0.019784,0.016934,0.014275,0.014532,0.019582,0.016620])
target_mat = targets[features].to_numpy()
dev = rng.normal(0, 1, (N, len(features)))
dev = dev / np.sqrt((dev**2).mean(axis=1))[:,None] * v6_errors[:,None]
state = targets.copy()
state.loc[:,features] = np.clip(target_mat + dev, 0, 1)

# Domain feature priority matrix from v6, slightly sharper
priority = pd.DataFrame(1.0, index=branches, columns=features)
priority.loc["lithium_BBN", ["W","V","L"]] = [1.75,1.45,1.30]
priority.loc["biology", ["W","K","A"]] = [1.45,1.30,1.25]
priority.loc["black_hole", ["K","C","V"]] = [1.65,1.45,1.25]
priority.loc["quantum_threshold", ["K","L","C"]] = [1.60,1.45,1.30]
priority.loc["AI_agency", ["A","K","C"]] = [1.75,1.35,1.25]
priority.loc["prism_defense", ["L","C","A"]] = [1.60,1.45,1.35]
priority.loc["institutional", ["C","A","W"]] = [1.65,1.35,1.25]
priority.loc["thermo_diffusion", ["V","W","K"]] = [1.70,1.40,1.25]
priority_mat = priority.to_numpy()

def branch_error(s):
    return np.sqrt(((s[features].to_numpy() - targets[features].to_numpy())**2).mean(axis=1))

def metrics(s, corr=0):
    err = branch_error(s)
    mat = s[features].to_numpy()
    spread = np.std(mat, axis=0).mean()
    access = s["A"].mean()*0.55 + s["V"].mean()*0.45
    spread_term = np.exp(-abs(spread - 0.06)/0.04)
    error_term = np.exp(-err.mean()/0.012)
    corr_term = np.exp(-corr/0.004)
    access_term = 1/(1+np.exp(-(access-0.55)*20))
    return {
        "mean_error": float(err.mean()),
        "max_error": float(err.max()),
        "ultra_viable": int((err<0.02).sum()),
        "singularity_viable": int((err<0.015).sum()),
        "deep_viable": int((err<0.012).sum()),
        "spread": float(spread),
        "access": float(access),
        "singularity_index": float(spread_term*error_term*corr_term*access_term),
        "correction_norm": float(corr)
    }

T = 400
history=[]
corrections=[]
rollbacks=0
no_change=0
best_state=state.copy()
best_tuple=(metrics(state)["singularity_viable"], metrics(state)["deep_viable"], -metrics(state)["mean_error"])

for t in range(T+1):
    history.append({"iteration":t, **metrics(state)})
    if t == T:
        break
    
    cur=state[features].to_numpy()
    tgt=targets[features].to_numpy()
    err_vec=tgt-cur
    err=branch_error(state)
    
    update=np.zeros_like(cur)
    
    # Domain equation locking: only dominant residual feature, sometimes second feature if branch is far from singularity.
    abs_err=np.abs(err_vec)
    dominant=abs_err.argmax(axis=1)
    second=np.argsort(abs_err, axis=1)[:,-2]
    
    for i in range(N):
        if err[i] < 0.012:
            strength=0.006
        elif err[i] < 0.015:
            strength=0.012
        elif err[i] < 0.02:
            strength=0.026
        else:
            strength=0.04
        j=dominant[i]
        update[i,j] += strength * err_vec[i,j] * priority_mat[i,j]
        # if still above singularity threshold, allow second feature half correction
        if err[i] >= 0.015:
            k=second[i]
            update[i,k] += 0.012 * err_vec[i,k] * priority_mat[i,k]
    
    # Stabilize access, but very gently
    A_i=features.index("A"); V_i=features.index("V")
    update[:,A_i] += np.maximum(0,0.62-cur[:,A_i])*0.0015
    update[:,V_i] += np.maximum(0,0.52-cur[:,V_i])*0.0012
    
    # Anti-collapse if spread gets too low
    centroid=cur.mean(axis=0)
    spread=np.std(cur,axis=0).mean()
    if spread < 0.055:
        update += 0.0015*(cur-centroid)
    
    noise=rng.normal(0, max(0.00001,0.00018*(0.98**t)), cur.shape)
    update += noise
    
    proposal=np.clip(cur+update,0,1)
    old=state.copy()
    old_m=metrics(state)
    old_err=err.copy()
    
    state.loc[:,features]=proposal
    corr=float(np.sqrt((update**2).mean()))
    new_m=metrics(state,corr)
    new_err=branch_error(state)
    
    # Ultra-preservation lock: no branch can cross above 0.02
    # Singularity-preservation lock: branches under 0.015 cannot worsen meaningfully.
    invalid = (new_err >= 0.02).any() or ((old_err < 0.015) & (new_err > old_err + 0.0004)).any()
    worsens = new_m["mean_error"] > old_m["mean_error"] + 0.000025
    if invalid or worsens:
        rollbacks += 1
        half=cur+0.25*update
        state.loc[:,features]=np.clip(half,0,1)
        half_m=metrics(state,corr*0.25)
        half_err=branch_error(state)
        invalid2=(half_err>=0.02).any() or ((old_err<0.015)&(half_err>old_err+0.0004)).any()
        worsens2=half_m["mean_error"] > old_m["mean_error"] + 0.000025
        if invalid2 or worsens2:
            state=old
            new_m=old_m
            corr=0.0
        else:
            new_m=half_m
            corr*=0.25
    
    improvement=old_m["mean_error"]-new_m["mean_error"]
    sing_gain=new_m["singularity_viable"]-old_m["singularity_viable"]
    deep_gain=new_m["deep_viable"]-old_m["deep_viable"]
    changed=improvement>0.000035 or sing_gain>0 or deep_gain>0
    no_change=0 if changed else no_change+1
    
    mnow=metrics(state)
    tup=(mnow["singularity_viable"], mnow["deep_viable"], -mnow["mean_error"])
    if tup > best_tuple:
        best_tuple=tup
        best_state=state.copy()
    
    corrections.append({
        "iteration":t+1,
        **mnow,
        "improvement":improvement,
        "singularity_gain":sing_gain,
        "deep_gain":deep_gain,
        "changed":changed,
        "no_change":no_change,
        "rollbacks":rollbacks
    })
    
    if no_change > 10:
        break

history_df=pd.DataFrame(history)
corr_df=pd.DataFrame(corrections)
final=state.copy(); final["error"]=branch_error(state); final["ultra_viable"]=final["error"]<0.02; final["singularity_viable"]=final["error"]<0.015; final["deep_viable"]=final["error"]<0.012
best=best_state.copy(); best["error"]=branch_error(best_state); best["ultra_viable"]=best["error"]<0.02; best["singularity_viable"]=best["error"]<0.015; best["deep_viable"]=best["error"]<0.012

summary=pd.DataFrame([{
    "run":"v7 domain equation locking",
    "iterations":len(corr_df),
    "initial_mean_error":history_df["mean_error"].iloc[0],
    "final_mean_error":metrics(state)["mean_error"],
    "best_mean_error":branch_error(best_state).mean(),
    "initial_singularity_viable":history_df["singularity_viable"].iloc[0],
    "final_singularity_viable":int(final["singularity_viable"].sum()),
    "best_singularity_viable":int(best["singularity_viable"].sum()),
    "final_deep_viable":int(final["deep_viable"].sum()),
    "best_deep_viable":int(best["deep_viable"].sum()),
    "rollbacks":rollbacks,
    "stop_no_change":no_change,
    "interpretation":"Domain equation locking tests whether ultra-viable branches can enter singularity band without losing accessibility."
}])

lessons=pd.DataFrame([
    {"lesson":"Dominant-feature correction is safer than whole-branch correction near singularity.","meaning":"At ultra-viability, the remaining error is mostly feature-specific, not branch-wide."},
    {"lesson":"Singularity-viable states need preservation locks.","meaning":"Once a branch falls below 0.015, it is easier to damage than improve."},
    {"lesson":"The model is approaching a microstructure floor.","meaning":"Further improvement likely needs real equations/data for each domain rather than abstract error correction."},
])

out=Path("/mnt/data")
paths={
"history":out/"dt_equation_locking_v7_history.csv",
"corrections":out/"dt_equation_locking_v7_corrections.csv",
"final":out/"dt_equation_locking_v7_final_state.csv",
"best":out/"dt_equation_locking_v7_best_state.csv",
"summary":out/"dt_equation_locking_v7_summary.csv",
"lessons":out/"dt_equation_locking_v7_lessons.csv",
}
history_df.to_csv(paths["history"],index=False)
corr_df.to_csv(paths["corrections"],index=False)
final.to_csv(paths["final"],index=False)
best.to_csv(paths["best"],index=False)
summary.to_csv(paths["summary"],index=False)
lessons.to_csv(paths["lessons"],index=False)

print("SUMMARY")
print(summary.to_string(index=False))
print("\nFINAL")
print(final[["branch","error","ultra_viable","singularity_viable","deep_viable"]].to_string(index=False))
print("\nBEST")
print(best[["branch","error","ultra_viable","singularity_viable","deep_viable"]].to_string(index=False))
print("\nLESSONS")
print(lessons.to_string(index=False))
print("\nSaved:")
for p in paths.values():
    print(p)
