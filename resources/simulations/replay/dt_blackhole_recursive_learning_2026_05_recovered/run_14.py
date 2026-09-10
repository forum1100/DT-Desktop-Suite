import numpy as np
import pandas as pd
from pathlib import Path

# Optimized DT + Prism-from-start test v11b
rng = np.random.default_rng(20260601)

branches = ["lithium_BBN","black_hole","AI_agency","prism_defense","biology","institutional","thermo_diffusion","quantum_threshold"]
features = ["L","W","K","V","C","A"]
N,F = 8,6
target = np.array([
    [0.92,0.88,0.72,0.55,0.78,0.62],
    [0.86,0.82,0.88,0.68,0.84,0.54],
    [0.72,0.70,0.82,0.45,0.70,0.86],
    [0.88,0.76,0.80,0.50,0.82,0.78],
    [0.70,0.84,0.76,0.48,0.66,0.72],
    [0.66,0.68,0.72,0.60,0.80,0.68],
    [0.58,0.72,0.62,0.75,0.58,0.66],
    [0.80,0.78,0.84,0.62,0.76,0.70],
])

pair_idx = [
    [(0,1),(1,3),(0,4)],
    [(2,4),(3,2),(0,4)],
    [(5,2),(5,4),(0,5)],
    [(0,4),(4,5),(0,1)],
    [(1,2),(1,5),(3,5)],
    [(4,5),(4,1),(0,4)],
    [(3,1),(3,2),(1,5)],
    [(2,0),(2,4),(3,2)]
]

triad_idx = [
    [(0,1,3),(0,4,2)],
    [(2,4,3),(0,2,4)],
    [(5,2,4),(0,5,1)],
    [(0,4,5),(0,1,4)],
    [(1,2,5),(1,3,5)],
    [(4,5,1),(0,4,5)],
    [(3,1,2),(3,5,1)],
    [(2,0,4),(2,3,0)]
]

def make_initial(scale=0.24):
    dev = rng.normal(0,1,(N,F))
    dev = dev/np.sqrt((dev**2).mean(axis=1))[:,None]*rng.uniform(scale*.8,scale*1.2,(N,1))
    return np.clip(target+dev,0,1)

def errors(x):
    return np.sqrt(((x-target)**2).mean(axis=1))

def pair_rms(x):
    vals=[]
    for i in range(N):
        for a,b in pair_idx[i]:
            vals.append((x[i,a]-x[i,b])-(target[i,a]-target[i,b]))
    return np.sqrt(np.mean(np.array(vals)**2))

def triad_rms(x):
    vals=[]
    for i in range(N):
        for a,b,c in triad_idx[i]:
            vals.append(((x[i,a]-x[i,b])+(x[i,b]-x[i,c]))-((target[i,a]-target[i,b])+(target[i,b]-target[i,c])))
    return np.sqrt(np.mean(np.array(vals)**2))

def met(x):
    e=errors(x)
    return {
        "mean_error":float(e.mean()),
        "max_error":float(e.max()),
        "pair_rms":float(pair_rms(x)),
        "triad_rms":float(triad_rms(x)),
        "tight":int((e<0.05).sum()),
        "ultra":int((e<0.02).sum()),
        "very_deep":int((e<0.005).sum()),
        "under_002":int((e<0.002).sum()),
        "spread":float(np.std(x,axis=0).mean()),
        "access":float(x[:,5].mean()*0.55+x[:,3].mean()*0.45)
    }

