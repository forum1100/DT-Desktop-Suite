import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# MERGED DT SIMULATION
# Combines:
# 1. Bounded recursive persistence / preservation architecture
# 2. Flourishing-resilience numerator/denominator model
#
# Critique corrections:
# - No single favored mode only.
# - Includes randomized policy control.
# - Includes ablations: no memory, no network, no overcorrection penalty.
# - Includes harsh shocks common to all branches.
# - Tracks lock-in, recovery, low-tail resilience, and instability.
# - Uses same initial conditions per seed across modes.

N = 80
T_STEPS = 1200
SEEDS = range(300, 340)

DRIVERS = ["truth", "participation", "meaning", "stewardship", "correction", "renewal"]
DESTABS = ["optimization", "dependency", "alienation", "fragmentation", "lockin", "flattening"]

def gmean(x, axis=None):
    return np.exp(np.mean(np.log(np.clip(x, 1e-8, None)), axis=axis))

def flourishing(drivers, destabs):
    return gmean(drivers, axis=1) / gmean(destabs, axis=1)

def run_merged(mode, seed):
    rng = np.random.default_rng(seed)
    
    # Shared starting state per seed
    drivers = rng.uniform(0.35, 0.65, (N, 6))
    destabs = rng.uniform(0.25, 0.55, (N, 6))
    
    # Bounded persistence state from prior sim branch
    P = rng.uniform(0.1, 0.3, N)
    R = rng.uniform(0.1, 0.2, N)
    M_persist = np.zeros(N)
    
    driver_memory = drivers.copy()
    destab_memory = destabs.copy()
    
    adj = rng.random((N, N)) < 0.08
    np.fill_diagonal(adj, False)
    deg = adj.sum(axis=1)
    deg[deg == 0] = 1
    
    history = []

    for t in range(T_STEPS):
        # Shared shock schedule
        shock_info = 0.0
        shock_dependency = 0.0
        shock_lockin = 0.0
        shock_fragment = 0.0
        
        if 250 <= t < 330:
            shock_info = 0.35
            shock_fragment = 0.20
        if 520 <= t < 610:
            shock_dependency = 0.45
        if 760 <= t < 850:
            shock_lockin = 0.42
        if 980 <= t < 1030:
            shock_info = 0.25
            shock_dependency = 0.25
            shock_lockin = 0.25
        
        shock_intensity = 1 + shock_info + shock_dependency + shock_lockin + shock_fragment

        # DT bounded-persistence substrate variables
        I = rng.uniform(0.4, 1.0, N)
        C = drivers[:, 4] * (1 - destabs[:, 3]) # correction capacity constrained by fragmentation
        K = drivers[:, 2] * (1 - destabs[:, 5]) # meaning continuity constrained by flattening
        V = np.clip(destabs[:, 3] + destabs[:, 4] + destabs[:, 1], 0, 3) / 3
        D = np.clip(destabs.mean(axis=1), 0, 1.2)
        
        pair = np.abs(P - np.roll(P, 1))
        triad = np.abs((P - np.roll(P, 1)) + (np.roll(P, 1) - np.roll(P, 2)))
        variance_pressure = np.abs(P - np.mean(P))
        
        # Baseline bounded persistence mechanics: present in all modes
        # prevents runaway feedback from prior failed sims
        M_persist = 0.96 * M_persist + 0.04 * P
        convergence_pressure = np.clip(np.mean(np.abs(P-M_persist))/(np.mean(P)+1e-9), 0, 1)
        
        base_p = (
            0.065 * (I*C*K*(1+R)) /
            (1 + 0.32*P + 0.32*R + 0.65*pair + 0.45*triad)
        ) - 0.04*(D*V)*shock_intensity
        
        memory_pull = -0.05 * convergence_pressure * (P - M_persist)
        variance_damping = -0.014 * variance_pressure
        lockin_penalty = -0.006 * np.maximum(P - 8.0, 0)
        dP = base_p + memory_pull + variance_damping + lockin_penalty
        
        P = np.clip(P + dP, 0, 100)
        R = 0.96*R + 0.04*P
        
        F_now = flourishing(drivers, destabs)
        dom_destab = np.argmax(destabs, axis=1)
        
        # Policy layer
        if mode == "centralized_optimization":
            drivers[:,0] += 0.004  # truth
            drivers[:,5] -= 0.002  # renewal loss
            drivers[:,1] -= 0.003  # participation loss
            destabs[:,0] += 0.006  # optimization
            destabs[:,2] += 0.004  # alienation
            destabs[:,4] += 0.006  # lock-in
            destabs[:,5] += 0.003  # flattening
            destabs[:,3] -= 0.004  # fragmentation control

        elif mode == "laissez_faire_noise":
            drivers += rng.normal(0,0.012,drivers.shape) - 0.0015
            destabs += rng.normal(0,0.013,destabs.shape) + 0.001

        elif mode == "random_policy_control":
            # Random corrections of same average magnitude as distributed branch, no target logic
            random_driver_delta = rng.normal(0, 0.006, drivers.shape)
            random_destab_delta = rng.normal(0, 0.006, destabs.shape)
            drivers += random_driver_delta
            destabs += random_destab_delta

        elif mode in [
            "distributed_full",
            "distributed_no_memory",
            "distributed_no_network",
            "distributed_no_overcorrection_penalty"
        ]:
            correction_pressure = 0.030 * drivers[:,4] * drivers[:,1] * (1 + P/(1+P))
            
            # targeted local correction of dominant destabilizer
            for i in range(N):
                j = dom_destab[i]
                destabs[i,j] -= correction_pressure[i] * (1 - destabs[i,j])
            
            # network adaptation
            if mode != "distributed_no_network":
                neighbor_drivers = (adj @ drivers) / deg[:, None]
                drivers += 0.010 * (neighbor_drivers - drivers)
            
            # viable-memory preservation
            if mode != "distributed_no_memory":
                mem_F = flourishing(driver_memory, destab_memory)
                underperform = (F_now < mem_F).astype(float)[:, None]
                drivers += 0.016 * underperform * (driver_memory - drivers)
                destabs += 0.016 * underperform * (destab_memory - destabs)
            
            # renewal, participation, stewardship gains if destabilizers remain controlled
            drivers[:,5] += 0.0035 * drivers[:,4] * (1 - destabs[:,4])
            drivers[:,1] += 0.0025 * (1 - destabs[:,2])
            drivers[:,3] += 0.0025 * (1 - destabs[:,0])
            
            # overcorrection penalty
            if mode != "distributed_no_overcorrection_penalty":
                overcorr = np.maximum(drivers[:,4] - drivers[:,1], 0)
                destabs[:,2] += 0.003 * overcorr
            
            # update memory only when improving and not under active severe shock
            if mode != "distributed_no_memory":
                mem_F = flourishing(driver_memory, destab_memory)
                improved = (F_now > mem_F).astype(float)[:,None]
                shock_gate = 1 if shock_intensity < 1.2 else 0
                driver_memory = 0.987*driver_memory + 0.013*shock_gate*(improved*drivers + (1-improved)*driver_memory)
                destab_memory = 0.987*destab_memory + 0.013*shock_gate*(improved*destabs + (1-improved)*destab_memory)

        # Apply exogenous shocks to all modes
        destabs[:,3] += shock_info * rng.uniform(0.4,1.0,N)
        destabs[:,3] += shock_fragment * rng.uniform(0.3,0.8,N)
        drivers[:,0] -= shock_info * rng.uniform(0.2,0.6,N)
        
        destabs[:,1] += shock_dependency * rng.uniform(0.4,1.0,N)
        drivers[:,1] -= shock_dependency * rng.uniform(0.2,0.5,N)
        
        destabs[:,4] += shock_lockin * rng.uniform(0.4,1.0,N)
        drivers[:,5] -= shock_lockin * rng.uniform(0.2,0.5,N)
        
        # Background drift
        drivers += rng.normal(0,0.0055,drivers.shape) - 0.00045
        destabs += rng.normal(0,0.0065,destabs.shape) + 0.00035
        
        drivers = np.clip(drivers,0.03,1.0)
        destabs = np.clip(destabs,0.03,1.2)
        
        F_after = flourishing(drivers, destabs)
        
        history.append({
            "mode": mode,
            "seed": seed,
            "cycle": t,
            "system_F": float(np.mean(F_after)),
            "median_F": float(np.median(F_after)),
            "low_tail_F": float(np.quantile(F_after,0.10)),
            "driver_mean": float(np.mean(drivers)),
            "destab_mean": float(np.mean(destabs)),
            "mean_P": float(np.mean(P)),
            "std_P": float(np.std(P)),
            "max_P": float(np.max(P)),
            "mean_R": float(np.mean(R)),
            "truth": float(np.mean(drivers[:,0])),
            "participation": float(np.mean(drivers[:,1])),
            "meaning": float(np.mean(drivers[:,2])),
            "stewardship": float(np.mean(drivers[:,3])),
            "correction": float(np.mean(drivers[:,4])),
            "renewal": float(np.mean(drivers[:,5])),
            "optimization": float(np.mean(destabs[:,0])),
            "dependency": float(np.mean(destabs[:,1])),
            "alienation": float(np.mean(destabs[:,2])),
            "fragmentation": float(np.mean(destabs[:,3])),
            "lockin": float(np.mean(destabs[:,4])),
            "flattening": float(np.mean(destabs[:,5])),
            "shock_intensity": shock_intensity,
        })
    
    return pd.DataFrame(history)

