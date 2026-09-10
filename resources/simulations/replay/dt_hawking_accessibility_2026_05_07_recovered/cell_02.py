import numpy as np, math, pandas as pd
np.random.seed(42)

def run_distel_hawking_sim(
    N=401, T=900, dx=1.0, horizon=0.0,
    gamma0=0.055, k_void=0.085, eps=1e-4,
    memory_decay=0.985, persistence_gain=0.17,
    transparency_target=1.0, transparency_coupling=0.045,
    fluct_amp=0.08, horizon_band=7,
    escape_x=55, absorb_x=-55,
    diffusion=0.08
):
    # x grid centered at horizon. outside = x>0, inside = x<0
    x = np.linspace(-200,200,N)
    
    # Accessible future manifold volume Af:
    # inside event horizon: rapidly collapses toward zero as x becomes more negative
    # outside: rises smoothly toward 1
    # horizon transition is steep but finite.
    Af = 1/(1+np.exp(-x/9.0))
    Af = np.clip(Af, eps, 1.0)
    
    # Void pressure: inverse accessible future. Normalize to [0, ~1] by using k_void/(Af+k)
    V_raw = 1/(Af+eps)
    V = V_raw / (V_raw.max())  # strong near deep inside, tiny outside
    
    # Persistence field S initially low random near horizon + weak outside background
    S = 0.015*np.random.rand(N)
    S += 0.035*np.exp(-(x/18)**2)  # horizon jitter seed
    
    escaped_flux = []
    absorbed_flux = []
    emitted_events = []
    persistent_outside_mass = []
    transparency_error = []
    phi_grad_horizon = []
    
    # Laplacian helper
    def lap(y):
        return np.r_[y[1]-y[0], y[:-2]-2*y[1:-1]+y[2:], y[-2]-y[-1]]
    
    horizon_idx = np.argmin(abs(x-horizon))
    band = np.where(abs(x-horizon) <= horizon_band)[0]
    escape_idx = np.where(x>=escape_x)[0]
    absorb_idx = np.where(x<=absorb_x)[0]
    outside_idx = np.where(x>0)[0]
    inside_idx = np.where(x<0)[0]
    
    for t in range(T):
        # DT potential: effective persistence potential
        Phi = S - V
        
        # Flow is down/up gradient? Use persistence transported by gradient of Phi.
        gradPhi = np.gradient(Phi, dx)
        
        # Horizon fluctuations: pair production proxy, symmetric noise around horizon
        noise = np.zeros(N)
        event_strength = fluct_amp * np.exp(-abs(t-T*0.25)/(T*0.35)) * (0.65 + 0.35*np.sin(t/17)**2)
        pair = event_strength * np.random.normal(0,1,len(band))
        noise[band] = pair
        
        # Threshold gate: only fluctuations exceeding gamma0 become persistent structure
        candidate = S + noise + persistence_gain*np.maximum(gradPhi, 0)*Af
        gate = np.where(candidate > gamma0, candidate-gamma0, 0)
        
        # Transparency pressure: systems are stabilized when S+V approaches 1
        trans_correction = transparency_coupling * (transparency_target - (S+V)) * S
        
        # Evolution:
        # - memory preserves stable persistence
        # - diffusion spreads outside leakage
        # - gate creates threshold-stabilized radiation
        # - void absorbs inside-accessibility collapse
        absorption = (1-Af)*S*0.11
        S_new = memory_decay*S + diffusion*lap(S) + gate + trans_correction - absorption
        
        # Outside near horizon gradient refracts some structure outward
        outward_bias = np.maximum(gradPhi, 0) * Af * 0.025
        S_new += outward_bias
        
        S = np.clip(S_new, 0, 1.5)
        
        escaped_flux.append(S[escape_idx].sum())
        absorbed_flux.append(absorption[absorb_idx].sum())
        emitted_events.append(gate[band].sum())
        persistent_outside_mass.append(S[outside_idx].sum())
        transparency_error.append(np.mean(np.abs((S+V)-1)))
        phi_grad_horizon.append(np.mean(np.abs(gradPhi[band])))
    
    return {
        "x": x, "Af": Af, "V": V, "S": S,
        "escaped_flux": np.array(escaped_flux),
        "absorbed_flux": np.array(absorbed_flux),
        "emitted_events": np.array(emitted_events),
        "persistent_outside_mass": np.array(persistent_outside_mass),
        "transparency_error": np.array(transparency_error),
        "phi_grad_horizon": np.array(phi_grad_horizon),
        "params": dict(N=N,T=T,gamma0=gamma0,k_void=k_void,memory_decay=memory_decay,
                       persistence_gain=persistence_gain, transparency_coupling=transparency_coupling,
                       fluct_amp=fluct_amp,horizon_band=horizon_band,escape_x=escape_x,absorb_x=absorb_x)
    }

