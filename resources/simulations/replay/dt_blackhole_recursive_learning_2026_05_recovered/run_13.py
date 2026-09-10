import numpy as np
import pandas as pd
from pathlib import Path

# ============================================================
# DT + PRISM-FROM-BEGINNING TEST v11
# ============================================================
# Question:
# What happens if Prism defense logic is present from the beginning?
#
# Prism logic modeled as:
# - adversarial distortion detection
# - refraction instead of direct absorption
# - preservation shield for viable branches
# - false-gradient/overcorrection dampening
# - localized correction gates
#
# Compared against:
# A. DT learned architecture without Prism preload
# B. DT architecture with Prism preload from cycle 0
# ============================================================

rng = np.random.default_rng(20260531)

branches = [
    "lithium_BBN", "black_hole", "AI_agency", "prism_defense",
    "biology", "institutional", "thermo_diffusion", "quantum_threshold"
]
features = ["L", "W", "K", "V", "C", "A"]
N, F = len(branches), len(features)

targets = pd.DataFrame({
    "branch": branches,
    "L": [0.92, 0.86, 0.72, 0.88, 0.70, 0.66, 0.58, 0.80],
    "W": [0.88, 0.82, 0.70, 0.76, 0.84, 0.68, 0.72, 0.78],
    "K": [0.72, 0.88, 0.82, 0.80, 0.76, 0.72, 0.62, 0.84],
    "V": [0.55, 0.68, 0.45, 0.50, 0.48, 0.60, 0.75, 0.62],
    "C": [0.78, 0.84, 0.70, 0.82, 0.66, 0.80, 0.58, 0.76],
    "A": [0.62, 0.54, 0.86, 0.78, 0.72, 0.68, 0.66, 0.70],
})
target_mat = targets[features].to_numpy()

pairs = {
    "lithium_BBN": [("L","W"), ("W","V"), ("L","C")],
    "black_hole": [("K","C"), ("V","K"), ("L","C")],
    "AI_agency": [("A","K"), ("A","C"), ("L","A")],
    "prism_defense": [("L","C"), ("C","A"), ("L","W")],
    "biology": [("W","K"), ("W","A"), ("V","A")],
    "institutional": [("C","A"), ("C","W"), ("L","C")],
    "thermo_diffusion": [("V","W"), ("V","K"), ("W","A")],
    "quantum_threshold": [("K","L"), ("K","C"), ("V","K")],
}
triads = {
    "lithium_BBN": [("L","W","V"), ("L","C","K")],
    "black_hole": [("K","C","V"), ("L","K","C")],
    "AI_agency": [("A","K","C"), ("L","A","W")],
    "prism_defense": [("L","C","A"), ("L","W","C")],
    "biology": [("W","K","A"), ("W","V","A")],
    "institutional": [("C","A","W"), ("L","C","A")],
    "thermo_diffusion": [("V","W","K"), ("V","A","W")],
    "quantum_threshold": [("K","L","C"), ("K","V","L")],
}
fi = {f:i for i,f in enumerate(features)}

def make_initial(scale=0.24):
    dev = rng.normal(0,1,(N,F))
    dev = dev/np.sqrt((dev**2).mean(axis=1))[:,None]*rng.uniform(scale*0.8, scale*1.2, (N,1))
    s = targets.copy()
    s.loc[:,features] = np.clip(target_mat+dev,0,1)
    return s

def branch_error(s):
    return np.sqrt(((s[features].to_numpy()-target_mat)**2).mean(axis=1))

def pair_rms(s):
    cur=s[features].to_numpy(); vals=[]
    for bi,b in enumerate(branches):
        for a,c in pairs[b]:
            vals.append((cur[bi,fi[a]]-cur[bi,fi[c]])-(target_mat[bi,fi[a]]-target_mat[bi,fi[c]]))
    return float(np.sqrt(np.mean(np.array(vals)**2)))

def triad_rms(s):
    cur=s[features].to_numpy(); vals=[]
    for bi,b in enumerate(branches):
        for a,c,d in triads[b]:
            vals.append(((cur[bi,fi[a]]-cur[bi,fi[c]])+(cur[bi,fi[c]]-cur[bi,fi[d]]))-((target_mat[bi,fi[a]]-target_mat[bi,fi[c]])+(target_mat[bi,fi[c]]-target_mat[bi,fi[d]])))
    return float(np.sqrt(np.mean(np.array(vals)**2)))

