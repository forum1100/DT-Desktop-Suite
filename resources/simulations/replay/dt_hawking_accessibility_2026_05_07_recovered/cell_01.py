import numpy as np
import pandas as pd

# Toy Distel-Hawking simulation
# Radial grid around a black-hole horizon at r_s = 1
# x = r - r_s, with x < 0 inside horizon, x > 0 outside
np.random.seed(7)

N = 1200
steps = 450
x = np.linspace(-0.35, 1.2, N)
dx = x[1]-x[0]
rs = 1.0

# Distel variables:
# V = void sink strength / inaccessible future pull, strongest inside/near horizon
# S = persistence accessibility, higher outside but distorted near horizon
# kappa proxy = horizon gradient strength / surface gravity-like term
kappa = 1.0

V = 1/(1 + np.exp(18*x))          # high inside, falls outside
S_base = 1/(1 + np.exp(-10*(x-0.03)))  # low inside, rises outside
curvature = np.exp(-(x/0.055)**2)      # near-horizon accessibility curvature
S = S_base * (1 - 0.45*curvature) + 0.08*np.exp(-((x-0.12)/0.25)**2)

# Horizon interaction band: virtual fluctuation intensity
band = np.exp(-(x/0.045)**2)

# gamma threshold: minimum interaction needed to persist
gamma0 = 0.33

# Initialize micro-fluctuations around horizon
R = 0.03*np.random.randn(N)*band  # recursive interaction density
M = np.zeros(N)                   # memory/persistence accumulator
escape_flux = []
inside_flux = []
mean_persistence = []
survivors = []

# derived "Distel flow potential": persistence minus void sink
Phi = S - V
gradPhi = np.gradient(Phi, dx)

# simulation coefficients
diff = 0.015
couple = 0.05
decay = 0.035
noise_amp = 0.025
memory_gain = 0.09
memory_decay = 0.018

for t in range(steps):
    # spontaneous fluctuation generation in horizon band
    noise = noise_amp*np.random.randn(N)*band
    
    # Distel dynamics:
    # - diffusion = ordinary spreading of interaction
    # - refraction term = gradient of accessibility/void potential
    # - curvature creation = horizon creates temporary interaction pairs
    lap = np.gradient(np.gradient(R, dx), dx)
    refractive_push = -couple*np.gradient(R*gradPhi, dx)
    creation = 0.055*band*np.random.randn(N)
    
    R = R + diff*lap + refractive_push + creation + noise - decay*R
    
    # nonlinear stabilization: interaction above gamma0 deposits persistence memory
    active = np.abs(R) > gamma0
    M = (1-memory_decay)*M + memory_gain*active*np.abs(R)
    
    # persistence feeds back, stabilizing escaped modes outside horizon
    R += 0.025*M*S
    
    # clip for numeric stability
    R = np.clip(R, -3, 3)
    M = np.clip(M, 0, 5)
    
    # flux proxies
    outside_far = x > 0.16
    inside = x < -0.08
    escape_flux.append(np.sum(np.maximum(R[outside_far], 0)*S[outside_far])*dx)
    inside_flux.append(np.sum(np.maximum(-R[inside], 0)*V[inside])*dx)
    mean_persistence.append(np.mean(M[outside_far]))
    survivors.append(np.sum((M[outside_far] > 0.12))/outside_far.sum())

summary = pd.DataFrame({
    "metric": [
        "final escaped positive flux proxy",
        "final absorbed/inside negative flux proxy",
        "final outside mean persistence memory",
        "fraction of outside grid retaining persistent signal",
        "peak escaped flux proxy",
        "time of peak escaped flux"
    ],
    "value": [
        escape_flux[-1],
        inside_flux[-1],
        mean_persistence[-1],
        survivors[-1],
        max(escape_flux),
        int(np.argmax(escape_flux))
    ]
})
summary