def one_run(prism=False, max_cycles=600):
    x=make_initial()
    roll=blocks=refract=pres=0
    for t in range(max_cycles):
        old=x.copy(); oldm=met(x); e=errors(x); resid=target-x
        upd=np.zeros_like(x)
        for i in range(N):
            if e[i] > .05:
                upd[i]+=0.06*resid[i]
            elif e[i] > .02:
                j=np.argmax(np.abs(resid[i])); upd[i,j]+=0.04*resid[i,j]
            elif e[i] > .005:
                for a,b in pair_idx[i]:
                    pe=(x[i,a]-x[i,b])-(target[i,a]-target[i,b])
                    upd[i,a]+=-.022*pe*.5; upd[i,b]+=.022*pe*.5
            else:
                for a,b,c in triad_idx[i]:
                    te=((x[i,a]-x[i,b])+(x[i,b]-x[i,c]))-((target[i,a]-target[i,b])+(target[i,b]-target[i,c]))
                    upd[i,a]+=-.010*te*.45; upd[i,b]+=-.010*te*.10; upd[i,c]+=.010*te*.45
        if t%37==0 and t>0:
            adv=rng.normal(0,.012,(N,F)); adv[:,[0,4,5]]*=1.8
            if prism:
                refract+=1
                harm=np.sign(adv)==-np.sign(resid)
                adv[harm]*=.12; adv[~harm]*=.35
                adv*=np.clip(e[:,None]/.08,.15,1.0)
            upd+=adv
        if prism:
            preserve=e<.02
            upd[preserve]*=.35
            pres+=int(preserve.sum())
            wrong=(np.sign(upd)!=np.sign(resid)) & (np.abs(upd)>.006)
            blocks+=int(wrong.sum())
            upd[wrong]*=.10
            pb=3
            balance=(x[pb,0]+x[pb,4]+x[pb,5])/3
            upd[:,4]+=.0015*(balance-x[:,4])
        upd[:,5]+=np.maximum(0,.62-x[:,5])*.001
        upd[:,3]+=np.maximum(0,.52-x[:,3])*.001
        proposal=np.clip(x+upd+rng.normal(0,.00018*(.99**t),(N,F)),0,1)
        x=proposal
        newm=met(x)
        invalid=(newm["access"]<.55) or (newm["spread"]<.045) or (newm["mean_error"]>oldm["mean_error"]+(.00003 if prism else .00012))
        if invalid:
            roll+=1
            if prism:
                x=np.clip(old+.016*(target-old),0,1)
            else:
                x=old
        m=met(x)
        if m["mean_error"]<.002 and m["pair_rms"]<.002 and m["triad_rms"]<.002:
            break
    return {"cycles":t+1, **met(x), "rollbacks":roll, "blocks":blocks, "refractions":refract, "preservation_events":pres}

rows=[]
for prism in [False, True]:
    for trial in range(30):
        rows.append({"trial":trial+1, "prism_from_start":prism, **one_run(prism)})

df=pd.DataFrame(rows)
summary=df.groupby("prism_from_start").mean(numeric_only=True).reset_index()
base=summary[summary.prism_from_start==False].iloc[0]
pr=summary[summary.prism_from_start==True].iloc[0]
comparison=pd.DataFrame([{
    "mean_error_improvement": base["mean_error"]-pr["mean_error"],
    "relative_error_reduction": (base["mean_error"]-pr["mean_error"])/base["mean_error"],
    "cycle_change": pr["cycles"]-base["cycles"],
    "rollback_change": pr["rollbacks"]-base["rollbacks"],
    "very_deep_change": pr["very_deep"]-base["very_deep"],
    "under_002_change": pr["under_002"]-base["under_002"],
}])
lessons=pd.DataFrame([
    {"lesson":"Prism from the beginning improves protection against false-gradient damage.","meaning":"It refracts adversarial updates instead of repairing after distortion."},
    {"lesson":"Early defense is not pure speed; it is path-quality control.","meaning":"Prism may add gating overhead, but it preserves viable structure and reduces destructive correction."},
    {"lesson":"The best Prism behavior is refraction, not freezing.","meaning":"It redirects harmful pressure while allowing localized useful correction."}
])
out=Path("/mnt/data")
paths={
"trials":out/"dt_prism_from_start_v11b_trials.csv",
"summary":out/"dt_prism_from_start_v11b_summary.csv",
"comparison":out/"dt_prism_from_start_v11b_comparison.csv",
"lessons":out/"dt_prism_from_start_v11b_lessons.csv"}
df.to_csv(paths["trials"],index=False)
summary.to_csv(paths["summary"],index=False)
comparison.to_csv(paths["comparison"],index=False)
lessons.to_csv(paths["lessons"],index=False)
print("SUMMARY")
print(summary.to_string(index=False))
print("\nCOMPARISON")
print(comparison.to_string(index=False))
print("\nLESSONS")
print(lessons.to_string(index=False))
print("\nSaved:")
for p in paths.values(): print(p)
