import random, statistics, math
from collections import defaultdict, Counter

# Let's implement compact version to run outcomes for reporting.
FACT_COUNT=40
RELATION_COUNT=70
FRAGMENT_COUNT=5
TRIALS=60
SEEDS=[101,202,303,404]
DECAY_CYCLES=4
RELATION_TYPES=["supports","contradicts","depends_on","causes","limits","preserves","weakens","clarifies"]

base_scenarios=[
    {"name":"moderate_decay","fragment_visibility":0.55,"relation_visibility":0.50,"noise_rate":0.10,"contradiction_rate":0.08,"reliability_spread":0.20,"summary_decay":0.08,"persistence_gate":1.15},
    {"name":"conflict_decay","fragment_visibility":0.50,"relation_visibility":0.45,"noise_rate":0.20,"contradiction_rate":0.25,"reliability_spread":0.35,"summary_decay":0.10,"persistence_gate":1.15},
]

def generate_truth_graph():
    facts=[f"F{i}" for i in range(FACT_COUNT)]
    rels=set()
    while len(rels)<RELATION_COUNT:
        a,b=random.sample(facts,2)
        rels.add((a,random.choice(RELATION_TYPES),b))
    return set(facts), rels

def opposite(r):
    d={"supports":"contradicts","contradicts":"supports","preserves":"weakens","weakens":"preserves","clarifies":"limits","limits":"clarifies","causes":"depends_on","depends_on":"causes"}
    return d.get(r, random.choice(RELATION_TYPES))

def make_fragments(true_facts,true_rels,sc):
    frags=[]
    for i in range(FRAGMENT_COUNT):
        rel=max(0.05,min(1.0,0.85+random.uniform(-sc["reliability_spread"],sc["reliability_spread"])))
        facts={f for f in true_facts if random.random()<sc["fragment_visibility"]}
        relations=set(); contradictions=set(); noise=set()
        for tr in true_rels:
            a,r,b=tr
            if a in facts and b in facts and random.random()<sc["relation_visibility"]:
                relations.add(tr)
            if a in facts and b in facts and random.random()<sc["contradiction_rate"]:
                contradictions.add((a,opposite(r),b))
        pool=list(facts)
        for _ in range(int(len(true_rels)*sc["noise_rate"])):
            if len(pool)>=2:
                a,b=random.sample(pool,2); r=random.choice(RELATION_TYPES)
                nr=(a,r,b)
                if nr not in true_rels: noise.add(nr)
        frags.append({"id":f"S{i}","reliability":rel,"facts":facts,"relations":relations,"contradictions":contradictions,"noise":noise})
    return frags

def decay_fragments(frags, sc, cycle):
    # summarization/context decay: drop some relations and lower reliability; preserve facts more than relations
    new=[]
    drop_rel=sc["summary_decay"]*(1+0.15*cycle)
    drop_fact=sc["summary_decay"]*0.35*(1+0.1*cycle)
    for frag in frags:
        nfacts={f for f in frag["facts"] if random.random()>drop_fact}
        nr={r for r in frag["relations"] if random.random()>drop_rel and r[0] in nfacts and r[2] in nfacts}
        nc={r for r in frag["contradictions"] if random.random()>drop_rel and r[0] in nfacts and r[2] in nfacts}
        nn={r for r in frag["noise"] if random.random()>drop_rel and r[0] in nfacts and r[2] in nfacts}
        new.append({"id":frag["id"],"reliability":frag["reliability"]*(1-sc["summary_decay"]*0.25),"facts":nfacts,"relations":nr,"contradictions":nc,"noise":nn})
    return new

def collect(frags):
    facts=set(); rels=set()
    for f in frags:
        facts |= f["facts"]; rels |= f["relations"] | f["contradictions"] | f["noise"]
    return facts,rels

def evidence_gated(frags, gate=1.0):
    facts=set(); votes=defaultdict(float)
    for frag in frags:
        facts |= frag["facts"]
        for r in frag["relations"]: votes[r]+=frag["reliability"]
        for r in frag["contradictions"]: votes[r]+=frag["reliability"]*.60
        for r in frag["noise"]: votes[r]+=frag["reliability"]*.35
    return facts,{r for r,w in votes.items() if w>=gate}

def multi_persist(frags, gate=1.15):
    facts=set(); pair_scores=defaultdict(lambda: defaultdict(float)); source_sets=defaultdict(set)
    for frag in frags:
        facts |= frag["facts"]
        for cat,weight in [("relations",1.0),("contradictions",.60),("noise",.25)]:
            for rel in frag[cat]:
                a,r,b=rel
                pair_scores[(a,b)][r]+=frag["reliability"]*weight
                source_sets[(a,b,r)].add(frag["id"])
    accepted=set()
    for (a,b), scores in pair_scores.items():
        ranked=sorted(scores.items(), key=lambda x:x[1], reverse=True)
        if not ranked: continue
        bt,bs=ranked[0]; ss=ranked[1][1] if len(ranked)>1 else 0.0
        margin=bs-ss; independent=len(source_sets[(a,b,bt)])
        if bs>=gate and independent>=2 and margin>=0.25:
            accepted.add((a,bt,b))
    return facts, accepted

