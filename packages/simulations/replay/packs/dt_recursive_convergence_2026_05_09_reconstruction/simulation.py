"""DT recursive convergence simulation — repaired reconstruction.

Source: SOURCE — Gmail — Sim Code phase correction — May 9 2026.pdf
Drive ID: 1tRSme6ZtvUfAMSW4fwU43VsR3LFi1eNP
Source class: LATER_RECONSTRUCTION from primary source text.

The PDF text extraction merged several adjacent tokens/lines. This file makes
only syntax-separating repairs needed to execute the recovered algorithm. It is
NOT represented as byte-identical historical source and is NOT physical proof
of DT.
"""
from __future__ import annotations

import argparse
from pathlib import Path
from time import perf_counter

import numpy as np
import pandas as pd

SEED = 20260609
DOMAINS = [
    "lithium_BBN", "black_hole", "AI_agency", "prism_defense",
    "biology", "institutional", "thermo_diffusion", "quantum_threshold",
]
FEATURES = ["L", "W", "K", "V", "C", "A"]
N, F = len(DOMAINS), len(FEATURES)
FI = {f: i for i, f in enumerate(FEATURES)}

TARGET = np.array([
    [0.92, 0.88, 0.72, 0.55, 0.78, 0.62],
    [0.86, 0.82, 0.88, 0.68, 0.84, 0.54],
    [0.72, 0.70, 0.82, 0.45, 0.70, 0.86],
    [0.88, 0.76, 0.80, 0.50, 0.82, 0.78],
    [0.70, 0.84, 0.76, 0.48, 0.66, 0.72],
    [0.66, 0.68, 0.72, 0.60, 0.80, 0.68],
    [0.58, 0.72, 0.62, 0.75, 0.58, 0.66],
    [0.80, 0.78, 0.84, 0.62, 0.76, 0.70],
])
PAIR_MAP = [
    [(0, 1), (1, 3), (0, 4)],
    [(2, 4), (3, 2), (0, 4)],
    [(5, 2), (5, 4), (0, 5)],
    [(0, 4), (4, 5), (0, 1)],
    [(1, 2), (1, 5), (3, 5)],
    [(4, 5), (4, 1), (0, 4)],
    [(3, 1), (3, 2), (1, 5)],
    [(2, 0), (2, 4), (3, 2)],
]
TRIAD_MAP = [
    [(0, 1, 3), (0, 4, 2)],
    [(2, 4, 3), (0, 2, 4)],
    [(5, 2, 4), (0, 5, 1)],
    [(0, 4, 5), (0, 1, 4)],
    [(1, 2, 5), (1, 3, 5)],
    [(4, 5, 1), (0, 4, 5)],
    [(3, 1, 2), (3, 5, 1)],
    [(2, 0, 4), (2, 3, 0)],
]


def make_start(rng: np.random.Generator, scale: float = 0.18):
    d = rng.normal(0, 1, (N, F))
    d = d / np.sqrt((d * d).mean(axis=1))[:, None]
    d *= rng.uniform(scale * 0.75, scale * 1.25, (N, 1))
    return np.clip(TARGET + d, 0, 1)


def branch_error(x):
    return np.sqrt(((x - TARGET) ** 2).mean(axis=1))


def pair_rms(x):
    vals = []
    for i in range(N):
        for a, b in PAIR_MAP[i]:
            vals.append((x[i, a] - x[i, b]) - (TARGET[i, a] - TARGET[i, b]))
    return float(np.sqrt(np.mean(np.array(vals) ** 2)))


def triad_rms(x):
    vals = []
    for i in range(N):
        for a, b, c in TRIAD_MAP[i]:
            current = (x[i, a] - x[i, b]) + (x[i, b] - x[i, c])
            target = (TARGET[i, a] - TARGET[i, b]) + (TARGET[i, b] - TARGET[i, c])
            vals.append(current - target)
    return float(np.sqrt(np.mean(np.array(vals) ** 2)))