modes = [
    "centralized_optimization",
    "laissez_faire_noise",
    "random_policy_control",
    "distributed_full",
    "distributed_no_memory",
    "distributed_no_network",
    "distributed_no_overcorrection_penalty",
]

frames = []
for mode in modes:
    for seed in SEEDS:
        frames.append(run_merged(mode, seed))
df = pd.concat(frames, ignore_index=True)

# Summaries
rows = []
for mode in modes:
    dmode = df[df["mode"] == mode]
    for seed in SEEDS:
        s = dmode[dmode["seed"] == seed]
        final = s.iloc[-1]
        recovery_windows = []
        for start, end in [(330,430),(610,710),(850,950),(1030,1130)]:
            recovery_windows.append(s[(s["cycle"]>=start)&(s["cycle"]<end)]["system_F"].mean())
        rows.append({
            "mode": mode,
            "seed": seed,
            "final_F": final["system_F"],
            "final_low_tail_F": final["low_tail_F"],
            "final_driver_mean": final["driver_mean"],
            "final_destab_mean": final["destab_mean"],
            "final_mean_P": final["mean_P"],
            "final_max_P": final["max_P"],
            "avg_recovery_F": float(np.mean(recovery_windows)),
            "min_recovery_F": float(np.min(recovery_windows)),
            "final_truth": final["truth"],
            "final_participation": final["participation"],
            "final_correction": final["correction"],
            "final_renewal": final["renewal"],
            "final_optimization": final["optimization"],
            "final_dependency": final["dependency"],
            "final_alienation": final["alienation"],
            "final_fragmentation": final["fragmentation"],
            "final_lockin": final["lockin"],
        })