def score(tf,tr,rf,rr):
    cf=rf&tf; cr=rr&tr
    ff=rf-tf; fr=rr-tr
    return {
        "relation_precision": len(cr)/max(1,len(rr)),
        "relation_recall": len(cr)/max(1,len(tr)),
        "unsupported_rate": len(fr)/max(1,len(rr)),
        "total": .25*(len(cr)/max(1,len(tr)))+.45*(len(cr)/max(1,len(rr)))-.35*(len(fr)/max(1,len(rr)))+.15*(len(cf)/max(1,len(tf)))
    }

def run_once(sc):
    tf,tr=generate_truth_graph()
    fr=make_fragments(tf,tr,sc)
    cyc=[]
    for c in range(DECAY_CYCLES+1):
        eg=score(tf,tr,*evidence_gated(fr))
        mf=score(tf,tr,*multi_persist(fr, sc.get("persistence_gate",1.15)))
        cyc.append({
            "cycle":c,
            "precision_delta": mf["relation_precision"]-eg["relation_precision"],
            "unsupported_delta": eg["unsupported_rate"]-mf["unsupported_rate"],
            "total_delta": mf["total"]-eg["total"],
            "mf_total":mf["total"], "eg_total":eg["total"],
            "mf_prec":mf["relation_precision"], "eg_prec":eg["relation_precision"],
            "mf_unsup":mf["unsupported_rate"], "eg_unsup":eg["unsupported_rate"],
            "mf_recall":mf["relation_recall"], "eg_recall":eg["relation_recall"]
        })
        if c<DECAY_CYCLES: fr=decay_fragments(fr,sc,c)
    return cyc

def aggregate(sc):
    by_cycle=defaultdict(list)
    for seed in SEEDS:
        random.seed(seed)
        for _ in range(TRIALS):
            cyc=run_once(sc)
            for rec in cyc:
                by_cycle[rec["cycle"]].append(rec)
    agg=[]
    for c in sorted(by_cycle):
        vals=by_cycle[c]
        agg.append({k:statistics.mean([v[k] for v in vals]) for k in vals[0] if k!="cycle"} | {"cycle":c})
    return agg

def derivative(metrics, i):
    if i==0:
        return {"d_precision_delta":0,"d_unsupported_delta":0,"d_total_delta":0}
    return {
        "d_precision_delta":metrics[i]["precision_delta"]-metrics[i-1]["precision_delta"],
        "d_unsupported_delta":metrics[i]["unsupported_delta"]-metrics[i-1]["unsupported_delta"],
        "d_total_delta":metrics[i]["total_delta"]-metrics[i-1]["total_delta"],
    }

def forecast_next(metrics, i):
    # simple momentum forecast from last derivative; next two
    d=derivative(metrics,i)
    return {
        "next1": {
            "precision_delta": metrics[i]["precision_delta"]+d["d_precision_delta"],
            "unsupported_delta": metrics[i]["unsupported_delta"]+d["d_unsupported_delta"],
            "total_delta": metrics[i]["total_delta"]+d["d_total_delta"],
        },
        "next2": {
            "precision_delta": metrics[i]["precision_delta"]+2*d["d_precision_delta"],
            "unsupported_delta": metrics[i]["unsupported_delta"]+2*d["d_unsupported_delta"],
            "total_delta": metrics[i]["total_delta"]+2*d["d_total_delta"],
        }
    }

def apply_derivative_correction(sc):
    # first derivative correction: if conflict precision should amplify, increase contradiction a bit and gate a bit
    n=dict(sc)
    n["contradiction_rate"]=min(.50, n["contradiction_rate"]+.05)
    n["relation_visibility"]=max(.30, n["relation_visibility"]-.02)
    n["persistence_gate"]=min(1.35,n.get("persistence_gate",1.15)+.05)
    return n

results={}
for sc in base_scenarios:
    agg=aggregate(sc)
    pred=forecast_next(agg, len(agg)-1)
    corrected=apply_derivative_correction(sc)
    agg2=aggregate(corrected)
    actual_next={"precision_delta":agg2[-1]["precision_delta"],"unsupported_delta":agg2[-1]["unsupported_delta"],"total_delta":agg2[-1]["total_delta"]}
    err={k:abs(actual_next[k]-pred["next1"][k]) for k in actual_next}
    results[sc["name"]]=(agg,pred,corrected,agg2,actual_next,err)
results.keys()
