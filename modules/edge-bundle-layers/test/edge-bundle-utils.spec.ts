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
});
