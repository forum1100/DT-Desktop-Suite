def run_dt_sim_flags2(use_void=True, use_threshold=True, use_transparency=True, seed=7,
                      gamma0=0.08, fluct_amp=0.028, persistence_gain=0.015,
                      diffusion=0.035, memory_decay=0.965, transparency_coupling=0.018, T=1200):
    np.random.seed(seed)
    N=501; dx=1.; eps=1e-4
    x=np.linspace(-250,250,N); Af=1/(1+np.exp(-x/11)); Af=np.clip(Af,eps,1)
    V_raw=1/(Af+eps)
    V=V_raw/V_raw.max() if use_void else np.zeros(N)
    S=0.002*np.random.rand(N)+0.012*np.exp(-(x/20)**2)
    band=np.where(abs(x)<=8)[0]; escape_idx=np.where(x>=70)[0]; absorb_idx=np.where(x<=-70)[0]; outside_idx=np.where(x>0)[0]
    ef=[]; af=[]; ge=[]; pom=[]; te=[]; hg=[]; horizonS=[]
    def lap(y): return np.r_[y[1]-y[0], y[:-2]-2*y[1:-1]+y[2:], y[-2]-y[-1]]
    for t in range(T):
        Phi=S-V; gradPhi=np.gradient(Phi,dx)
        event_strength=fluct_amp*np.exp(-abs(t-T*.28)/(T*.33))*(.75+.25*np.sin(t/29)**2)
        noise=np.zeros(N); noise[band]=event_strength*np.random.normal(0,1,len(band))
        candidate=S+noise+persistence_gain*np.maximum(gradPhi,0)*Af
        gate=np.where(candidate>gamma0, (candidate-gamma0)*0.12, 0) if use_threshold else np.maximum(candidate,0)*0.025
        trans=transparency_coupling*(1-(S+V))*S if use_transparency else 0
        absorption=(1-Af)*S*.065 if use_void else np.zeros(N)
        outward=np.maximum(gradPhi,0)*Af*.004
        S=np.clip(memory_decay*S+diffusion*lap(S)+gate+trans-absorption+outward,0,0.35)
        ef.append(S[escape_idx].sum()); af.append(absorption[absorb_idx].sum()); ge.append(gate[band].sum())
        pom.append(S[outside_idx].sum()); te.append(np.mean(np.abs((S+V)-1))); hg.append(np.mean(np.abs(gradPhi[band]))); horizonS.append(S[band].sum())
    return { "escaped_flux":np.array(ef), "absorbed_flux":np.array(af), "emitted_events":np.array(ge),
            "persistent_outside_mass":np.array(pom), "transparency_error":np.array(te), "phi_grad_horizon":np.array(hg),
            "S":S, "V":V, "Af":Af, "x":x, "horizonS":np.array(horizonS)}

variants2 = {
    "Full DT": run_dt_sim_flags2(True, True, True),
    "No void term": run_dt_sim_flags2(False, True, True),
    "No threshold gamma0": run_dt_sim_flags2(True, False, True),
    "No S+V transparency": run_dt_sim_flags2(True, True, False),
}
rows=[]
for k,v in variants2.items():
    rows.append({
        "model": k,
        "final escaped flux": v["escaped_flux"][-1],
        "peak escaped flux": v["escaped_flux"].max(),
        "total emitted horizon events": v["emitted_events"].sum(),
        "final outside persistence mass": v["persistent_outside_mass"][-1],
        "mean horizon |grad(S-V)|": v["phi_grad_horizon"].mean(),
        "final transparency error": v["transparency_error"][-1],
        "total absorbed inner flux": v["absorbed_flux"].sum(),
        "final horizon persistence": v["horizonS"][-1]
    })
df2=pd.DataFrame(rows)
df2.to_dict('records')
