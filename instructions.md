# Mechanics Simulator Instructions

This repository contains a browser-based classical-mechanics simulator. The
selected mechanisms are modelled with Lagrangian mechanics, converted into
equations of motion symbolically, and integrated numerically with fourth-order
Runge-Kutta (RK4).

This document covers only these six mechanisms:

1. Simple Pendulum
2. Double Pendulum
3. Cart and Pendulum
4. Disk on Slope
5. Elastic Pendulum
6. Swinging Atwood Machine

## How the simulator works

Each mechanism has three files:

- `description.md` - a short explanation shown in the browser.
- `index.html` - the page metadata and Canvas drawing code.
- `system.py` - the physical model, constants, parameters, and initial state.

The shared runtime is implemented by:

- `mechmaths/deriv.py` - symbolic expressions, differentiation, substitution,
  simplification, evaluation, and LaTeX formatting.
- `mechmaths/system.py` - vectors, masses, springs, disks, and mechanical
  constraints.
- `mechmaths/engine.py` - Euler-Lagrange equation generation, acceleration
  solving, energy evaluation, and RK4 integration.
- `simulation_runner.py` - the PyScript bridge between Python and JavaScript.
- `mechsimulator.js` - the browser interface, Canvas helpers, controls,
  metrics, energy display, equations, and trails.

The general process is:

1. Define generalized coordinates in `Expression.context`.
2. Define positions and constraints for the mechanical components.
3. Construct kinetic energy `T` and potential energy `V`.
4. Create a `Solver(T, V)`.
5. Load physical constants.
6. Derive the Euler-Lagrange equations.
7. Solve for accelerations at each state.
8. Advance the state using RK4.
9. Send the state to JavaScript for drawing.

The Lagrangian is:

```text
L = T - V
```

For each generalized coordinate `qᵢ`, the engine applies:

```text
d/dt(∂L/∂q̇ᵢ) - ∂L/∂qᵢ = 0
```

The resulting equations are arranged as a linear system in the accelerations:

```text
A(q, q̇, t) q̈ = b(q, q̇, t)
```

Simulation pages provide playback controls for reset, pause/play, and
single-step advancement. They also display the current time, coordinates,
velocities, kinetic energy, potential energy, and total energy. Parameter
controls clamp user input to the safe range defined by the relevant
`system.py` file and restart the model with the new constants.

---

# 1. Simple Pendulum

Files:

- `pend/description.md`
- `pend/index.html`
- `pend/system.py`

## Physical model

The system contains one point mass attached to a fixed hinge by a rigid rod.
The generalized coordinate is the angle `theta`, measured from the downward
vertical.

The mass position is:

```text
r = (l sin(theta), -l cos(theta))
```

The kinetic and gravitational potential energies are:

```text
T = 1/2 m l² theta_dot²
V = m g y
```

The resulting equation is:

```text
m l² theta_ddot + m g l sin(theta) = 0
```

or:

```text
theta_ddot = -(g/l) sin(theta)
```

## Model configuration

`pend/system.py` uses:

- Coordinate: `theta`
- Mass: `m`
- Gravity: `g`
- Length: `l`

Default constants:

```text
m = 1
g = 10
l = 1
```

Default initial angle:

```text
theta = 2 radians
```

Parameter ranges:

- Mass: `0.1` to `20 kg`
- Gravity: `0.1` to `30 m/s²`
- Length: `0.1` to `5 m`

## Rendering

`pend/index.html` draws the hinge, vertical reference axis, pendulum arm,
angle marker, bob, and a fading blue trail.

---

# 2. Double Pendulum

Files:

- `dpend/description.md`
- `dpend/index.html`
- `dpend/system.py`

## Physical model

The system contains two point masses connected in series. The generalized
coordinates are `theta1` and `theta2`, both measured from the downward
vertical.

The first mass position is:

```text
r₁ = (l₁ sin(theta1), -l₁ cos(theta1))
```

The second mass position is:

```text
r₂ = r₁ + (l₂ sin(theta2), -l₂ cos(theta2))
```

The kinetic energy is:

```text
T =
1/2 (m₁ + m₂) l₁² theta1_dot²
+ 1/2 m₂ l₂² theta2_dot²
+ m₂ l₁ l₂ theta1_dot theta2_dot cos(theta1 - theta2)
```

The potential energy is:

