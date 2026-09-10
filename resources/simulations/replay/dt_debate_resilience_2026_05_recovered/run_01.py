import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# Distel Theory-inspired flourishing/resilience simulation
# Based on user's proposed heuristic:
# F(t) ≈ (T × P × M × S × C × R) / (O × D × A × Fg × L × E)
#
# Drivers:
# T truth compatibility
# P participatory agency
# M meaning continuity
# S stewardship density
# C correction capacity
# R renewal capacity
#
# Destabilizers:
# O optimization pressure
# D dependency drift
# A alienation
# Fg fragmentation
# L rigidity / lock-in
# E emotional flattening

N = 80          # agents / sub-systems
T_STEPS = 1000
SEEDS = range(200, 240)

DRIVERS = ["T_truth", "P_participation", "M_meaning", "S_stewardship", "C_correction", "R_renewal"]
DESTABS = ["O_optimization", "D_dependency", "A_alienation", "Fg_fragmentation", "L_lockin", "E_flattening"]

def geometric_mean(x, axis=None):
    return np.exp(np.mean(np.log(np.clip(x, 1e-6, None)), axis=axis))

def flourishing(drivers, destabs):
    return geometric_mean(drivers, axis=1) / geometric_mean(destabs, axis=1)

def run_civilization_sim(mode, seed):
    rng = np.random.default_rng(seed)
    
    # initialize drivers and destabilizers in bounded state-space [0.05, 1.0]
    drivers = rng.uniform(0.35, 0.65, (N, 6))
    destabs = rng.uniform(0.25, 0.55, (N, 6))
    
    # memory of prior viable state
    driver_memory = drivers.copy()
    destab_memory = destabs.copy()
    
    history = []
    
    # network for distributed local correction
    adj = rng.random((N, N)) < 0.08
    np.fill_diagonal(adj, False)
    deg = adj.sum(axis=1)
    deg[deg == 0] = 1
    
    for t in range(T_STEPS):
        # shock schedule: information shock, dependency shock, lock-in shock
        shock_info = 0.0
        shock_dependency = 0.0
        shock_lockin = 0.0
        
        if 250 <= t < 320:
            shock_info = 0.35
        if 520 <= t < 590:
            shock_dependency = 0.45
        if 760 <= t < 820:
            shock_lockin = 0.40
        
        noise = rng.normal(0, 0.01, drivers.shape)
        dnoise = rng.normal(0, 0.012, destabs.shape)
        
        F_now = flourishing(drivers, destabs)
        system_F = float(np.mean(F_now))
        
        # dominant instability per agent: largest destabilizer
        dom_destab_idx = np.argmax(destabs, axis=1)
        
        if mode == "centralized_optimization":
            # Push optimization pressure; improves short-term output but increases lock-in, alienation, flattening.
            drivers[:, 0] += 0.004  # truth compatibility mildly improves
            drivers[:, 5] -= 0.002  # renewal declines under rigidity
            destabs[:, 0] += 0.006  # optimization pressure
            destabs[:, 2] += 0.004  # alienation
            destabs[:, 4] += 0.006  # lock-in
            destabs[:, 5] += 0.003  # emotional flattening
            
            # Global correction is blunt: reduces fragmentation but damages participation
            destabs[:, 3] -= 0.004
            drivers[:, 1] -= 0.003
            
        elif mode == "laissez_faire_noise":
            # No coherent correction. Everything drifts under shocks/noise.
            drivers += noise - 0.0015
            destabs += dnoise + 0.001
            
        elif mode == "distributed_recursive_correction":
            # Local perception of instability
            # Correction capacity C and participation P control local adaptive correction strength
            correction_pressure = 0.035 * drivers[:, 4] * drivers[:, 1]
            
            # Reduce each agent's dominant destabilizer with bounded correction.
            for i in range(N):
                j = dom_destab_idx[i]
                destabs[i, j] -= correction_pressure[i] * (1 - destabs[i, j])
            
            # Network sharing: local neighbors improve truth, meaning, stewardship slightly.
            neighbor_drivers = (adj @ drivers) / deg[:, None]
            drivers += 0.012 * (neighbor_drivers - drivers)
            
            # Preservation-over-correction: pull toward prior viable state only when current F falls below memory F.
            mem_F = flourishing(driver_memory, destab_memory)
            underperform = (F_now < mem_F).astype(float)[:, None]
            drivers += 0.018 * underperform * (driver_memory - drivers)
            destabs += 0.018 * underperform * (destab_memory - destabs)
            
            # Renewal increases when correction works; participation/stewardship strengthen under distributed correction.
            drivers[:, 5] += 0.004 * drivers[:, 4] * (1 - destabs[:, 4])
            drivers[:, 1] += 0.003 * (1 - destabs[:, 2])
            drivers[:, 3] += 0.003 * (1 - destabs[:, 0])
            
            # Penalty for overcorrection: if correction capacity too high relative to participation, alienation rises.
            overcorrection = np.maximum(drivers[:, 4] - drivers[:, 1], 0)
            destabs[:, 2] += 0.003 * overcorrection
            
            # Update viable memory slowly only when not in shock and system is improving.
            if shock_info + shock_dependency + shock_lockin < 0.1:
                improved = (F_now > mem_F).astype(float)[:, None]
                driver_memory = 0.985 * driver_memory + 0.015 * (improved * drivers + (1-improved) * driver_memory)
                destab_memory = 0.985 * destab_memory + 0.015 * (improved * destabs + (1-improved) * destab_memory)
        
        # Apply shocks
        destabs[:, 3] += shock_info * rng.uniform(0.4, 1.0, N)      # fragmentation
        drivers[:, 0] -= shock_info * rng.uniform(0.2, 0.6, N)      # truth degradation
        
        destabs[:, 1] += shock_dependency * rng.uniform(0.4, 1.0, N)
        drivers[:, 1] -= shock_dependency * rng.uniform(0.2, 0.5, N)
        
        destabs[:, 4] += shock_lockin * rng.uniform(0.4, 1.0, N)
        drivers[:, 5] -= shock_lockin * rng.uniform(0.2, 0.5, N)
        
        # Natural drift: destabilizers rise unless corrected; drivers decay without renewal
        drivers += rng.normal(0, 0.006, drivers.shape) - 0.0006
        destabs += rng.normal(0, 0.007, destabs.shape) + 0.0004
        
        drivers = np.clip(drivers, 0.03, 1.0)
        destabs = np.clip(destabs, 0.03, 1.2)
        
        F_after = flourishing(drivers, destabs)
        
        history.append({
            "mode": mode,
            "seed": seed,
            "cycle": t,
            "system_F": float(np.mean(F_after)),
            "median_F": float(np.median(F_after)),
            "low_tail_F": float(np.quantile(F_after, 0.10)),
            "driver_mean": float(np.mean(drivers)),
            "destab_mean": float(np.mean(destabs)),
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
        })
    
    return pd.DataFrame(history)

