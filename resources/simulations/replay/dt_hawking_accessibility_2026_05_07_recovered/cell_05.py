variants3 = {
    "Full DT": run_dt_sim_flags2(True, True, True, gamma0=0.018, fluct_amp=0.05, persistence_gain=0.02),
    "No void term": run_dt_sim_flags2(False, True, True, gamma0=0.018, fluct_amp=0.05, persistence_gain=0.02),
    "No threshold gamma0": run_dt_sim_flags2(True, False, True, gamma0=0.018, fluct_amp=0.05, persistence_gain=0.02),
    "No S+V transparency": run_dt_sim_flags2(True, True, False, gamma0=0.018, fluct_amp=0.05, persistence_gain=0.02),
}
rows=[]
for k,v in variants3.items():
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
df3=pd.DataFrame(rows)
df3.to_dict('records')
