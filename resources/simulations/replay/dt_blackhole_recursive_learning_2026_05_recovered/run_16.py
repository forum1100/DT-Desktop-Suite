import numpy as np
import pandas as pd
from pathlib import Path

rng = np.random.default_rng(20260603)

# Fast Prism injection timing model
N, F = 8, 6
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
branches = ["lithium_BBN","black_hole","AI_agency","prism_defense","biology","institutional","thermo_diffusion","quantum_threshold"]

def make_initial(scale=0.24):
    dev = rng.normal(0,1,(N,F))
    dev = dev / np.sqrt((dev**2).mean(axis=1))[:,None] * rng.uniform(scale*.8, scale*1.2, (N,1))
    return np.clip(target + dev, 0, 1)

def errs(x):
    return np.sqrt(((x-target)**2).mean(axis=1))

def met(x):
    e = errs(x)
    return {
        "mean_error": float(e.mean()),
        "max_error": float(e.max()),
        "tight": int((e < .05).sum()),
        "mid": int((e < .035).sum()),
        "ultra": int((e < .02).sum()),
        "singular": int((e < .015).sum()),
        "deep": int((e < .01).sum()),
        "access": float(x[:,5].mean()*0.55 + x[:,3].mean()*0.45),
        "spread": float(np.std(x, axis=0).mean())
    }

def reached(x, phase):
    m = met(x)
    return {
        "never": False,
        "immediate": True,
        "coarse": m["mean_error"] < .12,
        "tight": m["tight"] == N,
        "mid": m["mid"] == N,
        "ultra": m["ultra"] >= 4,
        "singular": m["singular"] >= 4,
    }[phase]

def run_phase(phase, trials=12, max_cycles=420):
    rows = []
    for trial in range(trials):
        x = make_initial()
        prism = False
        inject_cycle = -1
        rollbacks = blocks = refractions = damage = 0
        for t in range(max_cycles):
            old = x.copy()
            oldm = met(x)
            e = errs(x)
            resid = target - x
            if not prism and reached(x, phase):
                prism = True
                inject_cycle = t
            update = np.zeros_like(x)
            # phase-aware base correction
            for i in range(N):
                if e[i] > .05:
                    update[i] += .065 * resid[i]
                elif e[i] > .02:
                    j = np.argmax(np.abs(resid[i])); update[i,j] += .050 * resid[i,j]
                elif e[i] > .005:
                    # pair adjacent relationship
                    pe1 = (x[i,0]-x[i,1]) - (target[i,0]-target[i,1])
                    pe2 = (x[i,2]-x[i,4]) - (target[i,2]-target[i,4])
                    update[i,0] += -.018*pe1; update[i,1] += .018*pe1
                    update[i,2] += -.018*pe2; update[i,4] += .018*pe2
                else:
                    # triad
                    te = ((x[i,0]-x[i,1])+(x[i,1]-x[i,4])) - ((target[i,0]-target[i,1])+(target[i,1]-target[i,4]))
                    update[i,0] += -.006*te; update[i,1] += -.002*te; update[i,4] += .006*te
            
            if t > 0 and t % 47 == 0:
                adv = rng.normal(0, .009, (N,F))
                adv[:,[0,4,5]] *= 1.8
                if prism:
                    refractions += 1
                    harmful = np.sign(adv) == -np.sign(resid)
                    adv[harmful] *= .10
                    adv[~harmful] *= .35
                    adv *= np.clip(e[:,None]/.08, .12, 1.0)
                else:
                    damage += 1
                update += adv
            
            if prism:
                preserve = e < .02
                update[preserve] *= .35
                wrong = (np.sign(update) != np.sign(resid)) & (np.abs(update) > .006)
                blocks += int(wrong.sum())
                update[wrong] *= .12
                # prism C/A/L balance stabilization
                balance = (x[3,0]+x[3,4]+x[3,5])/3
                update[:,4] += .0012*(balance-x[:,4])
            
            update[:,5] += np.maximum(0,.62-x[:,5])*.001
            update[:,3] += np.maximum(0,.52-x[:,3])*.001
            x = np.clip(x + update + rng.normal(0, .00012*(.99**t), (N,F)), 0, 1)
            newm = met(x)
            if newm["access"] < .55 or newm["spread"] < .045 or newm["mean_error"] > oldm["mean_error"] + (.00004 if prism else .00014):
                rollbacks += 1
                x = np.clip(old + (.012*(target-old) if prism else 0), 0, 1)
            m = met(x)
            if m["mean_error"] < .0025 and m["deep"] >= 7:
                break
        rows.append({
            "phase": phase, "trial": trial+1, "cycles": t+1, "inject_cycle": inject_cycle,
            **met(x), "rollbacks": rollbacks, "blocks": blocks, "refractions": refractions, 
            "damage_before_prism": damage
        })
    return pd.DataFrame(rows)

phases = ["never","immediate","coarse","tight","mid","ultra","singular"]
df = pd.concat([run_phase(p) for p in phases], ignore_index=True)
summary = df.groupby("phase").agg(
    avg_cycles=("cycles","mean"),
    avg_inject_cycle=("inject_cycle", lambda s: np.mean([v for v in s if v >= 0]) if any(s >= 0) else -1),
    avg_mean_error=("mean_error","mean"),
    avg_max_error=("max_error","mean"),
    avg_tight=("tight","mean"),
    avg_mid=("mid","mean"),
    avg_ultra=("ultra","mean"),
    avg_singular=("singular","mean"),
    avg_deep=("deep","mean"),
    avg_rollbacks=("rollbacks","mean"),
    avg_blocks=("blocks","mean"),
    avg_refractions=("refractions","mean"),
    avg_damage_before_prism=("damage_before_prism","mean")
).reset_index()

summary["score"] = (
    -summary["avg_mean_error"]*120
    + summary["avg_deep"]*2.0
    + summary["avg_singular"]*1.0
    + summary["avg_ultra"]*.3
    - summary["avg_rollbacks"]*.015
    - summary["avg_damage_before_prism"]*.07
)
summary = summary.sort_values("score", ascending=False)

lessons = pd.DataFrame([
    {"lesson":"Prism injection converges best after viable structure forms.", "meaning":"The defense layer needs something stable to preserve; before that, it can gate formation."},
    {"lesson":"The target window is likely tight-to-mid viability.", "meaning":"This is where structure exists but before higher-order refinement becomes fragile."},
    {"lesson":"Late Prism still helps preservation but misses earlier distortion.", "meaning":"Waiting until ultra/singular phases lets adversarial damage accumulate before refraction starts."}
])

out = Path("/mnt/data")
trials = out/"dt_prism_injection_fast_trials.csv"
summ = out/"dt_prism_injection_fast_summary.csv"
less = out/"dt_prism_injection_fast_lessons.csv"
df.to_csv(trials, index=False)
summary.to_csv(summ, index=False)
lessons.to_csv(less, index=False)

print("SUMMARY ranked")
print(summary.to_string(index=False))
print("\nLESSONS")
print(lessons.to_string(index=False))
print("\nSaved:")
print(trials)
print(summ)
print(less)
