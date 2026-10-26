# Mechanics Simulator Instructions

This repository contains five browser-based classical-mechanics simulations:

1. Simple Pendulum
2. Double Pendulum
3. Swinging Atwood Machine
4. Rolling Disk Pendulum
5. Disk on Slope
6. Elastic Pendulum

Each simulation has a `description.md`, `index.html`, and `system.py`.

## Runtime

The Python model defines generalized coordinates, constrained positions,
kinetic energy, and potential energy. Mechmaths applies

```text
d/dt(∂L/∂q̇) - ∂L/∂q = 0,  where L = T - V
```

The resulting acceleration system is solved numerically and integrated with
fourth-order Runge-Kutta. PyScript connects the Python solver to the shared
JavaScript Canvas interface.

Shared implementation:

- `mechmaths/deriv.py` provides symbolic expressions and differentiation.
- `mechmaths/system.py` provides vectors, masses, springs, disks, and
  constraints.
- `mechmaths/engine.py` derives equations and performs numerical integration.
- `simulation_runner.py` controls time stepping and browser callbacks.
- `mechsimulator.js` provides the controls, metrics, energy display, equation
  display, and drawing helpers.
- `gemma-chatbot.js` provides the optional browser-local AI assistant using WebLLM;
  it requires no API key and loads its model only when the chat is opened.

Every page supports reset, play/pause, single-step playback, parameter
controls, a description modal, and a view of its `system.py` model.

## Browser-local AI assistant

The mechanism chat runs the `Llama-3.2-1B-Instruct-q4f16_1-MLC` model locally
through WebLLM. The model is downloaded from the browser on first use and cached
for later visits. It requires a WebGPU-capable browser; the simulation itself does
not depend on WebGPU and continues to work if the assistant is unavailable.

## Simple Pendulum

Files: `pend/description.md`, `pend/index.html`, `pend/system.py`

One mass `m` hangs from a rigid rod of length `l`. The coordinate `theta` is
measured from the downward vertical:

```text
r = (l sin(theta), -l cos(theta))
T = 1/2 m l² theta_dot²
V = m g y
theta_ddot = -(g/l) sin(theta)
```

Defaults: `m = 1`, `g = 10`, `l = 1`, and `theta = 2`.

## Double Pendulum

Files: `dpend/description.md`, `dpend/index.html`, `dpend/system.py`

Two masses are connected in series. The coordinates `theta1` and `theta2`
measure both arms from the downward vertical:

```text
r1 = (l1 sin(theta1), -l1 cos(theta1))
r2 = r1 + (l2 sin(theta2), -l2 cos(theta2))
```

The mixed kinetic-energy term couples both coordinates, so the solver
constructs and solves a 2×2 acceleration system at every step.

Defaults: `m1 = 1`, `m2 = 1`, `g = 10`, `l1 = 0.5`, `l2 = 0.5`,
`theta1 = 2`, and `theta2 = 3.14`.

## Swinging Atwood Machine

Files: `atwood/description.md`, `atwood/index.html`, `atwood/system.py`

A vertically moving mass `M` is coupled to a swinging mass `m` by a
variable-length cord. The coordinates are radial distance `r` and angle
`theta`. The changing radius couples radial and angular motion.

Defaults: `m = 1`, `M = 5`, `g = 10`, `r = 1`, and `theta = pi/2`.

## Rolling Disk Pendulum

Files: `disk/description.md`, `disk/index.html`, `disk/system.py`

This is the largest model retained in the project. It contains:

- A rocking annular ring.
- An inner disk rolling inside the ring.
- Two pendulum masses attached to the inner disk.
- Three springs.

The generalized coordinates are `x`, `theta1`, and `theta2`. The model
includes translational, rotational, gravitational, and spring energies. Its
generated equations are intentionally not rendered on screen because they are
too large for practical display.

## Disk on Slope

Files: `slope/description.md`, `slope/index.html`, `slope/system.py`

A rigid disk rolls without slipping along an inclined plane. The coordinate
`x` measures translation along the slope, and the disk rotation is constrained
by:

```text
omega = x_dot / r
```

The slope direction is `(2, -1)`, normalized by the `Disk` constraint. The
model uses mass `m`, moment of inertia `I`, radius `r`, and gravity `g`.

Defaults: `m = 1`, `I = 1`, `r = 1`, `g = 10`, and `x = -7`.

## Elastic Pendulum

Files: `elastic/description.md`, `elastic/index.html`, `elastic/system.py`

A mass is attached to an extensible spring fixed at the origin. The
coordinates are radial distance `r` and angle `theta`:

```text
r_vector = (r sin(theta), -r cos(theta))
T = 1/2 m (r_dot² + r² theta_dot²)
V = -m g r cos(theta) + 1/2 k (r - l)²
```

Defaults: `m = 1`, `g = 10`, `l = 1`, `k = 20`, `r = 1`, and `theta = 0.8`.

## Parameters

Parameter inputs are defined in each retained `system.py`. The browser clamps
values to the configured minimum and maximum, reloads the constants, rebuilds
the equations, and resets the initial state.

## Documentation

- `maths/index.html` explains the mathematical method in the browser.
- `maths/maths.md` contains the equations for the retained systems.
- `mechmaths/README.md` documents the symbolic and numerical library.