summary_seed = pd.DataFrame(rows)
summary = summary_seed.groupby("mode").agg(
    final_F_mean=("final_F","mean"),
    final_F_std=("final_F","std"),
    low_tail_F_mean=("final_low_tail_F","mean"),
    driver_mean=("final_driver_mean","mean"),
    destab_mean=("final_destab_mean","mean"),
    final_mean_P=("final_mean_P","mean"),
    final_max_P=("final_max_P","mean"),
    avg_recovery_F=("avg_recovery_F","mean"),
    min_recovery_F=("min_recovery_F","mean"),
    final_truth=("final_truth","mean"),
    final_participation=("final_participation","mean"),
    final_correction=("final_correction","mean"),
    final_renewal=("final_renewal","mean"),
    final_optimization=("final_optimization","mean"),
    final_dependency=("final_dependency","mean"),
    final_alienation=("final_alienation","mean"),
    final_fragmentation=("final_fragmentation","mean"),
    final_lockin=("final_lockin","mean"),
).reset_index().sort_values("final_F_mean", ascending=False)

# Plot
plot_df = df.groupby(["mode","cycle"])["system_F"].agg(["mean","std"]).reset_index()
fig, ax = plt.subplots(figsize=(13,7))
for mode in modes:
    p = plot_df[plot_df["mode"] == mode]
    ax.plot(p["cycle"], p["mean"], label=mode)
for start, end in [(250,330),(520,610),(760,850),(980,1030)]:
    ax.axvspan(start, end, alpha=0.08)
ax.set_title("Merged DT Simulation: Bounded Persistence + Flourishing Resilience")
ax.set_xlabel("Cycle")
ax.set_ylabel("System Flourishing F(t)")
ax.legend(fontsize=8)

plot_path = "/mnt/data/dt_merged_resilience_persistence.png"
summary_path = "/mnt/data/dt_merged_summary.csv"
seed_path = "/mnt/data/dt_merged_by_seed.csv"
history_path = "/mnt/data/dt_merged_history.csv"

fig.savefig(plot_path, bbox_inches="tight")
summary.to_csv(summary_path, index=False)
summary_seed.to_csv(seed_path, index=False)
df.to_csv(history_path, index=False)

print(summary[["mode","final_F_mean","low_tail_F_mean","avg_recovery_F","final_mean_P","final_max_P","final_destab_mean","final_lockin","final_alienation"]].to_string(index=False))
print(f"\nSaved plot: {plot_path}")
print(f"Saved summary: {summary_path}")
print(f"Saved per-seed summary: {seed_path}")
print(f"Saved full history: {history_path}")