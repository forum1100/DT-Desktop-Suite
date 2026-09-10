import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# MERGED DT SIMULATION v2
# Adds "amplified static" correction:
# - persistence substrate no longer collapses to zero
# - static field acts as bounded structural baseline, not additive runaway energy
# - preserves critique controls and ablations

N = 80
T_STEPS = 900
SEEDS = range(400, 420)

modes = [
    "centralized_optimization",
    "laissez_faire_noise",
    "random_policy_control",
    "distributed_full",
    "distributed_no_memory",
    "distributed_no_network",
    "distributed_no_overcorrection_penalty",
]

def gmean(x, axis=None):
    return np.exp(np.mean(np.log(np.clip(x, 1e-8, None)), axis=axis))

def flourishing(drivers, destabs):
    return gmean(drivers, axis=1) / gmean(destabs, axis=1)

def run_merged_static(mode, seed):
    rng = np.random.default_rng(seed)

    drivers = rng.uniform(0.35, 0.65, (N, 6))
    destabs = rng.uniform(0.25, 0.55, (N, 6))

    # Bounded persistence state
    P = rng.uniform(0.1, 0.3, N)
    R = rng.uniform(0.1, 0.2, N)
    M_persist = np.zeros(N)

    # Amplified static field: baseline structural persistence
    # It evolves slowly and prevents total substrate collapse.
    S_static = rng.uniform(0.35, 0.55, N)

    driver_memory = drivers.copy()
    destab_memory = destabs.copy()

    adj = rng.random((N, N)) < 0.08
    np.fill_diagonal(adj, False)
    deg = adj.sum(axis=1)
    deg[deg == 0] = 1

    history = []

    for t in range(T_STEPS):
        shock_info = shock_dependency = shock_lockin = shock_fragment = 0.0
        if 220 <= t < 290:
            shock_info = 0.35
            shock_fragment = 0.20
        if 430 <= t < 510:
            shock_dependency = 0.45
        if 630 <= t < 710:
            shock_lockin = 0.42
        if 790 <= t < 840:
            shock_info = 0.25
            shock_dependency = 0.25
            shock_lockin = 0.25

        shock_intensity = 1 + shock_info + shock_dependency + shock_lockin + shock_fragment

        # Static field updates slowly from truth/meaning/stewardship/correction/renewal,
        # but is penalized by lock-in/fragmentation. This is not an additive energy source.
        static_support = (
            0.20*drivers[:,0] +   # truth
            0.18*drivers[:,2] +   # meaning
            0.20*drivers[:,3] +   # stewardship
            0.22*drivers[:,4] +   # correction
            0.20*drivers[:,5]     # renewal
        ) / (1 + 0.55*destabs[:,3] + 0.55*destabs[:,4])

        S_static = 0.985*S_static + 0.015*static_support
        S_static = np.clip(S_static, 0.05, 1.0)

        # bounded persistence substrate
        I = rng.uniform(0.4, 1.0, N)
        Cc = drivers[:, 4] * (1 - destabs[:, 3])
        K = drivers[:, 2] * (1 - destabs[:, 5])
        V = np.clip(destabs[:, 3] + destabs[:, 4] + destabs[:, 1], 0, 3) / 3
        D = np.clip(destabs.mean(axis=1), 0, 1.2)

        pair = np.abs(P - np.roll(P, 1))
        triad = np.abs((P - np.roll(P, 1)) + (np.roll(P, 1) - np.roll(P, 2)))
        variance_pressure = np.abs(P - np.mean(P))

        M_persist = 0.96 * M_persist + 0.04 * P
        convergence_pressure = np.clip(np.mean(np.abs(P-M_persist))/(np.mean(P)+1e-9), 0, 1)

        # Amplified static correction:
        # Static field increases the denominator stability and also gives a weak pull
        # toward a bounded persistence floor. It cannot explode because the pull is
        # proportional to (S_static - P/(1+P)).
        static_floor_pull = 0.035 * (S_static - (P/(1+P)))

        base_p = (
            0.070 * (I*Cc*K*(1+R)*(1 + 0.35*S_static)) /
            (1 + 0.30*P + 0.30*R + 0.65*pair + 0.45*triad + 0.25*V)
        ) - 0.035*(D*V)*shock_intensity

        memory_pull = -0.045 * convergence_pressure * (P - M_persist)
        variance_damping = -0.012 * variance_pressure
        lockin_penalty = -0.005 * np.maximum(P - 10.0, 0)

        P = np.clip(P + base_p + memory_pull + variance_damping + lockin_penalty + static_floor_pull, 0, 100)
        R = 0.96*R + 0.04*P

        F_now = flourishing(drivers, destabs)
        dom = np.argmax(destabs, axis=1)

        # policy branch
        if mode == "centralized_optimization":
            drivers[:,0] += 0.004
            drivers[:,5] -= 0.002
            drivers[:,1] -= 0.003
            destabs[:,0] += 0.006
            destabs[:,2] += 0.004
            destabs[:,4] += 0.006
            destabs[:,5] += 0.003
            destabs[:,3] -= 0.004

        elif mode == "laissez_faire_noise":
            drivers += rng.normal(0,0.012,drivers.shape) - 0.0015
            destabs += rng.normal(0,0.013,destabs.shape) + 0.001

        elif mode == "random_policy_control":
            drivers += rng.normal(0,0.006,drivers.shape)
            destabs += rng.normal(0,0.006,destabs.shape)

        elif mode.startswith("distributed"):
            # static amplification supports correction, but only through existing capacity
            corr = 0.028 * drivers[:,4] * drivers[:,1] * (1 + P/(1+P)) * (1 + 0.20*S_static)

            rows = np.arange(N)
            destabs[rows, dom] -= corr * (1 - destabs[rows, dom])

            if mode != "distributed_no_network":
                neighbor_drivers = (adj @ drivers) / deg[:, None]
                drivers += 0.010 * (neighbor_drivers - drivers)

            if mode != "distributed_no_memory":
                mem_F = flourishing(driver_memory, destab_memory)
                under = (F_now < mem_F).astype(float)[:, None]
                drivers += 0.016 * under * (driver_memory - drivers)
                destabs += 0.016 * under * (destab_memory - destabs)

            drivers[:,5] += 0.0035 * drivers[:,4] * (1 - destabs[:,4]) * (1 + 0.10*S_static)
            drivers[:,1] += 0.0025 * (1 - destabs[:,2])
            drivers[:,3] += 0.0025 * (1 - destabs[:,0])

            if mode != "distributed_no_overcorrection_penalty":
                overcorr = np.maximum(drivers[:,4] - drivers[:,1], 0)
                destabs[:,2] += 0.003 * overcorr

            if mode != "distributed_no_memory":
                mem_F = flourishing(driver_memory, destab_memory)
                improved = (F_now > mem_F).astype(float)[:,None]
                shock_gate = 1 if shock_intensity < 1.2 else 0
                driver_memory = 0.987*driver_memory + 0.013*shock_gate*(improved*drivers + (1-improved)*driver_memory)
                destab_memory = 0.987*destab_memory + 0.013*shock_gate*(improved*destabs + (1-improved)*destab_memory)

        # exogenous shocks
        if shock_info:
            destabs[:,3] += shock_info * rng.uniform(0.4,1.0,N)
            drivers[:,0] -= shock_info * rng.uniform(0.2,0.6,N)
        if shock_fragment:
            destabs[:,3] += shock_fragment * rng.uniform(0.3,0.8,N)
        if shock_dependency:
            destabs[:,1] += shock_dependency * rng.uniform(0.4,1.0,N)
            drivers[:,1] -= shock_dependency * rng.uniform(0.2,0.5,N)
        if shock_lockin:
            destabs[:,4] += shock_lockin * rng.uniform(0.4,1.0,N)
            drivers[:,5] -= shock_lockin * rng.uniform(0.2,0.5,N)

        drivers += rng.normal(0,0.0055,drivers.shape) - 0.00045
        destabs += rng.normal(0,0.0065,destabs.shape) + 0.00035

        drivers = np.clip(drivers,0.03,1.0)
        destabs = np.clip(destabs,0.03,1.2)

        if t % 5 == 0 or t == T_STEPS-1:
            F_after = flourishing(drivers, destabs)
            history.append({
                "mode": mode,
                "seed": seed,
                "cycle": t,
                "system_F": float(np.mean(F_after)),
                "low_tail_F": float(np.quantile(F_after,0.10)),
                "driver_mean": float(np.mean(drivers)),
                "destab_mean": float(np.mean(destabs)),
                "mean_P": float(np.mean(P)),
                "max_P": float(np.max(P)),
                "mean_static": float(np.mean(S_static)),
                "truth": float(np.mean(drivers[:,0])),
                "participation": float(np.mean(drivers[:,1])),
                "correction": float(np.mean(drivers[:,4])),
                "renewal": float(np.mean(drivers[:,5])),
                "alienation": float(np.mean(destabs[:,2])),
                "fragmentation": float(np.mean(destabs[:,3])),
                "lockin": float(np.mean(destabs[:,4])),
                "shock_intensity": shock_intensity,
            })
    return pd.DataFrame(history)