```text
V =
-(m₁ + m₂) g l₁ cos(theta1)
-m₂ g l₂ cos(theta2)
```

The two coordinates are coupled through the mixed kinetic-energy term. The
engine therefore solves a 2×2 acceleration system at every time step.

## Model configuration

`dpend/system.py` uses:

- Coordinates: `theta1`, `theta2`
- Masses: `m1`, `m2`
- Lengths: `l1`, `l2`
- Gravity: `g`

Default constants:

```text
m1 = 1
m2 = 1
g = 10
l1 = 0.5
l2 = 0.5
```

Default initial angles:

```text
theta1 = 2 radians
theta2 = 3.14 radians
```

Parameter ranges:

- Each mass: `0.1` to `20 kg`
- Gravity: `0.1` to `30 m/s²`
- Each length: `0.1` to `3 m`

## Rendering

`dpend/index.html` draws both arms, the two hinges, both masses, reference
axes, and angle indicators for `theta1` and `theta2`.

---

# 3. Cart and Pendulum

Files:

- `cart/description.md`
- `cart/index.html`
- `cart/system.py`

## Physical model

The cart moves horizontally while a pendulum hangs from a hinge attached to
the cart. A spring connects the cart to a fixed anchor.

The generalized coordinates are:

- `x` - horizontal cart displacement.
- `theta` - pendulum angle.

The cart is constrained to the horizontal plane. The pendulum mass is
constrained to a hinge whose center moves with the cart.

The pendulum position is:

```text
r = (x - l sin(theta), 1/2 - l cos(theta))
```

The system has:

- Cart mass `M`.
- Pendulum mass `m`.
- Pendulum length `l`.
- Spring anchor distance `d`.
- Spring stiffness `k`.
- Gravity `g`.

The kinetic energy is:

```text
T =
1/2 (M + m) x_dot²
- m l cos(theta) x_dot theta_dot
+ 1/2 m l² theta_dot²
```

The potential energy combines gravity and spring energy:

```text
V =
m g (1/2 - l cos(theta))
+ 1/2 k x²
```

Because the cart and pendulum share motion, the two equations are coupled.

## Model configuration

Default constants:

```text
M = 1
m = 1
g = 10
l = 1
d = 1.5
k = 6
```

Default initial state:

```text
x = -1
theta = 0.5 radians
```

Parameter ranges:

- Cart mass `M`: `0.1` to `20 kg`
- Pendulum mass `m`: `0.1` to `20 kg`
- Gravity: `0.1` to `30 m/s²`
- Pendulum length: `0.1` to `5 m`
- Spring anchor distance: `0.5` to `5 m`
- Spring stiffness: `0.1` to `100`

## Rendering

`cart/index.html` draws the horizontal plane, cart body, spring, pendulum
bar, hinge, coordinate marker, and pendulum angle.

---

# 4. Disk on Slope

Files:

- `slope/description.md`
- `slope/index.html`
- `slope/system.py`

## Physical model

This model represents a rigid disk rolling without slipping along an inclined
plane. The generalized coordinate `x` measures translation along the slope.

The slope direction is represented by:

```text
p = (2, -1)
```

The engine normalizes that vector before constructing the disk position. A
perpendicular normal is used to place the disk center above the slope.

The disk has:

- Mass `m`.
- Moment of inertia `I`.
- Radius `r`.
- Gravity `g`.

Rolling without slipping gives:

```text
omega = x_dot / r
```

The kinetic energy is:

```text
T = 1/2 m x_dot² + 1/2 I (x_dot/r)²
```

The potential energy is the gravitational energy of the disk center.

Equivalently:

```text
T = 1/2 (m + I/r²) x_dot²
```

The equation of motion has the form:

```text
(m + I/r²) x_ddot + gravitational_term = 0
```

The exact sign of the gravitational term follows the coordinate direction
chosen by the slope vector.

## Model configuration

Default constants:

```text
m = 1
I = 1
r = 1
g = 10
```

Default initial position:

```text
x = -7
```

Parameter ranges:

- Mass: `0.1` to `20 kg`
- Moment of inertia: `0.001` to `10`
- Radius: `0.05` to `2 m`
- Gravity: `0.1` to `30 m/s²`

## Rendering

`slope/index.html` draws the inclined plane, rolling disk, disk rotation,
position, and a fading motion trail.

---

# 5. Elastic Pendulum

Files:

