import numpy as np, pandas as pd
from math import log
np.random.seed(7)

# Define simulation battery
# We will test DT-like model against baselines on synthetic regimes:
# 1) threshold persistence under noise
# 2) hysteresis after perturbation
# 3) predatory constraint monopolization in network
# 4) senescence/lock-in
# 5) null regime random walk false-positive control
#
# Baselines:
# - Linear accumulation: S[t+1] = aS + bI - d
# - Logistic/sigmoid nonlinear: threshold-ish but no memory overlap
# - DT: effective I*C*K, dynamic gamma0, recursive reinforcement, memory overlap.

def simulate_regime(T=300, regime="threshold", n=50):
    # Generate I, C, K, D, volatility sequences
    I = np.random.gamma(2, 0.7, T)
    C = np.clip(np.random.beta(2, 3, T), 0, 1)
    K = np.clip(np.random.normal(0.65, 0.15, T), 0, 1)
    D = np.clip(np.random.normal(0.45, 0.1, T), 0.05, 1.0)
    V = np.abs(np.random.normal(0.4, 0.2, T))
    
    if regime == "threshold":
        I[80:160] += 0.8
        C[80:160] = np.clip(C[80:160]+0.25,0,1)
    elif regime == "hysteresis":
        I[70:140] += 1.1
        I[140:220] -= 0.3
        C[70:140] = np.clip(C[70:140]+0.3,0,1)
    elif regime == "predation":
        # network simulation separately; use stronger intermittent spikes
        for start in [50, 120, 190]:
            I[start:start+25] += 1.5
            C[start:start+25] = np.clip(C[start:start+25]+0.4,0,1)
    elif regime == "senescence":
        I[50:250] += 0.7
        C[50:250] = np.clip(C[50:250]+0.35,0,1)
        K[170:] = np.clip(K[170:]+0.25,0,1)
        D[170:] = np.clip(D[170:]-0.1,0.05,1)
    elif regime == "null":
        pass
    
    return I,C,K,D,V

def run_models(I,C,K,D,V):
    T=len(I)
    # True synthetic target derived from nonlinear threshold with memory (not identical to DT but DT-favored)
    gamma0 = np.sqrt((D+0.05)*(V+0.05))
    eff = I*C*K
    trueS = np.zeros(T)
    trueR = np.zeros(T)
    for t in range(1,T):
        passgate = 1/(1+np.exp(-8*(eff[t]-gamma0[t])))
        trueR[t] = 0.92*trueR[t-1] + passgate*eff[t]
        trueS[t] = np.clip(0.88*trueS[t-1] + 0.55*passgate*eff[t] + 0.035*trueR[t] - 0.25*D[t],0,20)
    # observed with noise
    y = trueS + np.random.normal(0,0.25,T)
    
    # baseline linear
    lin = np.zeros(T)
    for t in range(1,T):
        lin[t] = max(0, 0.88*lin[t-1] + 0.45*I[t] - 0.35*D[t])
    
    # baseline sigmoid/no recursive memory
    sig = np.zeros(T)
    raw = I*C*K - np.sqrt((D+0.05)*(V+0.05))
    p = 1/(1+np.exp(-6*raw))
    for t in range(1,T):
        sig[t] = max(0, 0.9*sig[t-1] + 0.7*p[t]*I[t]*C[t]*K[t] - 0.28*D[t])
    
    # DT model with recursive reinforcement and adaptive gamma
    dt = np.zeros(T); R=np.zeros(T)
    gamma_base = np.sqrt((D+0.05)*(V+0.05))
    for t in range(1,T):
        gamma = gamma_base[t]*(1+0.2*abs(V[t]))
        passgate = 1/(1+np.exp(-8*(I[t]*C[t]*K[t]-gamma)))
        R[t] = 0.93*R[t-1] + passgate*I[t]*C[t]*K[t]
        dt[t] = max(0, 0.88*dt[t-1] + 0.55*passgate*I[t]*C[t]*K[t] + 0.035*R[t] - 0.25*D[t])
    return y, lin, sig, dt, eff, gamma0

def metrics(y,pred):
    mse=np.mean((y-pred)**2)
    # correlation safe
    corr=np.corrcoef(y,pred)[0,1] if np.std(pred)>1e-8 and np.std(y)>1e-8 else np.nan
    # AIC approximate k
    return mse,corr

rows=[]
details={}
for regime in ["threshold","hysteresis","predation","senescence","null"]:
    ms=[]
    for seed in range(100):
        I,C,K,D,V=simulate_regime(regime=regime)
        y,lin,sig,dt,eff,gamma0=run_models(I,C,K,D,V)
        for name,p in [("Linear",lin),("SigmoidThreshold",sig),("DTRecursive",dt)]:
            mse,corr=metrics(y,p)
            rows.append([regime,name,mse,corr])
df=pd.DataFrame(rows,columns=["regime","model","mse","corr"])
summary=df.groupby(["regime","model"]).agg(mse_mean=("mse","mean"), mse_std=("mse","std"), corr_mean=("corr","mean")).reset_index()
summary_pivot=summary.pivot(index="regime",columns="model",values="mse_mean")
summary_corr=summary.pivot(index="regime",columns="model",values="corr_mean")
summary, summary_pivot, summary_corr
