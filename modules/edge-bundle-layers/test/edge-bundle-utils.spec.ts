// deck.gl-community
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

import {describe, expect, it} from 'vitest';
import {computeBundledPaths} from '../src/edge-bundle-layer/edge-bundle-utils';

type Edge = {
  source: [number, number];
  target: [number, number];
  key: string;
};

type Edge3D = {
  source: [number, number, number];
  target: [number, number, number];
  key: string;
};

const BASE_OPTS = {
  getSourcePosition: (e: Edge) => e.source,
  getTargetPosition: (e: Edge) => e.target,
  getBundleKey: (e: Edge) => e.key,
  getWeight: 1 as const,
  bundleStrength: 1,
  subdivisionCount: 4,
  bundlingAlgorithm: 'centroid' as const,
  forceIterations: 8,
  forceStepSize: 0.15
};

describe('computeBundledPaths', () => {
  it('returns straight paths when edges are not grouped', () => {
    const edges: Edge[] = [{source: [0, 0], target: [10, 0], key: 'a'}];
    const edgePaths = computeBundledPaths({
      data: edges,
      getSourcePosition: (edge) => edge.source,
      getTargetPosition: (edge) => edge.target,
      getBundleKey: (edge) => edge.key,
      getWeight: 1,
      bundleStrength: 1,
      subdivisionCount: 4,
      bundlingAlgorithm: 'centroid',
      forceIterations: 8,
      forceStepSize: 0.15
    });

    expect(edgePaths).toHaveLength(1);
    expect(edgePaths[0].path).toHaveLength(5);
    expect(edgePaths[0].path[0]).toEqual([0, 0]);
    expect(edgePaths[0].path[4]).toEqual([10, 0]);
    expect(edgePaths[0].path[2][1]).toBe(0);
  });

  it('curves paths toward bundle center for grouped edges', () => {
    const edges: Edge[] = [
      {source: [0, 0], target: [10, 0], key: 'group-1'},
      {source: [0, 10], target: [10, 10], key: 'group-1'}
    ];
    const edgePaths = computeBundledPaths({
      data: edges,
      getSourcePosition: (edge) => edge.source,
      getTargetPosition: (edge) => edge.target,
      getBundleKey: (edge) => edge.key,
      getWeight: 1,
      bundleStrength: 1,
      subdivisionCount: 4,
      bundlingAlgorithm: 'centroid',
      forceIterations: 8,
      forceStepSize: 0.15
    });

    expect(edgePaths).toHaveLength(2);
    expect(edgePaths[0].path[2][1]).toBeGreaterThan(0);
    expect(edgePaths[1].path[2][1]).toBeLessThan(10);
  });

  it('supports spine and force algorithms', () => {
    const edges: Edge[] = [
      {source: [0, 0], target: [10, 0], key: 'group-1'},
      {source: [0, 10], target: [10, 10], key: 'group-1'},
      {source: [0, 20], target: [10, 20], key: 'group-1'}
    ];

    const spinePaths = computeBundledPaths({
      data: edges,
      getSourcePosition: (edge) => edge.source,
      getTargetPosition: (edge) => edge.target,
      getBundleKey: (edge) => edge.key,
      getWeight: 1,
      bundleStrength: 1,
      subdivisionCount: 4,
      bundlingAlgorithm: 'spine',
      forceIterations: 8,
      forceStepSize: 0.15
    });
    const forcePaths = computeBundledPaths({
      data: edges,
      getSourcePosition: (edge) => edge.source,
      getTargetPosition: (edge) => edge.target,
      getBundleKey: (edge) => edge.key,
      getWeight: 1,
      bundleStrength: 1,
      subdivisionCount: 4,
      bundlingAlgorithm: 'force',
      forceIterations: 8,
      forceStepSize: 0.15
    });

    expect(spinePaths).toHaveLength(3);
    expect(forcePaths).toHaveLength(3);
    expect(spinePaths[0].path[2][1]).toBeGreaterThan(0);
    expect(forcePaths[2].path[2][1]).toBeLessThanOrEqual(20);
  });

  describe('output structure', () => {
    it('returns empty array for empty data', () => {
      const result = computeBundledPaths({...BASE_OPTS, data: []});
      expect(result).toHaveLength(0);
    });

    it('output length matches input length', () => {
      const edges: Edge[] = [
        {source: [0, 0], target: [10, 0], key: 'a'},
        {source: [0, 5], target: [10, 5], key: 'b'},
        {source: [0, 10], target: [10, 10], key: 'a'}
      ];
      expect(computeBundledPaths({...BASE_OPTS, data: edges})).toHaveLength(3);
    });

    it('path has subdivisionCount + 1 points for centroid', () => {
      const edges: Edge[] = [{source: [0, 0], target: [10, 0], key: 'a'}];
      const result = computeBundledPaths({...BASE_OPTS, data: edges, subdivisionCount: 8});
      expect(result[0].path).toHaveLength(9);
    });

    it('each result references the original edge object', () => {
      const edges: Edge[] = [
        {source: [0, 0], target: [10, 0], key: 'a'},
        {source: [0, 5], target: [10, 5], key: 'b'}
      ];
      const result = computeBundledPaths({...BASE_OPTS, data: edges});
      expect(result[0].edge).toBe(edges[0]);
      expect(result[1].edge).toBe(edges[1]);
    });

    it('accepts iterable data (generator)', () => {
      function* makeEdges() {
        yield {source: [0, 0] as [number, number], target: [10, 0] as [number, number], key: 'a'};
        yield {source: [0, 5] as [number, number], target: [10, 5] as [number, number], key: 'a'};
      }
      const result = computeBundledPaths({...BASE_OPTS, data: makeEdges()});
      expect(result).toHaveLength(2);
    });

    it('preserves source and target as first and last path points for all non-gpu algorithms', () => {
      const edges: Edge[] = [
        {source: [1.5, 2.5], target: [7.5, 8.5], key: 'g'},
        {source: [3, 4], target: [9, 10], key: 'g'}
      ];
      for (const bundlingAlgorithm of ['centroid', 'spine', 'force'] as const) {
        const result = computeBundledPaths({...BASE_OPTS, data: edges, bundlingAlgorithm, forceIterations: 2});
        for (let i = 0; i < result.length; i++) {
          const {path} = result[i];
          expect(path[0][0]).toBeCloseTo(edges[i].source[0], 4);
          expect(path[0][1]).toBeCloseTo(edges[i].source[1], 4);
          expect(path[path.length - 1][0]).toBeCloseTo(edges[i].target[0], 4);
          expect(path[path.length - 1][1]).toBeCloseTo(edges[i].target[1], 4);
        }
      }
    });
  });

  describe('Z-coordinate handling', () => {
    it('emits 2D path points when z is zero on both endpoints', () => {
      const edges: Edge[] = [{source: [0, 0], target: [10, 0], key: 'a'}];
      const result = computeBundledPaths({...BASE_OPTS, data: edges});
      expect(result[0].path[0]).toHaveLength(2);
    });

    it('emits 3D path points when source has non-zero z', () => {
      const edges: Edge3D[] = [{source: [0, 0, 5], target: [10, 0, 5], key: 'a'}];
      const result = computeBundledPaths({
        ...BASE_OPTS,
        data: edges,
        getSourcePosition: (e) => e.source,
        getTargetPosition: (e) => e.target,
        getBundleKey: (e) => e.key
      });
      expect(result[0].path[0]).toHaveLength(3);
    });

    it('emits 3D path points when target has non-zero z', () => {
      const edges: Edge3D[] = [{source: [0, 0, 0], target: [10, 0, 3], key: 'a'}];
      const result = computeBundledPaths({
        ...BASE_OPTS,
        data: edges,
        getSourcePosition: (e) => e.source,
        getTargetPosition: (e) => e.target,
        getBundleKey: (e) => e.key
      });
      expect(result[0].path[0]).toHaveLength(3);
    });

    it('z values are interpolated along the path for 3D edges', () => {
      const edges: Edge3D[] = [
        {source: [0, 0, 0], target: [10, 0, 10], key: 'a'},
        {source: [0, 5, 0], target: [10, 5, 10], key: 'a'}
      ];
      const result = computeBundledPaths({
        ...BASE_OPTS,
        data: edges,
        getSourcePosition: (e) => e.source,
        getTargetPosition: (e) => e.target,
        getBundleKey: (e) => e.key,
        bundlingAlgorithm: 'centroid'
      });
      const midZ = result[0].path[2][2] as number | undefined;
      expect(midZ).toBeDefined();
      expect(midZ!).toBeGreaterThan(0);
      expect(midZ!).toBeLessThan(10);
    });
  });

  describe('accessor types', () => {
    it('accepts constant number for getWeight', () => {
      const edges: Edge[] = [{source: [0, 0], target: [10, 0], key: 'a'}];
      expect(() => computeBundledPaths({...BASE_OPTS, data: edges, getWeight: 2})).not.toThrow();
    });

    it('accepts function accessor for getWeight', () => {
      const edges: Edge[] = [
        {source: [0, 0], target: [10, 0], key: 'a'},
        {source: [0, 5], target: [10, 5], key: 'a'}
      ];
      const result = computeBundledPaths({
        ...BASE_OPTS,
        data: edges,
        getWeight: (_e, {index}) => (index === 0 ? 10 : 1)
      });
      expect(result).toHaveLength(2);
    });

    it('accepts numeric bundleKey', () => {
      const edges = [{source: [0, 0] as [number, number], target: [10, 0] as [number, number], key: 42}];
      const result = computeBundledPaths({
        ...BASE_OPTS,
        data: edges,
        getSourcePosition: (e) => e.source,
        getTargetPosition: (e) => e.target,
        getBundleKey: (e) => e.key
      });
      expect(result).toHaveLength(1);
    });

    it('groups edges correctly when getBundleKey returns the same numeric key', () => {
      const edges = [
        {source: [0, 0] as [number, number], target: [10, 0] as [number, number], key: 99},
        {source: [0, 10] as [number, number], target: [10, 10] as [number, number], key: 99}
      ];
      const result = computeBundledPaths({
        ...BASE_OPTS,
        data: edges,
        getSourcePosition: (e) => e.source,
        getTargetPosition: (e) => e.target,
        getBundleKey: (e) => e.key,
        bundleStrength: 1
      });
      expect(result[0].path[2][1]).toBeGreaterThan(0);
      expect(result[1].path[2][1]).toBeLessThan(10);
    });
  });

  describe('bundleStrength', () => {
    it('bundleStrength 0 produces no displacement from edge midpoints', () => {
      const edges: Edge[] = [
        {source: [0, 0], target: [10, 0], key: 'g'},
        {source: [0, 10], target: [10, 10], key: 'g'}
      ];
      const result = computeBundledPaths({...BASE_OPTS, data: edges, bundleStrength: 0, subdivisionCount: 4});
      expect(result[0].path[2][1]).toBeCloseTo(0, 5);
      expect(result[1].path[2][1]).toBeCloseTo(10, 5);
    });

    it('higher bundleStrength causes greater path displacement', () => {
      const edges: Edge[] = [
        {source: [0, 0], target: [10, 0], key: 'g'},
        {source: [0, 10], target: [10, 10], key: 'g'}
      ];
      const low = computeBundledPaths({...BASE_OPTS, data: edges, bundleStrength: 0.2, subdivisionCount: 4});
      const high = computeBundledPaths({...BASE_OPTS, data: edges, bundleStrength: 1, subdivisionCount: 4});
      const lowDisplacement = Math.abs(low[0].path[2][1] - 0);
      const highDisplacement = Math.abs(high[0].path[2][1] - 0);
      expect(highDisplacement).toBeGreaterThan(lowDisplacement);
    });

    it('non-finite bundleStrength is treated as 0 (no bundling)', () => {
      const edges: Edge[] = [
        {source: [0, 0], target: [10, 0], key: 'g'},
        {source: [0, 10], target: [10, 10], key: 'g'}
      ];
      const result = computeBundledPaths({...BASE_OPTS, data: edges, bundleStrength: NaN, subdivisionCount: 4});
      expect(result[0].path[2][1]).toBeCloseTo(0, 5);
      expect(result[1].path[2][1]).toBeCloseTo(10, 5);
    });
  });

  describe('single edge in group (getBundleFactor = 0)', () => {
    it('single edge produces a straight path even with bundleStrength = 1', () => {
      const edges: Edge[] = [{source: [0, 0], target: [10, 0], key: 'solo'}];
      const result = computeBundledPaths({...BASE_OPTS, data: edges, bundleStrength: 1, subdivisionCount: 4});
      expect(result[0].path[2][1]).toBeCloseTo(0, 5);
    });

    it('single edge has straight path for centroid and spine', () => {
      const edges: Edge[] = [{source: [0, 0], target: [10, 0], key: 'solo'}];
      for (const bundlingAlgorithm of ['centroid', 'spine'] as const) {
        const result = computeBundledPaths({...BASE_OPTS, data: edges, bundlingAlgorithm, subdivisionCount: 4});
        expect(result[0].path[2][1]).toBeCloseTo(0, 5);
      }
    });
  });

  describe('independent bundling across groups', () => {
    it('edges in different groups bundle independently without cross-group influence', () => {
      const edges: Edge[] = [
        {source: [0, 0], target: [10, 0], key: 'A'},
        {source: [0, 2], target: [10, 2], key: 'A'},
        {source: [0, 50], target: [10, 50], key: 'B'},
        {source: [0, 52], target: [10, 52], key: 'B'}
      ];
      const result = computeBundledPaths({...BASE_OPTS, data: edges, bundleStrength: 1});
      expect(result[0].path[2][1]).toBeGreaterThan(0);
      expect(result[1].path[2][1]).toBeLessThan(2);
      expect(result[2].path[2][1]).toBeGreaterThan(50);
      expect(result[3].path[2][1]).toBeLessThan(52);
    });

    it('edges with unique keys are not bundled with each other', () => {
      const edges: Edge[] = [
        {source: [0, 0], target: [10, 0], key: 'unique-a'},
        {source: [0, 10], target: [10, 10], key: 'unique-b'}
      ];
      const result = computeBundledPaths({...BASE_OPTS, data: edges, bundleStrength: 1, subdivisionCount: 4});
      expect(result[0].path[2][1]).toBeCloseTo(0, 5);
      expect(result[1].path[2][1]).toBeCloseTo(10, 5);
    });
  });

  describe('weight accessor effects on group center', () => {
    it('higher-weight edge pulls group center toward itself, bending the other edge more', () => {
      const weightedEdges = [
        {source: [0, 0] as [number, number], target: [10, 0] as [number, number], key: 'g', weight: 10},
        {source: [0, 10] as [number, number], target: [10, 10] as [number, number], key: 'g', weight: 1}
      ];
      const unweightedEdges = weightedEdges.map((e) => ({...e, weight: 1}));
      const opts = {
        ...BASE_OPTS,
        getSourcePosition: (e: typeof weightedEdges[0]) => e.source,
        getTargetPosition: (e: typeof weightedEdges[0]) => e.target,
        getBundleKey: (e: typeof weightedEdges[0]) => e.key,
        bundleStrength: 1,
        subdivisionCount: 4
      };
      const weighted = computeBundledPaths({...opts, data: weightedEdges, getWeight: (e) => e.weight});
      const unweighted = computeBundledPaths({...opts, data: unweightedEdges, getWeight: 1});
      const weightedDisplacement = Math.abs(weighted[1].path[2][1] - 10);
      const unweightedDisplacement = Math.abs(unweighted[1].path[2][1] - 10);
      expect(weightedDisplacement).toBeGreaterThan(unweightedDisplacement);
    });

    it('zero weight falls back to weight 1 and does not crash', () => {
      const edges: Edge[] = [
        {source: [0, 0], target: [10, 0], key: 'g'},
        {source: [0, 10], target: [10, 10], key: 'g'}
      ];
      const result = computeBundledPaths({...BASE_OPTS, data: edges, getWeight: 0});
      expect(result).toHaveLength(2);
      expect(result[0].path[2][1]).toBeGreaterThan(0);
      expect(result[1].path[2][1]).toBeLessThan(10);
    });

    it('negative weight is clamped to 0 and treated as weight 1', () => {
      const edges: Edge[] = [
        {source: [0, 0], target: [10, 0], key: 'g'},
        {source: [0, 10], target: [10, 10], key: 'g'}
      ];
      expect(() => computeBundledPaths({...BASE_OPTS, data: edges, getWeight: -5})).not.toThrow();
    });
  });

  describe('subdivisionCount', () => {
    it('higher subdivisionCount produces more path points', () => {
      const edges: Edge[] = [{source: [0, 0], target: [10, 0], key: 'a'}];
      const low = computeBundledPaths({...BASE_OPTS, data: edges, subdivisionCount: 2});
      const high = computeBundledPaths({...BASE_OPTS, data: edges, subdivisionCount: 12});
      expect(high[0].path.length).toBeGreaterThan(low[0].path.length);
    });

    it('subdivisionCount 1 produces at least 2 path points', () => {
      const edges: Edge[] = [{source: [0, 0], target: [10, 0], key: 'a'}];
      const result = computeBundledPaths({...BASE_OPTS, data: edges, subdivisionCount: 1});
      expect(result[0].path.length).toBeGreaterThanOrEqual(2);
    });

    it('path always starts at source and ends at target regardless of subdivisionCount', () => {
      const edges: Edge[] = [
        {source: [3, 7], target: [11, 2], key: 'g'},
        {source: [1, 5], target: [8, 9], key: 'g'}
      ];
      for (const subdivisionCount of [1, 3, 6, 16]) {
        const result = computeBundledPaths({...BASE_OPTS, data: edges, subdivisionCount});
        for (let i = 0; i < result.length; i++) {
          const {path} = result[i];
          expect(path[0][0]).toBeCloseTo(edges[i].source[0], 5);
          expect(path[0][1]).toBeCloseTo(edges[i].source[1], 5);
          expect(path[path.length - 1][0]).toBeCloseTo(edges[i].target[0], 5);
          expect(path[path.length - 1][1]).toBeCloseTo(edges[i].target[1], 5);
        }
      }
    });
  });

  describe('spine algorithm', () => {
    it('path has subdivisionCount + 1 points', () => {
      const edges: Edge[] = [
        {source: [0, 0], target: [10, 0], key: 'g'},
        {source: [0, 5], target: [10, 5], key: 'g'}
      ];
      const result = computeBundledPaths({...BASE_OPTS, data: edges, bundlingAlgorithm: 'spine', subdivisionCount: 4});
      expect(result[0].path).toHaveLength(5);
    });

    it('curves parallel edges toward their shared spine', () => {
      const edges: Edge[] = [
        {source: [0, 0], target: [10, 0], key: 'g'},
        {source: [0, 10], target: [10, 10], key: 'g'},
        {source: [0, 20], target: [10, 20], key: 'g'}
      ];
      const result = computeBundledPaths({...BASE_OPTS, data: edges, bundlingAlgorithm: 'spine', bundleStrength: 1});
      expect(result[0].path[2][1]).toBeGreaterThan(0);
      expect(result[2].path[2][1]).toBeLessThan(20);
    });

    it('endpoints are preserved exactly', () => {
      const edges: Edge[] = [
        {source: [2, 3], target: [8, 7], key: 'g'},
        {source: [1, 5], target: [9, 5], key: 'g'}
      ];
      const result = computeBundledPaths({...BASE_OPTS, data: edges, bundlingAlgorithm: 'spine', subdivisionCount: 6});
      for (let i = 0; i < result.length; i++) {
        const {path} = result[i];
        expect(path[0][0]).toBeCloseTo(edges[i].source[0], 5);
        expect(path[0][1]).toBeCloseTo(edges[i].source[1], 5);
        expect(path[path.length - 1][0]).toBeCloseTo(edges[i].target[0], 5);
        expect(path[path.length - 1][1]).toBeCloseTo(edges[i].target[1], 5);
      }
    });
  });

  describe('force algorithm', () => {
    it('path length is max(4, subdivisionCount + 1)', () => {
      const edges: Edge[] = [
        {source: [0, 0], target: [10, 0], key: 'g'},
        {source: [0, 5], target: [10, 5], key: 'g'}
      ];
      const result2 = computeBundledPaths({...BASE_OPTS, data: edges, bundlingAlgorithm: 'force', subdivisionCount: 2});
      expect(result2[0].path).toHaveLength(4);

      const result6 = computeBundledPaths({...BASE_OPTS, data: edges, bundlingAlgorithm: 'force', subdivisionCount: 6});
      expect(result6[0].path).toHaveLength(7);
    });

    it('endpoints are preserved after force simulation', () => {
      const edges: Edge[] = [
        {source: [0, 0], target: [10, 0], key: 'g'},
        {source: [0, 5], target: [10, 5], key: 'g'}
      ];
      const result = computeBundledPaths({
        ...BASE_OPTS,
        data: edges,
        bundlingAlgorithm: 'force',
        subdivisionCount: 4,
        forceIterations: 4
      });
      for (let i = 0; i < result.length; i++) {
        const {path} = result[i];
        expect(path[0][0]).toBeCloseTo(edges[i].source[0], 4);
        expect(path[0][1]).toBeCloseTo(edges[i].source[1], 4);
        expect(path[path.length - 1][0]).toBeCloseTo(edges[i].target[0], 4);
        expect(path[path.length - 1][1]).toBeCloseTo(edges[i].target[1], 4);
      }
    });

    it('attracts nearby compatible parallel edges toward each other', () => {
      // Visibility compatibility is non-zero only when edges are close relative to their
      // length. y=0 and y=1 for length-10 edges gives high compatibility and measurable attraction.
      const edges: Edge[] = [
        {source: [0, 0], target: [10, 0], key: 'g'},
        {source: [0, 1], target: [10, 1], key: 'g'}
      ];
      const result = computeBundledPaths({...BASE_OPTS, data: edges, bundlingAlgorithm: 'force', forceIterations: 8, subdivisionCount: 4});
      expect(result[0].path[2][1]).toBeGreaterThan(0);
      expect(result[1].path[2][1]).toBeLessThan(1);
    });

    it('produces 2D path points for 2D edges', () => {
      const edges: Edge[] = [
        {source: [0, 0], target: [10, 0], key: 'g'},
        {source: [0, 5], target: [10, 5], key: 'g'}
      ];
      const result = computeBundledPaths({...BASE_OPTS, data: edges, bundlingAlgorithm: 'force', subdivisionCount: 4});
      expect(result[0].path[0]).toHaveLength(2);
    });
  });

  describe('force-gpu algorithm', () => {
    it('returns same number of paths as input edges', () => {
      const edges: Edge[] = [
        {source: [0, 0], target: [10, 0], key: 'a'},
        {source: [0, 5], target: [10, 5], key: 'a'},
        {source: [0, 10], target: [10, 10], key: 'b'}
      ];
      const result = computeBundledPaths({...BASE_OPTS, data: edges, bundlingAlgorithm: 'force-gpu', forceIterations: 2});
      expect(result).toHaveLength(3);
    });

    it('path has correct number of points (same as force)', () => {
      const edges: Edge[] = [
        {source: [0, 0], target: [10, 0], key: 'g'},
        {source: [0, 5], target: [10, 5], key: 'g'}
      ];
      const result = computeBundledPaths({
        ...BASE_OPTS,
        data: edges,
        bundlingAlgorithm: 'force-gpu',
        subdivisionCount: 4,
        forceIterations: 2
      });
      expect(result[0].path).toHaveLength(5);
    });

    it('endpoints are preserved (GPU or CPU fallback)', () => {
      const edges: Edge[] = [
        {source: [0, 0], target: [10, 0], key: 'g'},
        {source: [0, 5], target: [10, 5], key: 'g'}
      ];
      const result = computeBundledPaths({
        ...BASE_OPTS,
        data: edges,
        bundlingAlgorithm: 'force-gpu',
        subdivisionCount: 4,
        forceIterations: 2
      });
      for (let i = 0; i < result.length; i++) {
        const {path} = result[i];
        expect(path[0][0]).toBeCloseTo(edges[i].source[0], 4);
        expect(path[0][1]).toBeCloseTo(edges[i].source[1], 4);
        expect(path[path.length - 1][0]).toBeCloseTo(edges[i].target[0], 4);
        expect(path[path.length - 1][1]).toBeCloseTo(edges[i].target[1], 4);
      }
    });

    it('all path point coordinates are finite numbers', () => {
      const edges: Edge[] = [
        {source: [0, 0], target: [10, 0], key: 'g'},
        {source: [0, 5], target: [10, 5], key: 'g'}
      ];
      const result = computeBundledPaths({...BASE_OPTS, data: edges, bundlingAlgorithm: 'force-gpu', forceIterations: 2});
      for (const {path} of result) {
        for (const point of path) {
          for (const coord of point) {
            expect(Number.isFinite(coord)).toBe(true);
          }
        }
      }
    });
  });
});
