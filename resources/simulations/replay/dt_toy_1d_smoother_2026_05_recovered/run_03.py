import random, statistics, math
from collections import defaultdict, Counter

# Implement compact full architecture for running only (not final full code yet)
USE_FIXED_SEEDS=True
SEEDS=[42,1337,2026]
FACT_COUNT=40
RELATION_COUNT=70
FRAGMENT_COUNT=5
TRIALS=60
DECAY_CYCLES=4

RELATION_TYPES=["supports","contradicts","depends_on","causes","limits","preserves","weakens","clarifies"]

SCENARIOS=[
    {"name":"moderate_decay","fragment_visibility":0.55,"relation_visibility":0.50,"noise_rate":0.10,"contradiction_rate":0.08,"reliability_spread":0.20,"decay_rate":0.08},
    {"name":"conflict_decay","fragment_visibility":0.50,"relation_visibility":0.45,"noise_rate":0.20,"contradiction_rate":0.25,"reliability_spread":0.35,"decay_rate":0.10},
]
SIGNALS={
    "source_reliability": True,
    "contradiction_pressure": True,
    "context_decay": True,
    "fragment_independence": True,
    "relation_vote_margin": True,
}
TEST_REGISTRY=[]; RESULT_REGISTRY=[]; SIGNAL_REGISTRY=[]; DERIVATIVE_REGISTRY=[]; CONVERGENCE_REGISTRY=[]; BRANCH_REGISTRY=[]; INTERACTION_REGISTRY=[]; PERMUTATION_REGISTRY=[]; ABLATION_REGISTRY=[]

def opposite_relation(r):
    opposites={"supports":"contradicts","contradicts":"supports","preserves":"weakens","weakens":"preserves","clarifies":"limits","limits":"clarifies","causes":"depends_on","depends_on":"causes"}
    return opposites.get(r, random.choice(RELATION_TYPES))

def gen_truth():
    facts=[f"F{i}" for i in range(FACT_COUNT)]
    rels=set()
    while len(rels)<RELATION_COUNT:
        a,b=random.sample(facts,2); r=random.choice(RELATION_TYPES); rels.add((a,r,b))
    return set(facts),rels

def make_fragments(true_facts,true_relations,scenario, signals):
    fragments=[]
    for i in range(FRAGMENT_COUNT):
        reliability = 0.85 + random.uniform(-scenario["reliability_spread"], scenario["reliability_spread"])
        reliability=max(.05,min(1.0,reliability))
        if not signals.get("source_reliability",True):
            reliability=1.0
        frag_facts=set(); frag_rel=set(); frag_con=set(); frag_noise=set()
        for f in true_facts:
            if random.random()<scenario["fragment_visibility"]: frag_facts.add(f)
        for rel in true_relations:
            a,r,b=rel
            if random.random()<scenario["relation_visibility"] and a in frag_facts and b in frag_facts:
                frag_rel.add(rel)
            contradiction_rate=scenario["contradiction_rate"] if signals.get("contradiction_pressure",True) else 0.0
            if random.random()<contradiction_rate and a in frag_facts and b in frag_facts:
                frag_con.add((a,opposite_relation(r),b))
        noise_count=int(len(true_relations)*scenario["noise_rate"])
        pool=list(frag_facts)
        for _ in range(noise_count):
            if len(pool)>=2:
                a,b=random.sample(pool,2); r=random.choice(RELATION_TYPES)
                noisy=(a,r,b)
                if noisy not in true_relations: frag_noise.add(noisy)
        fragments.append({"id":f"S{i}","reliability":reliability,"facts":frag_facts,"relations":frag_rel,"contradictions":frag_con,"noise":frag_noise})
    return fragments

def decay_fragments(fragments, scenario, signals, cycle):
    if not signals.get("context_decay",True) or cycle==0:
        return fragments
    new=[]
    decay=scenario["decay_rate"]*cycle
    for frag in fragments:
        nfacts={f for f in frag["facts"] if random.random()>decay*0.5}
        def dec_set(s, mult=1.0):
            return {x for x in s if random.random()>decay*mult}
        new.append({"id":frag["id"],"reliability":max(.05, frag["reliability"]*(1-decay*0.35)),
                    "facts":nfacts,
                    "relations":dec_set(frag["relations"],1.0),
                    "contradictions":dec_set(frag["contradictions"],0.8),
                    "noise":dec_set(frag["noise"],0.6)})
    return new

def collect(frags):
    facts=set(); rels=set()
    for fr in frags:
        facts|=fr["facts"]; rels|=fr["relations"]|fr["contradictions"]|fr["noise"]
    return facts,rels

def keyword(frags, signals):
    return collect(frags)

def evidence_gated(frags, signals):
    facts=set(); votes=defaultdict(float)
    for fr in frags:
        facts |= fr["facts"]
        rel_weight=fr["reliability"] if signals.get("source_reliability",True) else 1.0
        for rel in fr["relations"]: votes[rel]+=rel_weight
        for rel in fr["contradictions"]: votes[rel]+=rel_weight*.60
        for rel in fr["noise"]: votes[rel]+=rel_weight*.35
    return facts,{rel for rel,w in votes.items() if w>=1.0}