frames = []
for mode in modes:
    for seed in SEEDS:
        frames.append(run_merged_static(mode, seed))
df_static = pd.concat(frames, ignore_index=True)

# summaries
rows = []
for mode in modes:
    dmode = df_static[df_static["mode"] == mode]
    for seed in SEEDS:
        s = dmode[dmode["seed"] == seed]
        final = s.iloc[-1]
        recs = []
        for start, end in [(290,390),(510,610),(710,810),(840,899)]:
            w = s[(s["cycle"]>=start)&(s["cycle"]<end)]
            recs.append(w["system_F"].mean())
        rows.append({
            "mode": mode,
            "seed": seed,
            "final_F": final["system_F"],
            "final_low_tail_F": final["low_tail_F"],
            "final_driver_mean": final["driver_mean"],
            "final_destab_mean": final["destab_mean"],
            "final_mean_P": final["mean_P"],
            "final_max_P": final["max_P"],
            "final_static": final["mean_static"],
            "avg_recovery_F": float(np.mean(recs)),
            "min_recovery_F": float(np.nanmin(recs)),
            "final_participation": final["participation"],
            "final_correction": final["correction"],
            "final_renewal": final["renewal"],
            "final_alienation": final["alienation"],
            "final_fragmentation": final["fragmentation"],
            "final_lockin": final["lockin"],
        })
