# Epidemic Simulator (SIR Model)

An interactive agent-based epidemic simulation in plain HTML, CSS and JavaScript. Dots move around a canvas, infect each other on contact, and recover. A live graph tracks the outbreak and overlays the prediction of the classic SIR differential equations so you can compare the two.

## Run it

Open `index.html` in any modern browser. No build step, no dependencies.

## Controls

| Slider | What it does |
|---|---|
| Infection chance per contact | Probability an infected dot passes the disease to a susceptible dot each tick they are within contact range |
| Recovery time | Mean days an infected dot stays infectious (recovery is random, with this mean) |
| Social distancing | Share of the population that stops moving. Changing it mid-run flattens (or steepens) the curve live |
| Population | Number of dots (restarts the run) |

## The math

Each dot is Susceptible (S), Infected (I) or Recovered (R). The SIR model describes the fractions of the population in each state:

```
dS/dt = -β · S · I
dI/dt =  β · S · I - γ · I
dR/dt =  γ · I
```

- **γ = 1 / recovery time**: the recovery rate.
- **β**: the transmission rate, i.e. how many new infections one infected person causes per unit time in a fully susceptible population.
- **R₀ = β / γ**: the basic reproduction number. An outbreak grows only if R₀ > 1.
- **Final size**: the fraction ever infected, x, satisfies `x = 1 - exp(-R₀ · x)`. The page solves this and shows it next to the simulated result.

### Connecting the simulation to the equations

The equations know nothing about dots, speeds or contact radius, so the simulator measures β from the agent model:

```
β = (infection chance per contact) × (contacts per person per tick)
```

Contacts per person are counted every tick (pairs of dots within the contact radius) and smoothed with a moving average. Distancing lowers the measured contact rate, which lowers β and R₀ in the equations automatically. The ODE is integrated with Euler steps (1 tick = 1/10 day), and each agent recovers with probability `1 - exp(-γ)` per tick so recovery times are exponential, as the equations assume.

## What to expect

- **Shape matches.** Infected rises, peaks, then falls; susceptible declines monotonically; recovered rises in an S-curve.
- **Timing and peak differ somewhat.** The equations are deterministic and assume everyone mixes perfectly. The simulation is stochastic and spatial, so:
  - Early on, a few random events decide when the outbreak takes off (the dashed and solid curves are shifted in time).
  - Infection spreads through local clusters, so the real peak is often lower and later than the mean-field prediction.
  - Small populations show more noise. Try 800 dots versus 100.
- **Final size agrees closely** for moderate R₀. For R₀ ≤ 1 the outbreak fizzles in both.

## Experiments

1. Set distancing to 0% and note R₀ and the peak. Raise distancing to 50%, then 80%: the peak flattens and R₀ drops below 1 at high values.
2. Double the recovery time and watch R₀ double (γ halves).
3. Compare final size (sim) with final size (equations) across many settings.
4. Drop distancing from 80% to 0% mid-outbreak to simulate a reopening.

## Files

- `index.html`: layout and controls
- `style.css`: styling
- `script.js`: agent simulation, spatial-hash contact detection, ODE integration, drawing

## Ideas to extend

- Add an Exposed state (SEIR) with an incubation period
- Add vaccination (move a fraction of S directly to R)
- Quarantine infected dots, or add travel between clusters
- Export the run as CSV and fit β by least squares
