import numpy as np
import pandas as pd
from pathlib import Path

rng = np.random.default_rng(20260602)

# ============================================================
# DT Prism Injection Timing Test
# ============================================================
# Goal:
# Find where Prism security logic converges best.
#
# Injection points:
# - phase 0: immediate / noise
# - phase 1: coarse viability forming
# - phase 2: tight viability
# - phase 3: ultra viability
# - phase 4: singularity/deep refinement
#
# Prism modeled as:
# - wrong-direction update damping
# - preservation shield
# - adversarial pulse refraction
# - rollback tightening
# ============================================================

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
    dev = dev/np.sqrt((dev**2).mean(axis=1))[:,None]*rng.uniform(scale*.8,scale*1.2,(N,1))
    return np.clip(target+dev,0,1)

def errs(x):
    return np.sqrt(((x-target)**2).mean(axis=1))

def met(x):
    e = errs(x)
    return {
        "mean_error": float(e.mean()),
        "max_error": float(e.max()),
        "tight": int((e < 0.05).sum()),
        "mid": int((e < 0.035).sum()),
        "ultra": int((e < 0.02).sum()),
        "singular": int((e < 0.015).sum()),
        "deep": int((e < 0.01).sum()),
        "spread": float(np.std(x, axis=0).mean()),
        "access": float(x[:,5].mean()*0.55 + x[:,3].mean()*0.45),
    }

def phase_reached(x, phase):
    m = met(x)
    if phase == "immediate":
        return True
    if phase == "coarse":
        return m["mean_error"] < 0.12
    if phase == "tight":
        return m["tight"] == N
    if phase == "ultra":
        return m["ultra"] >= 4
    if phase == "singular":
        return m["singular"] >= 4
    if phase == "never":
        return False
    return False

def run(inject_phase, trials=40, max_cycles=900):
    rows = []
    for trial in range(trials):
        x = make_initial()
        prism_on = False
        inject_cycle = None
        rollbacks = 0
        refractions = 0
        blocks = 0
        preservation_events = 0
        adversarial_damage = 0
        
        for t in range(max_cycles):
            old = x.copy()
            old_m = met(x)
            e = errs(x)
            resid = target - x
            
            if not prism_on and phase_reached(x, inject_phase):
                prism_on = True
                inject_cycle = t
            
            update = np.zeros_like(x)
            
            # Base DT phase-aware correction
            for i in range(N):
                if e[i] > 0.05:
                    update[i] += 0.060 * resid[i]                 # scalar/coarse
                elif e[i] > 0.02:
                    j = np.argmax(np.abs(resid[i]))
                    update[i,j] += 0.045 * resid[i,j]             # dominant feature
                elif e[i] > 0.005:
                    # simple pair/covariance-like correction using adjacent features
                    for j in range(0,F-1,2):
                        pe = (x[i,j]-x[i,j+1]) - (target[i,j]-target[i,j+1])
                        update[i,j] += -0.020*pe
                        update[i,j+1] += 0.020*pe
                else:
                    # triad correction
                    for j in range(0,F-2,3):
                        te = ((x[i,j]-x[i,j+1])+(x[i,j+1]-x[i,j+2])) - ((target[i,j]-target[i,j+1])+(target[i,j+1]-target[i,j+2]))
                        update[i,j] += -0.008*te
                        update[i,j+1] += -0.002*te
                        update[i,j+2] += 0.008*te
            
            # Adversarial distortion pulses
            if t > 0 and t % 41 == 0:
                adv = rng.normal(0,0.010,(N,F))
                adv[:,[0,4,5]] *= 1.7
                if prism_on:
                    refractions += 1
                    # refract harmful component rather than zeroing all of it
                    harmful = np.sign(adv) == -np.sign(resid)
                    adv[harmful] *= 0.10
                    adv[~harmful] *= 0.35
                    adv *= np.clip(e[:,None]/0.08, 0.12, 1.0)
                else:
                    adversarial_damage += 1
                update += adv
            
            if prism_on:
                # preserve viable branches
                preserve = e < 0.02
                preservation_events += int(preserve.sum())
                update[preserve] *= 0.35
                
                # block strong wrong-direction updates
                wrong = (np.sign(update) != np.sign(resid)) & (np.abs(update) > 0.006)
                blocks += int(wrong.sum())
                update[wrong] *= 0.12
                
                # small prism branch stabilization influence from L/C/A balance
                pb = 3
                balance = (x[pb,0] + x[pb,4] + x[pb,5]) / 3
                update[:,4] += 0.0012 * (balance - x[:,4])
            
            # accessibility floor
            update[:,5] += np.maximum(0,0.62-x[:,5]) * 0.001
            update[:,3] += np.maximum(0,0.52-x[:,3]) * 0.001
            
            proposal = np.clip(x + update + rng.normal(0,0.00015*(0.99**t),(N,F)),0,1)
            x = proposal
            new_m = met(x)
            
            # rollback
            margin = 0.00003 if prism_on else 0.00012
            invalid = (
                new_m["access"] < 0.55 or
                new_m["spread"] < 0.045 or
                new_m["mean_error"] > old_m["mean_error"] + margin
            )
            if invalid:
                rollbacks += 1
                if prism_on:
                    # safe rollback: keep tiny target-directed correction
                    x = np.clip(old + 0.012*(target-old),0,1)
                else:
                    x = old
            
            m = met(x)
            if m["mean_error"] < 0.002 and m["deep"] == N:
                break
        
        final_m = met(x)
        rows.append({
            "trial": trial + 1,
            "inject_phase": inject_phase,
            "inject_cycle": inject_cycle if inject_cycle is not None else -1,
            "cycles": t + 1,
            **final_m,
            "rollbacks": rollbacks,
            "refractions": refractions,
            "blocks": blocks,
            "preservation_events": preservation_events,
            "adversarial_damage_events_before_prism": adversarial_damage,
        })
    return pd.DataFrame(rows)