modes = ["centralized_optimization", "laissez_faire_noise", "distributed_recursive_correction"]

frames = []
for mode in modes:
    for seed in SEEDS:
        frames.append(run_civilization_sim(mode, seed))
df = pd.concat(frames, ignore_index=True)

summary_rows = []
for mode in modes:
    d = df[df["mode"] == mode]
    for seed in SEEDS:
        s = d[d["seed"] == seed]
        final = s.iloc[-1]
        shock1_recovery = s[(s["cycle"] >= 320) & (s["cycle"] < 420)]["system_F"].mean()
        shock2_recovery = s[(s["cycle"] >= 590) & (s["cycle"] < 690)]["system_F"].mean()
        shock3_recovery = s[(s["cycle"] >= 820) & (s["cycle"] < 920)]["system_F"].mean()
        summary_rows.append({
            "mode": mode,
            "seed": seed,
            "final_system_F": final["system_F"],
            "final_low_tail_F": final["low_tail_F"],
            "final_driver_mean": final["driver_mean"],
            "final_destab_mean": final["destab_mean"],
            "shock1_recovery_F": shock1_recovery,
            "shock2_recovery_F": shock2_recovery,
            "shock3_recovery_F": shock3_recovery,
            "final_truth": final["truth"],
            "final_participation": final["participation"],
            "final_correction": final["correction"],
            "final_renewal": final["renewal"],
            "final_optimization": final["optimization"],
            "final_dependency": final["dependency"],
            "final_alienation": final["alienation"],
            "final_fragmentation": final["fragmentation"],
            "final_lockin": final["lockin"],
            "final_flattening": final["flattening"],
        })
summary_seed = pd.DataFrame(summary_rows)
summary = summary_seed.groupby("mode").agg(
    final_F_mean=("final_system_F","mean"),
    final_F_std=("final_system_F","std"),
    low_tail_F_mean=("final_low_tail_F","mean"),
    driver_mean=("final_driver_mean","mean"),
    destab_mean=("final_destab_mean","mean"),
    shock1_recovery=("shock1_recovery_F","mean"),
    shock2_recovery=("shock2_recovery_F","mean"),
    shock3_recovery=("shock3_recovery_F","mean"),
    final_truth=("final_truth","mean"),
    final_participation=("final_participation","mean"),
    final_correction=("final_correction","mean"),
    final_renewal=("final_renewal","mean"),
    final_optimization=("final_optimization","mean"),
    final_dependency=("final_dependency","mean"),
    final_alienation=("final_alienation","mean"),
    final_fragmentation=("final_fragmentation","mean"),
    final_lockin=("final_lockin","mean"),
    final_flattening=("final_flattening","mean"),
).reset_index()

# Plot system flourishing over time
plot_df = df.groupby(["mode","cycle"])["system_F"].agg(["mean","std"]).reset_index()
fig, ax = plt.subplots(figsize=(12,6))
for mode in modes:
    p = plot_df[plot_df["mode"] == mode]
    x = p["cycle"].to_numpy()
    mean = p["mean"].to_numpy()
    std = p["std"].to_numpy()
    ax.plot(x, mean, label=mode)
    ax.fill_between(x, mean-std, mean+std, alpha=0.12)
for start, end in [(250,320),(520,590),(760,820)]:
    ax.axvspan(start, end, alpha=0.10)
ax.set_title("DT Flourishing/Resilience Simulation: Adaptive Correction vs Optimization")
ax.set_xlabel("Cycle")
ax.set_ylabel("System Flourishing F(t)")
ax.legend()

plot_path = "/mnt/data/dt_flourishing_resilience_sim.png"
summary_path = "/mnt/data/dt_flourishing_summary.csv"
seed_path = "/mnt/data/dt_flourishing_by_seed.csv"
history_path = "/mnt/data/dt_flourishing_history.csv"

fig.savefig(plot_path, bbox_inches="tight")
summary.to_csv(summary_path, index=False)
summary_seed.to_csv(seed_path, index=False)
df.to_csv(history_path, index=False)

print(summary[["mode","final_F_mean","low_tail_F_mean","driver_mean","destab_mean","shock1_recovery","shock2_recovery","shock3_recovery"]])
print(f"\nSaved plot: {plot_path}")
print(f"Saved summary: {summary_path}")
print(f"Saved per-seed summary: {seed_path}")
print(f"Saved full history: {history_path}")