- `elastic/description.md`
- `elastic/index.html`
- `elastic/system.py`

## Physical model

The mass is attached to an extensible spring fixed at the origin. The motion
has two generalized coordinates:

- `r` - current radial distance from the origin.
- `theta` - angular position.

The mass position is:

```text
r_vector = (r sin(theta), -r cos(theta))
```

The kinetic energy is:

```text
T = 1/2 m (r_dot² + r² theta_dot²)
```

The potential energy contains gravity and spring extension:

```text
V = -m g r cos(theta) + 1/2 k (r - l)²
```

Here `l` is the spring’s rest length and `k` is its stiffness.

The radial and angular equations are coupled because the angular kinetic
energy depends on `r²`.

## Model configuration

Default constants:

```text
m = 1
g = 10
l = 1
k = 20
```

Default initial state:

```text
r = 1
theta = 0.8 radians
```

Parameter ranges:

- Mass: `0.1` to `20 kg`
- Gravity: `0.1` to `30 m/s²`
- Rest length: `0.1` to `3 m`
- Spring stiffness: `0.1` to `100`

## Rendering

`elastic/index.html` draws the spring, radial reference line, mass, current
angle, current radius, and fading trail. It labels both radial and angular
coordinates and their velocities.

---

# 6. Swinging Atwood Machine

Files:

- `atwood/description.md`
- `atwood/index.html`
- `atwood/system.py`

## Physical model

The Swinging Atwood Machine combines a vertically moving mass with a
pendulum-like swinging mass connected through a variable-length cord and
pulley.

The generalized coordinates are:

- `r` - vertical position and variable cord length.
- `theta` - swinging angle.

The vertical mass `M` is constrained to move along the vertical line. The
swinging mass `m` is attached to a hinge centered on the moving system.

The swinging mass position is represented using:

```text
r_swing = center + (0, -r) rotated by -theta
```

The total kinetic energy includes the vertical motion, radial motion, and
angular motion of the swinging mass. The total potential energy includes the
gravitational energy of both masses.

Using the coordinate convention in the mathematical documentation, the
energies can be written as:

```text
T = 1/2 (M + m) r_dot² + 1/2 m r² theta_dot²
V = M g r - m g r cos(theta)
```

This produces coupled radial and angular equations. The changing radius makes
the angular equation depend on radial velocity, while angular velocity affects
the radial equation.

## Model configuration

Default constants:

```text
m = 1
M = 5
g = 10
```

Default initial state:

```text
r = 1
theta = pi/2 radians
```

Parameter ranges:

- Swinging mass `m`: `0.1` to `20 kg`
- Hanging mass `M`: `0.1` to `20 kg`
- Gravity: `0.1` to `30 m/s²`

## Rendering

`atwood/index.html` draws the pulley, vertically moving mass, variable-length
cord, swinging mass, coordinate axes, radial label, angular orientation, and
colored trails.

---

# Browser controls and interface

The shared JavaScript runtime provides these controls on each selected
mechanism page:

- **Reset**: restores the configured initial state and pauses the simulation.
- **Play/Pause**: starts or stops animation.
- **Step**: advances the simulation while leaving it paused.
- **Parameters**: opens model-specific sliders and numeric inputs.
- **Description**: opens the mechanism description.
- **Show/Hide system file**: displays the mechanism’s `system.py`.
- **Home**: returns to the simulator homepage.

The page also displays:

- Current simulation time.
- Generalized coordinates.
- Generalized velocities.
- Kinetic energy.
- Potential energy.
- Total energy.
- A visual kinetic/potential energy bar.
- Generated equations when enabled.

The six mechanisms above are the complete documented scope of this file.

# Important implementation notes

- Python models must define `Expression.context` before creating the solver.
- Constants are substituted into symbolic expressions with
  `solver.load_constants(constants)`.
- Initial coordinates are passed to `load_solver()`.
- Optional initial velocities can be passed as the final argument to
  `load_solver()`.
- Parameter values are clamped in both the browser UI and Python update path.
- The browser uses PyScript and the shared `mechsimulator-conf.json`.
- The symbolic engine avoids third-party computer-algebra packages.
- Normal Python uses NumPy; MicroPython uses `ulab`.
- Equations may be rendered as LaTeX through MathJax.
- Canvas drawing is intentionally kept in each mechanism’s `index.html`, while
  common drawing and UI behavior stays in `mechsimulator.js`.