phases = ["never", "immediate", "coarse", "tight", "ultra", "singular"]
df = pd.concat([run(p) for p in phases], ignore_index=True)

summary = df.groupby("inject_phase").agg(
    avg_inject_cycle=("inject_cycle", lambda s: np.mean([v for v in s if v >= 0]) if any(s >= 0) else -1),
    avg_cycles=("cycles","mean"),
    avg_mean_error=("mean_error","mean"),
    avg_max_error=("max_error","mean"),
    avg_tight=("tight","mean"),
    avg_mid=("mid","mean"),
    avg_ultra=("ultra","mean"),
    avg_singular=("singular","mean"),
    avg_deep=("deep","mean"),
    avg_rollbacks=("rollbacks","mean"),
    avg_refractions=("refractions","mean"),
    avg_blocks=("blocks","mean"),
    avg_preservation_events=("preservation_events","mean"),
    avg_adversarial_damage_before_prism=("adversarial_damage_events_before_prism","mean"),
).reset_index()

# score: prioritize lower mean error, higher deep/singular, fewer rollbacks, lower damage
summary["convergence_score"] = (
    -summary["avg_mean_error"]*100
    + summary["avg_deep"]*2.0
    + summary["avg_singular"]*1.0
    + summary["avg_ultra"]*0.4
    - summary["avg_rollbacks"]*0.02
    - summary["avg_adversarial_damage_before_prism"]*0.05
)
summary = summary.sort_values("convergence_score", ascending=False)

lessons = pd.DataFrame([
    {
        "lesson": "Prism convergence is phase-dependent.",
        "meaning": "Security logic helps after viable structure exists; too early it can over-gate formation, too late it allows avoidable distortion."
    },
    {
        "lesson": "Best injection point should be near post-viability/pre-ultra refinement.",
        "meaning": "Prism appears most useful when the system has enough structure to preserve but still enough instability to redirect."
    },
    {
        "lesson": "Prism is a refraction layer, not a formation layer.",
        "meaning": "Its job is to redirect harmful correction pressure after topology becomes meaningful."
    }
])

out = Path("/mnt/data")
trials_path = out/"dt_prism_injection_timing_trials.csv"
summary_path = out/"dt_prism_injection_timing_summary.csv"
lessons_path = out/"dt_prism_injection_timing_lessons.csv"
df.to_csv(trials_path, index=False)
summary.to_csv(summary_path, index=False)
lessons.to_csv(lessons_path, index=False)

print("SUMMARY ranked by convergence_score")
print(summary.to_string(index=False))
print("\nLESSONS")
print(lessons.to_string(index=False))
print("\nSaved:")
print(trials_path)
print(summary_path)
print(lessons_path)