def multi_frag(frags, signals):
    facts=set(); pair_scores=defaultdict(lambda: defaultdict(float)); source_presence=defaultdict(set)
    for fr in frags:
        facts |= fr["facts"]
        rel_weight=fr["reliability"] if signals.get("source_reliability",True) else 1.0
        for category,mult in [("relations",1.0),("contradictions",0.60),("noise",0.25)]:
            for rel in fr[category]:
                a,r,b=rel
                pair_scores[(a,b)][r]+=rel_weight*mult
                source_presence[(a,b,r)].add(fr["id"])
    accepted=set()
    for (a,b), scores in pair_scores.items():
        ranked=sorted(scores.items(),key=lambda x:x[1],reverse=True)
        if not ranked: continue
        best_type,best_score=ranked[0]
        second=ranked[1][1] if len(ranked)>1 else 0.0
        margin=best_score-second
        sources=len(source_presence[(a,b,best_type)])
        if not signals.get("fragment_independence",True):
            sources=2 # neutralize gate
        margin_gate=0.25 if signals.get("relation_vote_margin",True) else -999
        if best_score>=1.15 and sources>=2 and margin>=margin_gate:
            accepted.add((a,best_type,b))
    return facts, accepted

def score(tf,tr,rf,rr):
    cf=rf&tf; cr=rr&tr; ff=rf-tf; fr=rr-tr
    fact_recall=len(cf)/max(1,len(tf)); fact_prec=len(cf)/max(1,len(rf))
    rel_recall=len(cr)/max(1,len(tr)); rel_prec=len(cr)/max(1,len(rr))
    uns_rel=len(fr)/max(1,len(rr))
    total=.15*fact_recall+.15*fact_prec+.25*rel_recall+.35*rel_prec-.30*uns_rel
    return {"fact_recall":fact_recall,"fact_precision":fact_prec,"relation_recall":rel_recall,"relation_precision":rel_prec,"unsupported_relation_rate":uns_rel,"total_score":total}

def run_condition(scenario, signals, seeds=SEEDS, trials=TRIALS):
    strategies={"keyword":keyword,"evidence_gated":evidence_gated,"multi_fragment":multi_frag}
    cycle_results={c:{s:[] for s in strategies} for c in range(DECAY_CYCLES+1)}
    for seed in seeds:
        random.seed(seed)
        for _ in range(trials):
            tf,tr=gen_truth()
            base=make_fragments(tf,tr,scenario,signals)
            current=base
            for c in range(DECAY_CYCLES+1):
                if c>0:
                    current=decay_fragments(current,scenario,signals,1) # incremental
                for name,func in strategies.items():
                    rf,rr=func(current, signals)
                    cycle_results[c][name].append(score(tf,tr,rf,rr))
    summary={}
    for c in cycle_results:
        summary[c]={}
        for strat,vals in cycle_results[c].items():
            summary[c][strat]={m:statistics.mean([v[m] for v in vals]) for m in vals[0]}
    return summary

def derivative_metrics(summary):
    # final cycle comparative deltas MF vs EG
    c=DECAY_CYCLES
    mf=summary[c]["multi_fragment"]; eg=summary[c]["evidence_gated"]; kw=summary[c]["keyword"]
    # decay slopes for total
    mf_slope=summary[c]["multi_fragment"]["total_score"]-summary[0]["multi_fragment"]["total_score"]
    eg_slope=summary[c]["evidence_gated"]["total_score"]-summary[0]["evidence_gated"]["total_score"]
    return {
        "precision_delta": mf["relation_precision"]-eg["relation_precision"],
        "unsupported_delta": eg["unsupported_relation_rate"]-mf["unsupported_relation_rate"],
        "total_delta_vs_eg": mf["total_score"]-eg["total_score"],
        "total_delta_vs_best": mf["total_score"]-max(eg["total_score"], kw["total_score"]),
        "decay_slope_delta": mf_slope-eg_slope,
        "mf_final_total": mf["total_score"],
        "eg_final_total": eg["total_score"],
        "kw_final_total": kw["total_score"],
        "mf_final_precision": mf["relation_precision"],
        "mf_final_unsupported": mf["unsupported_relation_rate"],
    }

def ablate(signals, signal):
    s=dict(signals); s[signal]=False; return s

all_outputs=[]
for sc in SCENARIOS:
    full=run_condition(sc,SIGNALS)
    full_metrics=derivative_metrics(full)
    entries=[]
    for sig in SIGNALS:
        ab=run_condition(sc,ablate(SIGNALS,sig))
        met=derivative_metrics(ab)
        impact={k:met[k]-full_metrics[k] for k in ["precision_delta","unsupported_delta","total_delta_vs_eg","decay_slope_delta"]}
        entries.append((sig,met,impact))
    all_outputs.append((sc["name"],full_metrics,entries))
all_outputs