def metrics(x):
    e = branch_error(x)
    return {
        "mean_error": float(e.mean()),
        "max_error": float(e.max()),
        "pair_rms": pair_rms(x),
        "triad_rms": triad_rms(x),
        "viable": int((e < 0.05).sum()),
        "mid": int((e < 0.035).sum()),
        "ultra": int((e < 0.02).sum()),
        "singular": int((e < 0.015).sum()),
        "deep": int((e < 0.01).sum()),
        "very_deep": int((e < 0.005).sum()),
        "ultra_deep": int((e < 0.002).sum()),
        "access": float(x[:, FI["A"]].mean() * 0.55 + x[:, FI["V"]].mean() * 0.45),
        "spread": float(np.std(x, axis=0).mean()),
    }


def propulsion_4d_gates(x, update):
    craft_dp = np.linalg.norm(update[:, [FI["L"], FI["C"], FI["A"]]], axis=1)
    env_dp = 0.72 * craft_dp
    wake_dp = 0.28 * craft_dp
    momentum_residual = np.abs(craft_dp - env_dp - wake_dp).mean()
    input_e = np.sum(update ** 2, axis=1)
    energy_residual = np.abs(input_e - (0.58 + 0.22 + 0.12 + 0.08) * input_e).mean()
    v_omega = np.clip(x[:, FI["V"]] + 0.25 * np.linalg.norm(update, axis=1), 0, 2)
    causality_violation = np.maximum(0, v_omega - 1).mean()
    heat = (0.12 * input_e).mean()
    wake = (0.08 * input_e).mean()
    detectability = 0.004 + 0.8 * heat + 0.6 * wake + 0.15 * np.std(update)
    before = np.linalg.norm(x - TARGET)
    after = np.linalg.norm(np.clip(x + update, 0, 1) - TARGET)
    homecoming_overlap = np.exp(-np.linalg.norm(update) * 0.75) * (1 if after <= before + 0.01 else 0.75)
    valid = (
        momentum_residual < 1e-5
        and energy_residual < 1e-5
        and causality_violation < 0.02
        and detectability > 0.003
        and homecoming_overlap > 0.70
    )
    return {
        "momentum_residual": float(momentum_residual),
        "energy_residual": float(energy_residual),
        "causality_violation": float(causality_violation),
        "detectability": float(detectability),
        "homecoming_overlap": float(homecoming_overlap),
        "valid": bool(valid),
    }


def fact_entry_update(x):
    e = branch_error(x)
    r = TARGET - x
    u = np.zeros_like(x)
    for i in range(N):
        if e[i] > 0.05:
            u[i] += 0.065 * r[i]
        else:
            j = np.argmax(np.abs(r[i]))
            u[i, j] += 0.050 * r[i, j]
    return u


def topology_update(x, no_improve=None):
    e = branch_error(x)
    r = TARGET - x
    m = metrics(x)
    u = np.zeros_like(x)
    if m["viable"] < N:
        phase = "repair"
    elif m["deep"] < N:
        phase = "pair"
    elif m["very_deep"] < N:
        phase = "triad"
    else:
        phase = "preserve"
    stalled = np.zeros(N, dtype=bool)
    if no_improve is not None:
        stalled = (no_improve > 14) & (e > 0.006)
    if stalled.any():
        phase = "reopen"
    for i in range(N):
        if phase == "repair":
            u[i] += 0.055 * r[i]
        elif phase == "reopen" and stalled[i]:
            j = np.argmax(np.abs(r[i]))
            u[i, j] += 0.055 * r[i, j]
            a, b = PAIR_MAP[i][0]
            pe = (x[i, a] - x[i, b]) - (TARGET[i, a] - TARGET[i, b])
            u[i, a] += -0.026 * pe * 0.5
            u[i, b] += 0.026 * pe * 0.5
        elif phase == "pair":
            if e[i] > 0.012:
                j = np.argmax(np.abs(r[i]))
                u[i, j] += 0.025 * r[i, j]
            for a, b in PAIR_MAP[i]:
                pe = (x[i, a] - x[i, b]) - (TARGET[i, a] - TARGET[i, b])
                u[i, a] += -0.020 * pe * 0.5
                u[i, b] += 0.020 * pe * 0.5
        elif phase == "triad":
            for a, b, c in TRIAD_MAP[i]:
                te = ((x[i, a] - x[i, b]) + (x[i, b] - x[i, c])) - (
                    (TARGET[i, a] - TARGET[i, b]) + (TARGET[i, b] - TARGET[i, c])
                )
                u[i, a] += -0.010 * te * 0.45
                u[i, b] += -0.010 * te * 0.10
                u[i, c] += 0.010 * te * 0.45
            u[i] += 0.002 * r[i]
        else:
            u[i] += 0.001 * r[i]
    preserve = e < 0.005
    u[preserve] *= 0.30
    u[:, FI["A"]] += np.maximum(0, 0.62 - x[:, FI["A"]]) * 0.0008
    u[:, FI["V"]] += np.maximum(0, 0.52 - x[:, FI["V"]]) * 0.0008
    return u, phase, int(stalled.sum())