base = run_distel_hawking_sim()
# Ablations: no void inverse, no threshold, no transparency
def run_variant(name, **kwargs):
    return run_distel_hawking_sim(**kwargs)

# create a variant function that modifies internals? Simpler copy with flags
def run_dt_sim_flags(use_void=True, use_threshold=True, use_transparency=True, seed=42):
    np.random.seed(seed)
    N=401; T=900; dx=1.; gamma0=0.055; eps=1e-4
    x=np.linspace(-200,200,N); Af=1/(1+np.exp(-x/9)); Af=np.clip(Af,eps,1)
    V_raw=1/(Af+eps)
    V=V_raw/V_raw.max() if use_void else np.zeros(N)
    S=0.015*np.random.rand(N)+0.035*np.exp(-(x/18)**2)
    band=np.where(abs(x)<=7)[0]; escape_idx=np.where(x>=55)[0]; absorb_idx=np.where(x<=-55)[0]; outside_idx=np.where(x>0)[0]
    ef=[]; af=[]; ge=[]; pom=[]; te=[]; hg=[]
    def lap(y): return np.r_[y[1]-y[0], y[:-2]-2*y[1:-1]+y[2:], y[-2]-y[-1]]
    for t in range(T):
        Phi=S-V; gradPhi=np.gradient(Phi,dx)
        event_strength=0.08*np.exp(-abs(t-T*.25)/(T*.35))*(.65+.35*np.sin(t/17)**2)
        noise=np.zeros(N); noise[band]=event_strength*np.random.normal(0,1,len(band))
        candidate=S+noise+0.17*np.maximum(gradPhi,0)*Af
        gate=np.where(candidate>gamma0, candidate-gamma0, 0) if use_threshold else np.maximum(candidate,0)*0.2
        trans=0.045*(1-(S+V))*S if use_transparency else 0
        absorption=(1-Af)*S*.11 if use_void else np.zeros(N)
        S=np.clip(.985*S+.08*lap(S)+gate+trans-absorption+np.maximum(gradPhi,0)*Af*.025,0,1.5)
        ef.append(S[escape_idx].sum()); af.append(absorption[absorb_idx].sum()); ge.append(gate[band].sum())
        pom.append(S[outside_idx].sum()); te.append(np.mean(np.abs((S+V)-1))); hg.append(np.mean(np.abs(gradPhi[band])))
    return { "escaped_flux":np.array(ef), "absorbed_flux":np.array(af), "emitted_events":np.array(ge),
            "persistent_outside_mass":np.array(pom), "transparency_error":np.array(te), "phi_grad_horizon":np.array(hg),
            "S":S, "V":V, "Af":Af, "x":x}

variants = {
    "Full DT": run_dt_sim_flags(True, True, True),
    "No void term": run_dt_sim_flags(False, True, True),
    "No threshold gamma0": run_dt_sim_flags(True, False, True),
    "No S+V transparency": run_dt_sim_flags(True, True, False),
}
rows=[]
for k,v in variants.items():
    rows.append({
        "model": k,
        "final escaped flux": v["escaped_flux"][-1],
        "peak escaped flux": v["escaped_flux"].max(),
        "total emitted horizon events": v["emitted_events"].sum(),
        "final outside persistence mass": v["persistent_outside_mass"][-1],
        "mean horizon |grad(S-V)|": v["phi_grad_horizon"].mean(),
        "final transparency error": v["transparency_error"][-1],
        "total absorbed inner flux": v["absorbed_flux"].sum()
    })
df=pd.DataFrame(rows)
df