summary_seed_static = pd.DataFrame(rows)

summary_static = summary_seed_static.groupby("mode").agg(
    final_F_mean=("final_F","mean"),
    final_F_std=("final_F","std"),
    low_tail_F_mean=("final_low_tail_F","mean"),
    driver_mean=("final_driver_mean","mean"),
    destab_mean=("final_destab_mean","mean"),
    final_mean_P=("final_mean_P","mean"),
    final_max_P=("final_max_P","mean"),
    final_static=("final_static","mean"),
    avg_recovery_F=("avg_recovery_F","mean"),
    min_recovery_F=("min_recovery_F","mean"),
    final_participation=("final_participation","mean"),
    final_correction=("final_correction","mean"),
    final_renewal=("final_renewal","mean"),
    final_alienation=("final_alienation","mean"),
    final_fragmentation=("final_fragmentation","mean"),
    final_lockin=("final_lockin","mean"),
).reset_index().sort_values("final_F_mean", ascending=False)

# Plot
plot_df = df_static.groupby(["mode","cycle"])["system_F"].agg(["mean","std"]).reset_index()
fig, ax = plt.subplots(figsize=(13,7))
for mode in modes:
    p = plot_df[plot_df["mode"] == mode]
    ax.plot(p["cycle"], p["mean"], label=mode)
for start, end in [(220,290),(430,510),(630,710),(790,840)]:
    ax.axvspan(start, end, alpha=0.08)
ax.set_title("Merged DT Simulation v2: Amplified Static + Resilience")
ax.set_xlabel("Cycle")
ax.set_ylabel("System Flourishing F(t)")
ax.legend(fontsize=8)

plot_path = "/mnt/data/dt_merged_static_resilience.png"
summary_path = "/mnt/data/dt_merged_static_summary.csv"
seed_path = "/mnt/data/dt_merged_static_by_seed.csv"
history_path = "/mnt/data/dt_merged_static_history.csv"

fig.savefig(plot_path, bbox_inches="tight")
summary_static.to_csv(summary_path, index=False)
summary_seed_static.to_csv(seed_path, index=False)
df_static.to_csv(history_path, index=False)

print(summary_static[["mode","final_F_mean","low_tail_F_mean","avg_recovery_F","final_mean_P","final_static","destab_mean","final_lockin","final_alienation"]].to_string(index=False))
print(f"\nSaved plot: {plot_path}")
print(f"Saved summary: {summary_path}")
print(f"Saved per-seed summary: {seed_path}")
print(f"Saved full history: {history_path}")