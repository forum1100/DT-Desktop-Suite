import random, math, statistics
from collections import defaultdict, Counter

RANDOM_SEED=42
random.seed(RANDOM_SEED)
FACT_COUNT=40
RELATION_COUNT=70
TRIALS_PER_EXPERIMENT=100
EXPERIMENTS=[
    {"name":"mild_context_damage","fact_drop_rate":0.20,"relation_drop_rate":0.25,"noise_fact_rate":0.10,"noise_relation_rate":0.10},
    {"name":"moderate_context_damage","fact_drop_rate":0.40,"relation_drop_rate":0.45,"noise_fact_rate":0.20,"noise_relation_rate":0.20},
    {"name":"severe_context_damage","fact_drop_rate":0.60,"relation_drop_rate":0.65,"noise_fact_rate":0.35,"noise_relation_rate":0.35},
    {"name":"high_noise_rag_like_damage","fact_drop_rate":0.35,"relation_drop_rate":0.50,"noise_fact_rate":0.50,"noise_relation_rate":0.50},
]
relation_types=["supports","contradicts","depends_on","causes","limits","preserves","weakens","clarifies"]

def generate_truth_graph(fact_count=FACT_COUNT, relation_count=RELATION_COUNT):
    facts=[f"F{i}" for i in range(fact_count)]
    rel=set()
    while len(rel)<relation_count:
        a,b=random.sample(facts,2); r=random.choice(relation_types); rel.add((a,r,b))
    return set(facts), rel

def degrade_context(true_facts,true_relations,config):
    observed_facts={f for f in true_facts if random.random()>config["fact_drop_rate"]}
    observed_relations={rel for rel in true_relations if random.random()>config["relation_drop_rate"]}
    for i in range(int(len(true_facts)*config["noise_fact_rate"])):
        observed_facts.add(f"N{i}")
    nodes=list(observed_facts)
    for _ in range(int(len(true_relations)*config["noise_relation_rate"])):
        if len(nodes)>=2:
            a,b=random.sample(nodes,2); r=random.choice(relation_types); observed_relations.add((a,r,b))
    return observed_facts, observed_relations

def random_reconstruction(obs_f,obs_r,true_fact_count,true_relation_count):
    facts=set(random.sample(list(obs_f), min(len(obs_f), true_fact_count)))
    candidates=[rel for rel in obs_r if rel[0] in facts and rel[2] in facts]
    relations=set(random.sample(candidates, min(len(candidates), true_relation_count)))
    return facts, relations

def naive_summary(obs_f,obs_r,true_fact_count,true_relation_count):
    degree=Counter()
    for a,_,b in obs_r:
        degree[a]+=1; degree[b]+=1
    facts=set(sorted(obs_f, key=lambda x: degree[x], reverse=True)[:true_fact_count])
    relations={rel for rel in obs_r if rel[0] in facts and rel[2] in facts}
    return facts,set(list(relations)[:true_relation_count])

def keyword_retrieval(obs_f,obs_r,true_fact_count,true_relation_count):
    facts=set([f for f in obs_f if f.startswith("F")][:true_fact_count])
    relations={rel for rel in obs_r if rel[0] in facts and rel[2] in facts and rel[0].startswith("F") and rel[2].startswith("F")}
    return facts,set(list(relations)[:true_relation_count])

def evidence_gated_recursive(obs_f,obs_r,true_fact_count,true_relation_count,max_iterations=5):
    """
    v2: does not invent new edges. It only filters, ranks, and marks structure.
    Evidence gates:
    - facts must be real-shaped F nodes; noise-shaped N nodes rejected.
    - relations must be observed and connect retained facts.
    - relation confidence uses endpoint degree, reciprocal support, path support.
    - no speculative edge enters reconstructed_relations.
    """
    facts=set(f for f in obs_f if f.startswith("F"))
    observed_valid={rel for rel in obs_r if rel[0].startswith("F") and rel[2].startswith("F") and rel[0] in facts and rel[2] in facts}
    relations=set(observed_valid)
    for _ in range(max_iterations):
        degree=Counter()
        typed=Counter()
        pair_types=defaultdict(set)
        adjacency=defaultdict(set)
        for a,r,b in relations:
            degree[a]+=1; degree[b]+=1; typed[r]+=1; pair_types[(a,b)].add(r); adjacency[a].add(b); adjacency[b].add(a)
        # fact confidence: observed + relational support
        fact_conf={f: (1.0 if f in obs_f else 0.0)+0.15*degree[f] for f in facts}
        # preserve isolated observed facts but rank down
        ranked_facts=sorted(facts, key=lambda f:(fact_conf[f], f), reverse=True)
        facts=set(ranked_facts[:true_fact_count])
        # relation confidence
        scored=[]
        for a,r,b in observed_valid:
            if a not in facts or b not in facts: continue
            reciprocal=1 if any(x[0]==b and x[2]==a for x in observed_valid) else 0
            common_neighbors=len(adjacency[a] & adjacency[b])
            conf=1.0 + 0.05*(degree[a]+degree[b]) + 0.2*reciprocal + 0.1*min(common_neighbors,3)
            scored.append((conf,(a,r,b)))
        scored.sort(reverse=True, key=lambda x:x[0])
        relations=set(rel for _,rel in scored[:true_relation_count])
    return facts, relations

def score(true_f,true_r,rec_f,rec_r):
    correct_f=rec_f & true_f; hall_f=rec_f-true_f
    correct_r=rec_r & true_r; hall_r=rec_r-true_r
    fr=len(correct_f)/max(1,len(true_f)); fp=len(correct_f)/max(1,len(rec_f))
    rr=len(correct_r)/max(1,len(true_r)); rp=len(correct_r)/max(1,len(rec_r))
    hfr=len(hall_f)/max(1,len(rec_f)); hrr=len(hall_r)/max(1,len(rec_r))
    total=0.20*fr+0.20*fp+0.30*rr+0.30*rp-0.35*hrr-0.10*hfr
    return {"fact_recall":fr,"fact_precision":fp,"relation_recall":rr,"relation_precision":rp,"hallucinated_fact_rate":hfr,"hallucinated_relation_rate":hrr,"total_score":total}

strategies={"random":random_reconstruction,"naive_summary":naive_summary,"keyword_retrieval":keyword_retrieval,"evidence_gated_recursive":evidence_gated_recursive}
def run(config):
    res=defaultdict(list)
    for _ in range(TRIALS_PER_EXPERIMENT):
        tf,tr=generate_truth_graph()
        of,or_=degrade_context(tf,tr,config)
        for name,strat in strategies.items():
            rf,rr=strat(of,or_,len(tf),len(tr))
            res[name].append(score(tf,tr,rf,rr))
    summ={}
    for s, scores in res.items():
        summ[s]={m:{"mean":statistics.mean([x[m] for x in scores]), "stdev":statistics.stdev([x[m] for x in scores])} for m in scores[0]}
    return summ
allres={}
for cfg in EXPERIMENTS:
    allres[cfg["name"]]=run(cfg)
allres