def prism_apply(x, update, age=0):
    e = branch_error(x)
    r = TARGET - x
    g = max(0.18, 0.85 * np.exp(-age / 160))
    preserve = e < 0.02
    update[preserve] *= 1 - 0.65 * g
    wrong = (np.sign(update) != np.sign(r)) & (np.abs(update) > 0.006)
    update[wrong] *= 1 - 0.85 * g
    prism_branch = DOMAINS.index("prism_defense")
    balance = (
        x[prism_branch, FI["L"]]
        + x[prism_branch, FI["C"]]
        + x[prism_branch, FI["A"]]
    ) / 3
    update[:, FI["C"]] += 0.0012 * g * (balance - x[:, FI["C"]])
    return update


def run_sim(mode="hybrid", max_cycles=650, use_prism=True,
            use_propulsion_gates=True, scale=0.18, seed=SEED):
    rng = np.random.default_rng(seed)
    x = make_start(rng, scale=scale)
    rollbacks = 0
    waste = 0.0
    phase_switches = 0
    reopen_events = 0
    prism_on = False
    prism_age = 0
    best_err = branch_error(x).copy()
    no_improve = np.zeros(N)
    last_phase = None
    history = []
    start_time = perf_counter()
    for cycle in range(max_cycles):
        old = x.copy()
        old_m = metrics(x)
        e = branch_error(x)
        improved = e < best_err - 0.00008
        best_err = np.minimum(best_err, e)
        no_improve[improved] = 0
        no_improve[~improved] += 1
        if use_prism and not prism_on and old_m["mean_error"] < 0.12:
            prism_on = True
            prism_age = 0
        if mode == "fact_only":
            update = fact_entry_update(x)
            phase = "fact"
        elif mode == "topology_only":
            update, phase, reopened = topology_update(x, no_improve=no_improve)
            reopen_events += reopened
        elif mode == "hybrid":
            if old_m["viable"] < N or old_m["mean_error"] > 0.035:
                update = fact_entry_update(x)
                phase = "fact_entry"
            else:
                update, phase, reopened = topology_update(x, no_improve=no_improve)
                reopen_events += reopened
        else:
            raise ValueError("mode must be fact_only, topology_only, or hybrid")
        if last_phase is not None and phase != last_phase:
            phase_switches += 1
        last_phase = phase
        if prism_on:
            update = prism_apply(x, update, age=prism_age)
            prism_age += 1
        if use_propulsion_gates:
            gates = propulsion_4d_gates(x, update)
            if not gates["valid"]:
                accepted = False
                for scale_factor in [0.5, 0.25, 0.1, 0.05, 0.02]:
                    test_update = update * scale_factor
                    test_gates = propulsion_4d_gates(x, test_update)
                    if test_gates["valid"]:
                        update = test_update
                        accepted = True
                        break
                if not accepted:
                    update *= 0.02
        noise = max(0.00002, 0.00055 * (0.988 ** cycle))
        proposal = np.clip(x + update + rng.normal(0, noise, (N, F)), 0, 1)
        new_m = metrics(proposal)
        strict = mode != "fact_only" and phase != "fact_entry"
        invalid = (
            new_m["mean_error"] > old_m["mean_error"] + (0.00004 if strict else 0.00014)
            or (strict and new_m["access"] < 0.55)
            or (strict and new_m["spread"] < 0.045)
        )
        if invalid:
            rollbacks += 1
            waste += float(np.sqrt((update * update).mean()))
            if strict:
                x = np.clip(old + 0.010 * (TARGET - old), 0, 1)
            else:
                x = old
        else:
            x = proposal
        m = metrics(x)
        history.append({
            "cycle": cycle + 1,
            "phase": phase,
            "prism_on": prism_on,
            **m,
            "rollbacks": rollbacks,
            "waste": waste,
            "reopen_events": reopen_events,
            "phase_switches": phase_switches,
        })
        if m["very_deep"] == N and m["pair_rms"] < 0.003 and m["triad_rms"] < 0.003:
            break
    runtime = perf_counter() - start_time
    final = metrics(x)
    result = {
        "mode": mode,
        "cycles": cycle + 1,
        **final,
        "rollbacks": rollbacks,
        "waste": waste,
        "reopen_events": reopen_events,
        "phase_switches": phase_switches,
        "runtime": runtime,
        "seed": seed,
    }
    return result, pd.DataFrame(history), x


