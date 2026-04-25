# EdgeBundleLayer

`EdgeBundleLayer` is a `CompositeLayer` that computes bundled paths from edge endpoints and renders them via a `PathLayer`.

## Import

```ts
import {EdgeBundleLayer} from '@deck.gl-community/edge-bundle-layers';
```

## Usage

```ts
new EdgeBundleLayer({
  id: 'edge-bundles',
  data: edges,
  pickable: true,
  widthUnits: 'pixels',
  getSourcePosition: edge => edge.sourcePosition,
  getTargetPosition: edge => edge.targetPosition,
  getBundleKey: edge => edge.airline,
  bundlingAlgorithm: 'centroid',
  bundleStrength: 0.85,
  subdivisionCount: 16,
  getColor: edge => edge.color,
  getWidth: edge => edge.width
});
```

## Props

### `getSourcePosition` (Accessor, optional)

Returns the edge source coordinate. Default expects `d.sourcePosition`.

### `getTargetPosition` (Accessor, optional)

Returns the edge target coordinate. Default expects `d.targetPosition`.

### `getBundleKey` (Accessor, optional)

Grouping key used for bundling. Edges sharing this key are attracted toward the same bundle center.

### `getWeight` (Accessor, optional)

Weight used when computing the bundle center for each group.

### `bundleStrength` (number, optional)

Blend factor in `[0, 1]` controlling how strongly edges move toward bundle centers.

### `bundlingAlgorithm` (`'centroid' | 'spine' | 'force'`, optional)

Selects which bundling strategy to run.

- `centroid`: Pull each edge toward the group midpoint center (fast baseline).
- `spine`: Pull each edge toward the average source-target spine of its group (direction-preserving).
- `force`: Iterative attraction within each group (closest to force-directed behavior).

### `subdivisionCount` (number, optional)

Number of quadratic segments used when sampling each bundled curve.

### `forceIterations` (number, optional)

Iteration count used by the `force` algorithm.

### `forceStepSize` (number, optional)

Step size used by the `force` algorithm.