def metrics(s):
    err=branch_error(s)
    spread=np.std(s[features].to_numpy(),axis=0).mean()
    access=s["A"].mean()*0.55+s["V"].mean()*0.45
    return {
        "mean_error":float(err.mean()),
        "max_error":float(err.max()),
        "pair_rms":pair_rms(s),
        "triad_rms":triad_rms(s),
        "tight":int((err<0.05).sum()),
        "ultra":int((err<0.02).sum()),
        "very_deep":int((err<0.005).sum()),
        "under_002":int((err<0.002).sum()),
        "spread":float(spread),
        "access":float(access)
    }

def run(prism_from_start=False, trials=20):
    rows=[]
    final_states=[]
    histories=[]
    
    for trial in range(trials):
        state=make_initial()
        rollbacks=0
        prism_refractions=0
        adversarial_blocks=0
        preservation_events=0
        
        # inject adversarial distortion/noise attempts periodically
        for t in range(1200):
            old=state.copy()
            old_m=metrics(state)
            cur=state[features].to_numpy()
            err_vec=target_mat-cur
            err=branch_error(state)
            
            update=np.zeros_like(cur)
            
            # Phase logic: scalar -> dominant feature -> pair -> triad
            for bi,b in enumerate(branches):
                e=err[bi]
                if e>0.05:
                    update[bi]+=0.060*err_vec[bi]
                elif e>0.02:
                    j=np.argmax(np.abs(err_vec[bi]))
                    update[bi,j]+=0.040*err_vec[bi,j]
                elif e>0.005:
                    # pair correction
                    for a,c in pairs[b]:
                        pe=(cur[bi,fi[a]]-cur[bi,fi[c]])-(target_mat[bi,fi[a]]-target_mat[bi,fi[c]])
                        update[bi,fi[a]]+=-0.022*pe*0.5
                        update[bi,fi[c]]+= 0.022*pe*0.5
                else:
                    # triad preservation correction
                    for a,c,d in triads[b]:
                        te=((cur[bi,fi[a]]-cur[bi,fi[c]])+(cur[bi,fi[c]]-cur[bi,fi[d]]))-((target_mat[bi,fi[a]]-target_mat[bi,fi[c]])+(target_mat[bi,fi[c]]-target_mat[bi,fi[d]]))
                        update[bi,fi[a]]+=-0.010*te*0.45
                        update[bi,fi[c]]+=-0.010*te*0.10
                        update[bi,fi[d]]+= 0.010*te*0.45
            
            # adversarial/false-gradient disturbance: overcorrection attempt
            if t % 37 == 0 and t > 0:
                adv = rng.normal(0,0.012,(N,F))
                # attacks high-sensitivity features L/C/A more
                adv[:,[fi["L"],fi["C"],fi["A"]]] *= 1.8
                if prism_from_start:
                    # Prism refracts attack: localize/diffuse and reduce harmful vector
                    prism_refractions += 1
                    # remove component aligned with increasing error
                    harm = np.sign(adv)==-np.sign(err_vec)
                    adv[harm]*=0.12
                    adv[~harm]*=0.35
                    # redistribute some into harmless noise on already high-error branches
                    adv *= np.clip(err[:,None]/0.08,0.15,1.0)
                update += adv
            
            # Prism-from-start logic
            if prism_from_start:
                # 1. preservation shield for viable branches
                preserve=err<0.02
                update[preserve]*=0.35
                preservation_events += int(preserve.sum())
                
                # 2. localized correction gate: block updates that move opposite target direction too strongly
                wrong_dir = np.sign(update) != np.sign(err_vec)
                strong_wrong = wrong_dir & (np.abs(update)>0.006)
                if strong_wrong.any():
                    adversarial_blocks += int(strong_wrong.sum())
                    update[strong_wrong]*=0.10
                
                # 3. refraction around Prism branch: stabilize C-A-L relationships globally
                pb=branches.index("prism_defense")
                prism_balance=(cur[pb,fi["L"]]+cur[pb,fi["C"]]+cur[pb,fi["A"]])/3
                for bi in range(N):
                    update[bi,fi["C"]] += 0.0015*(prism_balance-cur[bi,fi["C"]])
            
            # access preservation for both
            A_i,V_i=fi["A"],fi["V"]
            update[:,A_i]+=np.maximum(0,0.62-cur[:,A_i])*0.001
            update[:,V_i]+=np.maximum(0,0.52-cur[:,V_i])*0.001
            
            proposal=cur+update+rng.normal(0,0.00018*(0.99**t),(N,F))
            state.loc[:,features]=np.clip(proposal,0,1)
            new_m=metrics(state)
            
            # rollback logic, stronger with Prism
            threshold=0.00003 if prism_from_start else 0.00012
            invalid=(new_m["access"]<0.55) or (new_m["spread"]<0.045) or (new_m["mean_error"]>old_m["mean_error"]+threshold)
            if invalid:
                rollbacks+=1
                if prism_from_start:
                    # Prism rollback: preserve old state except 20% safe correction toward target
                    safe=0.20*(target_mat-cur)
                    state.loc[:,features]=np.clip(cur+safe*0.08,0,1)
                else:
                    state=old
            
            m=metrics(state)
            if m["mean_error"]<0.002 and m["pair_rms"]<0.002 and m["triad_rms"]<0.002:
                break
        
        m=metrics(state)
        rows.append({
            "trial":trial+1,
            "prism_from_start":prism_from_start,
            "cycles":t+1,
            **m,
            "rollbacks":rollbacks,
            "prism_refractions":prism_refractions,
            "adversarial_blocks":adversarial_blocks,
            "preservation_events":preservation_events
        })
        final_states.append(state.assign(trial=trial+1, prism_from_start=prism_from_start))
        
    return pd.DataFrame(rows), pd.concat(final_states, ignore_index=True)