def run_batch(trials=50, out_dir=".", seed=SEED):
    rows = []
    all_history = []
    for mode_index, mode in enumerate(["fact_only", "topology_only", "hybrid"]):
        for trial in range(trials):
            trial_seed = seed + mode_index * 100000 + trial
            result, history, _ = run_sim(mode=mode, seed=trial_seed)
            result["trial"] = trial + 1
            rows.append(result)
            history["trial"] = trial + 1
            history["mode"] = mode
            all_history.append(history)
    df = pd.DataFrame(rows)
    hist = pd.concat(all_history, ignore_index=True)
    summary = df.groupby("mode").agg(
        avg_cycles=("cycles", "mean"), avg_mean=("mean_error", "mean"),
        avg_pair=("pair_rms", "mean"), avg_triad=("triad_rms", "mean"),
        avg_deep=("deep", "mean"), avg_very_deep=("very_deep", "mean"),
        avg_ultra_deep=("ultra_deep", "mean"), avg_rollbacks=("rollbacks", "mean"),
        avg_waste=("waste", "mean"), avg_switches=("phase_switches", "mean"),
        avg_reopen=("reopen_events", "mean"), avg_runtime=("runtime", "mean"),
    ).reset_index()
    summary["score"] = (
        -summary["avg_mean"] * 180 - summary["avg_pair"] * 80
        -summary["avg_triad"] * 80 + summary["avg_very_deep"] * 2
        + summary["avg_ultra_deep"] * 2 - summary["avg_cycles"] * 0.002
        - summary["avg_waste"] * 2
    )
    summary = summary.sort_values("score", ascending=False)
    lessons = pd.DataFrame([
        {"lesson": "Fact memory handles entry/proximity.",
         "meaning": "It gets near the answer quickly but may leave relational error."},
        {"lesson": "Topology inheritance handles refinement/coherence.",
         "meaning": "It reduces pair/triad structural error but can stagnate if used too early."},
        {"lesson": "Hybrid requires stable handoff.",
         "meaning": "Use fact entry first, then topology refinement."},
        {"lesson": "Selective reopening is required.",
         "meaning": "Preservation without reopening causes stagnation."},
        {"lesson": "Propulsion/4D constraints are gates.",
         "meaning": "They enforce modeled conservation, causality, detectability, wake/heat, and overlap."},
    ])
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    df.to_csv(out / "dt_full_sim_trials.csv", index=False)
    hist.to_csv(out / "dt_full_sim_history.csv", index=False)
    summary.to_csv(out / "dt_full_sim_summary.csv", index=False)
    lessons.to_csv(out / "dt_full_sim_lessons.csv", index=False)
    print("SUMMARY")
    print(summary.to_string(index=False))
    return df, hist, summary, lessons


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--trials", type=int, default=50)
    parser.add_argument("--out-dir", default=".")
    parser.add_argument("--seed", type=int, default=SEED)
    args = parser.parse_args()
    run_batch(trials=args.trials, out_dir=args.out_dir, seed=args.seed)


if __name__ == "__main__":
    main()
