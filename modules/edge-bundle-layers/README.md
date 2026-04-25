# @deck.gl-community/edge-bundle-layers

[![NPM Version](https://img.shields.io/npm/v/@deck.gl-community/edge-bundle-layers.svg)](https://www.npmjs.com/package/@deck.gl-community/edge-bundle-layers)
[![NPM Downloads](https://img.shields.io/npm/dw/@deck.gl-community/edge-bundle-layers.svg)](https://www.npmjs.com/package/@deck.gl-community/edge-bundle-layers)

Edge bundling layer for deck.gl. Reduces visual clutter in dense graphs by attracting geometrically compatible edges toward each other, revealing flow corridors in spatial networks such as flight routes, migration paths, and road traffic.

## Bundling algorithms

`EdgeBundleLayer` supports four bundling strategies via the `bundlingAlgorithm` prop.

### `centroid`

Groups edges by `bundleKey` and pulls each edge's midpoint toward the weighted centroid of its group using a quadratic Bézier curve. Fast and deterministic. Works best when edges naturally cluster around shared waypoints (e.g. hub-and-spoke networks).

### `spine`

Similar to `centroid` but pulls midpoints onto a line through the group's average source and target positions rather than a single centroid point. Produces straighter, more directional bundles. Good for corridor-style layouts.

### `force` and `force-gpu`

Implements **Force-Directed Edge Bundling (FDEB)** as described in:

> Holten, D. & van Wijk, J.J. (2009). **Force-Directed Edge Bundling for Graph Visualization.**  
> _Computer Graphics Forum_, 28(3), 983–990.  
> https://doi.org/10.1111/j.1467-8659.2009.01450.x

Each edge is subdivided into a chain of control points. Two forces act on every interior point at each simulation step:

- **Spring force** — adjacent control points on the same edge attract each other, keeping the path smooth and preventing it from tangling.
- **Electrostatic force** — control points from _other_ edges attract the current point in proportion to how _compatible_ those edges are. Compatibility is a product of four geometric measures: angle similarity, length similarity, positional proximity, and visibility (whether the edges "see" each other without crossing far away). Only edges above a compatibility threshold contribute, so anti-parallel or spatially distant edges are ignored.

At each iteration both forces are accumulated, the points are nudged by a decaying step size, and a smoothing pass is applied to remove high-frequency kinks. After enough iterations the edges settle into stable bundles that follow the dominant flow corridors in the data.

`force-gpu` runs the same simulation on the GPU using WebGL2 compute-via-fragment-shaders. Each iteration dispatches two render passes — one for the force update and one for smoothing — writing positions into floating-point textures. This allows the O(n²) compatibility lookups to run in parallel across edges, making the algorithm practical for datasets with several hundred routes.

**Differences from Holten's hierarchical edge bundling (2006):** FDEB requires no predefined hierarchy over the nodes. Bundling emerges purely from the geometry of the edges, making it well suited for geographic networks where no natural tree structure exists.

## Usage

```ts
import {EdgeBundleLayer} from '@deck.gl-community/edge-bundle-layers';

new EdgeBundleLayer({
  data: edges,
  getSourcePosition: (d) => d.source,
  getTargetPosition: (d) => d.target,
  getBundleKey: (d) => d.bundleKey,
  bundlingAlgorithm: 'force-gpu',
  bundleStrength: 0.85,
  subdivisionCount: 20,
  forceIterations: 8,
  renderMode: 'path'
});
```

## Props

| Prop                | Type                                              | Default            | Description                                                                                                                        |
| ------------------- | ------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `bundlingAlgorithm` | `'centroid' \| 'spine' \| 'force' \| 'force-gpu'` | `'centroid'`       | Which algorithm to use.                                                                                                            |
| `bundleStrength`    | `number` 0–1                                      | `0.85`             | How strongly edges are pulled toward each other. Higher values produce tighter bundles but increase distortion for outlier routes. |
| `subdivisionCount`  | `number`                                          | `16`               | Number of control points per edge. More points allow finer curves but increase compute cost.                                       |
| `forceIterations`   | `number`                                          | `8`                | Number of outer simulation iterations (`force`/`force-gpu` only). Each outer iteration runs 8 inner steps internally.              |
| `forceStepSize`     | `number`                                          | `0.15`             | Initial step size for the force simulation. Decays by ×0.985 each iteration.                                                       |
| `renderMode`        | `'path' \| 'arc'`                                 | `'path'`           | `path` renders the full bundled polyline; `arc` fits a single great-circle arc to the bundled shape.                               |
| `getSourcePosition` | accessor                                          | `d.sourcePosition` | Source coordinate `[lng, lat]` or `[lng, lat, alt]`.                                                                               |
| `getTargetPosition` | accessor                                          | `d.targetPosition` | Target coordinate.                                                                                                                 |
| `getBundleKey`      | accessor                                          | edge index         | Edges with the same key are bundled together.                                                                                      |
| `getWeight`         | accessor                                          | `1`                | Per-edge weight used when computing the group centroid and bundle stiffness.                                                       |

All standard `PathLayer` props (`getColor`, `getWidth`, `widthUnits`, `widthMinPixels`, `widthMaxPixels`, `rounded`, `capRounded`, `jointRounded`, …) are forwarded to the underlying layer.

## See also

- Holten, D. (2006). Hierarchical Edge Bundles: Visualization of Adjacency Relations in Hierarchical Data. _IEEE TVCG_, 12(5). https://doi.org/10.1109/TVCG.2006.147