base_df, base_states = run(False, 20)
prism_df, prism_states = run(True, 20)
all_df=pd.concat([base_df,prism_df], ignore_index=True)
all_states=pd.concat([base_states,prism_states], ignore_index=True)

summary=all_df.groupby("prism_from_start").agg(
    avg_cycles=("cycles","mean"),
    avg_mean_error=("mean_error","mean"),
    avg_pair_rms=("pair_rms","mean"),
    avg_triad_rms=("triad_rms","mean"),
    avg_tight=("tight","mean"),
    avg_ultra=("ultra","mean"),
    avg_very_deep=("very_deep","mean"),
    avg_under_002=("under_002","mean"),
    avg_rollbacks=("rollbacks","mean"),
    avg_refractions=("prism_refractions","mean"),
    avg_blocks=("adversarial_blocks","mean"),
    avg_preservation_events=("preservation_events","mean"),
).reset_index()

# Comparative metrics
base_mean=summary.loc[summary["prism_from_start"]==False,"avg_mean_error"].iloc[0]
prism_mean=summary.loc[summary["prism_from_start"]==True,"avg_mean_error"].iloc[0]
base_cycles=summary.loc[summary["prism_from_start"]==False,"avg_cycles"].iloc[0]
prism_cycles=summary.loc[summary["prism_from_start"]==True,"avg_cycles"].iloc[0]

comparison=pd.DataFrame([{
    "mean_error_improvement_with_prism": base_mean-prism_mean,
    "relative_error_reduction": (base_mean-prism_mean)/base_mean,
    "cycle_change_with_prism": prism_cycles-base_cycles,
    "interpretation": "Prism from beginning should improve stability/preservation; may increase or decrease cycles depending on defense overhead."
}])

lessons=pd.DataFrame([
    {"lesson":"Prism-from-start changes the learning problem from repair to protected refinement.","meaning":"Adversarial/false-gradient disturbances are refracted early instead of repaired after damage."},
    {"lesson":"Defense can slow coarse convergence but reduce structural damage.","meaning":"Prism logic adds gating/rollback overhead, but protects viable structures."},
    {"lesson":"The best use of Prism is not maximum blocking; it is refraction plus preservation.","meaning":"The successful pattern is redirecting harmful correction pressure rather than freezing all change."}
])

out=Path("/mnt/data")
paths={
"trials":out/"dt_prism_from_start_v11_trials.csv",
"states":out/"dt_prism_from_start_v11_states.csv",
"summary":out/"dt_prism_from_start_v11_summary.csv",
"comparison":out/"dt_prism_from_start_v11_comparison.csv",
"lessons":out/"dt_prism_from_start_v11_lessons.csv"
}
all_df.to_csv(paths["trials"], index=False)
all_states.to_csv(paths["states"], index=False)
summary.to_csv(paths["summary"], index=False)
comparison.to_csv(paths["comparison"], index=False)
lessons.to_csv(paths["lessons"], index=False)

print("SUMMARY")
print(summary.to_string(index=False))
print("\nCOMPARISON")
print(comparison.to_string(index=False))
print("\nLESSONS")
print(lessons.to_string(index=False))
print("\nSaved:")
for p in paths.values():
    print(p)
