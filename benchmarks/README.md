# Benchmarks

Micro-benchmarks for the framework's hot paths, using [tinybench](https://github.com/tinylibs/tinybench).

```bash
npm run bench            # the suites below
npm run bench:dispatch   # one interaction through the real router, end to end
```

## What's measured

| Suite | Why it matters |
| --- | --- |
| **customId codec** | encode/decode runs on every component (button/select/modal) interaction |
| **routing hot path** | the per-interaction work the framework does before your handler: key parse → registry lookup → param decode → guard pipeline |
| **registry registration** | boot-time cost of registering definitions |
| **intent autopilot** | `computeIntents` over your events (boot-time) |
| **infra primitives** | `i18n.t`, `rateLimiter.consume`, `TTLCache` - used in hot handlers |
| **loader** | file discovery (repeatable) and a one-time cold load of N features |
| **dispatch** (`bench:dispatch`) | everything the framework does for one interaction: context, reply helpers, option resolution, middleware, guards, handler, bookkeeping |

## Representative results

Node 24, Windows x64 (your numbers will vary - these are indicative):

### Dispatch, end to end (per interaction)

The interaction is a stub whose Discord calls resolve immediately, so this is
the framework's own cost and nothing else.

| Interaction | ops/sec | avg | p99 |
| --- | ---: | ---: | ---: |
| command, no options | ~270,000 | 4.0 µs | 10 µs |
| command, 2 options + 2 guards | ~240,000 | 4.6 µs | 12 µs |
| subcommand | ~250,000 | 4.4 µs | 12 µs |
| button, 2 typed params | ~205,000 | 5.4 µs | 14 µs |
| command + 2 middlewares + automatic deferral | ~200,000 | 5.5 µs | 14 µs |

One core routes a couple of hundred thousand interactions per second. Discord's
network round-trip is measured in milliseconds: the router is never your
bottleneck.

The table below times the pieces of that path in isolation.

### Routing (per interaction)

| Step | ops/sec | avg |
| --- | ---: | ---: |
| registry lookup (200 entries) | ~9,800,000 | 0.11 µs |
| decode params | ~1,500,000 | 0.85 µs |
| guard pipeline (3 guards) | ~2,200,000 | 0.49 µs |
| **full route** (key + lookup + decode + guards) | **~750,000** | **1.4 µs** |

Lookup, decoding and guards together take about 1.4 µs; the rest of the 4 µs
above is building the context and the reply helpers.

### customId codec

| Op | ops/sec | avg |
| --- | ---: | ---: |
| encode (no params) | ~15,000,000 | 0.05 µs |
| encode (2 params) | ~2,000,000 | 0.70 µs |
| decode (2 params) | ~1,500,000 | 0.84 µs |
| `customIdKey` (parse only) | ~14,000,000 | 0.05 µs |

### Infra & boot

| Op | ops/sec | avg |
| --- | ---: | ---: |
| `computeIntents` (10 events) | ~1,300,000 | 0.80 µs |
| register 100 commands | ~275,000 batches | ~37 ns / command |
| `i18n.t` (nested + interpolation) | ~570,000 | 1.8 µs |
| `rateLimiter.consume` | ~9,500,000 | 0.11 µs |
| `TTLCache.get` (hit) | ~7,000,000 | 0.17 µs |

### Loader (boot-time, one-time)

- Discovering 200 feature files (recursive fs walk): **~22 ms**
- Cold load of 200 features (walk + import + register): **~256 ms**
  (~1.3 ms/feature, dominated by ESM `import()`)

## Notes

- Loader cost is paid **once at startup**, not per interaction. The dynamic
  `import()` of your feature files dominates it; discovery and registration are a
  small fraction.
- Results are machine- and Node-version-dependent. Run `npm run bench` locally
  for numbers on your hardware.
