// deck.gl-community
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors
/* eslint-disable max-depth, max-statements, no-continue */

import type {Accessor, Position} from '@deck.gl/core';

export type EdgeBundleKey = string | number;
export type EdgePosition = [number, number] | [number, number, number];
export type EdgeBundlingAlgorithm = 'centroid' | 'spine' | 'force' | 'force-gpu';

export type EdgeBundlePath<DataT> = {
  edge: DataT;
  path: EdgePosition[];
};

type AccessorContext<DataT> = {
  index: number;
  data: DataT[];
};

type EdgeBundleOptions<DataT> = {
  data: Iterable<DataT>;
  getSourcePosition: Accessor<DataT, Position>;
  getTargetPosition: Accessor<DataT, Position>;
  getBundleKey: Accessor<DataT, EdgeBundleKey>;
  getWeight: Accessor<DataT, number>;
  bundleStrength: number;
  subdivisionCount: number;
  bundlingAlgorithm: EdgeBundlingAlgorithm;
  forceIterations: number;
  forceStepSize: number;
};

type EdgeSample<DataT> = {
  edge: DataT;
  index: number;
  source: [number, number, number];
  target: [number, number, number];
  midpoint: [number, number, number];
  direction: [number, number, number];
  length: number;
  bundleKey: EdgeBundleKey;
  hasZ: boolean;
};

type BundleGroup = {
  center: [number, number, number];
  sourceCenter: [number, number, number];
  targetCenter: [number, number, number];
  count: number;
};

type ControlPointOptions = {
  bundlingAlgorithm: EdgeBundlingAlgorithm;
  bundleStrength: number;
};

export function computeBundledPaths<DataT>({
  data,
  getSourcePosition,
  getTargetPosition,
  getBundleKey,
  getWeight,
  bundleStrength,
  subdivisionCount,
  bundlingAlgorithm,
  forceIterations,
  forceStepSize
}: EdgeBundleOptions<DataT>): EdgeBundlePath<DataT>[] {
  const {edgeSamples, bundleGroups, groups} = buildEdgeSamplesAndGroups({
    data,
    getSourcePosition,
    getTargetPosition,
    getBundleKey,
    getWeight
  });

  if (bundlingAlgorithm === 'force') {
    return computeForceDirectedBundledPaths(edgeSamples, {
      subdivisionCount,
      bundleStrength,
      forceIterations,
      forceStepSize
    });
  }
  if (bundlingAlgorithm === 'force-gpu') {
    return computeForceDirectedBundledPathsGpu(edgeSamples, {
      subdivisionCount,
      bundleStrength,
      forceIterations,
      forceStepSize
    });
  }

  const groupByEdgeIndex = buildGroupByIndex(groups, bundleGroups);
  const controlPointsByIndex = getControlPointsByIndex(groups, bundleGroups, {
    bundlingAlgorithm,
    bundleStrength
  });

  return edgeSamples.map((sample) => {
    const group = groupByEdgeIndex[sample.index];
    if (bundlingAlgorithm === 'spine' && group) {
      return {
        edge: sample.edge,
        path: sampleSpineBundlePath(sample, group, subdivisionCount, bundleStrength)
      };
    }
    const controlPoint = controlPointsByIndex[sample.index] || sample.midpoint;
    return {
      edge: sample.edge,
      path: sampleQuadraticBezier(
        sample.source,
        controlPoint,
        sample.target,
        subdivisionCount,
        sample.hasZ
      )
    };
  });
}

function buildGroupByIndex<DataT>(
  groups: Map<EdgeBundleKey, EdgeSample<DataT>[]>,
  bundleGroups: Map<EdgeBundleKey, BundleGroup>
): Array<BundleGroup | undefined> {
  const groupByIndex: Array<BundleGroup | undefined> = [];
  for (const [bundleKey, groupSamples] of groups.entries()) {
    const group = bundleGroups.get(bundleKey);
    if (!group) {
      continue;
    }
    for (const sample of groupSamples) {
      groupByIndex[sample.index] = group;
    }
  }
  return groupByIndex;
}

function buildEdgeSamplesAndGroups<DataT>({
  data,
  getSourcePosition,
  getTargetPosition,
  getBundleKey,
  getWeight
}: Pick<
  EdgeBundleOptions<DataT>,
  'data' | 'getSourcePosition' | 'getTargetPosition' | 'getBundleKey' | 'getWeight'
>): {
  edgeSamples: EdgeSample<DataT>[];
  bundleGroups: Map<EdgeBundleKey, BundleGroup>;
  groups: Map<EdgeBundleKey, EdgeSample<DataT>[]>;
} {
  const edgeData = Array.isArray(data) ? data : Array.from(data);
  const edgeSamples: EdgeSample<DataT>[] = new Array(edgeData.length);
  const groups = new Map<EdgeBundleKey, EdgeSample<DataT>[]>();
  const groupAccumulators = new Map<
    EdgeBundleKey,
    {
      midpointSum: [number, number, number];
      sourceSum: [number, number, number];
      targetSum: [number, number, number];
      weight: number;
      count: number;
    }
  >();

  for (let index = 0; index < edgeData.length; index++) {
    const edge = edgeData[index];
    const sourcePosition = toPosition(evaluateAccessor(getSourcePosition, edge, index, edgeData));
    const targetPosition = toPosition(evaluateAccessor(getTargetPosition, edge, index, edgeData));
    const bundleKey = evaluateAccessor(getBundleKey, edge, index, edgeData);
    const weight = Math.max(0, Number(evaluateAccessor(getWeight, edge, index, edgeData)) || 0);
    const edgeMidpoint: [number, number, number] = [
      (sourcePosition[0] + targetPosition[0]) / 2,
      (sourcePosition[1] + targetPosition[1]) / 2,
      (sourcePosition[2] + targetPosition[2]) / 2
    ];
    const direction: [number, number, number] = [
      targetPosition[0] - sourcePosition[0],
      targetPosition[1] - sourcePosition[1],
      targetPosition[2] - sourcePosition[2]
    ];

    const sample: EdgeSample<DataT> = {
      edge,
      index,
      source: sourcePosition,
      target: targetPosition,
      midpoint: edgeMidpoint,
      direction,
      length: Math.sqrt(dot(direction, direction)),
      bundleKey,
      hasZ: hasZCoordinate(sourcePosition, targetPosition)
    };
    edgeSamples[index] = sample;
    appendToGroup(groups, bundleKey, sample);

    const weightedMidpoint = weight > 0 ? weight : 1;
    const currentGroup = groupAccumulators.get(bundleKey) || {
      midpointSum: [0, 0, 0] as [number, number, number],
      sourceSum: [0, 0, 0] as [number, number, number],
      targetSum: [0, 0, 0] as [number, number, number],
      weight: 0,
      count: 0
    };
    addWeightedVector(currentGroup.midpointSum, edgeMidpoint, weightedMidpoint);
    addWeightedVector(currentGroup.sourceSum, sourcePosition, weightedMidpoint);
    addWeightedVector(currentGroup.targetSum, targetPosition, weightedMidpoint);
    currentGroup.weight += weightedMidpoint;
    currentGroup.count += 1;
    groupAccumulators.set(bundleKey, currentGroup);
  }

  const bundleGroups = new Map<EdgeBundleKey, BundleGroup>();
  for (const [bundleKey, group] of groupAccumulators.entries()) {
    const invWeight = group.weight > 0 ? 1 / group.weight : 1;
    bundleGroups.set(bundleKey, {
      center: scaleVector(group.midpointSum, invWeight),
      sourceCenter: scaleVector(group.sourceSum, invWeight),
      targetCenter: scaleVector(group.targetSum, invWeight),
      count: group.count
    });
  }

  return {edgeSamples, bundleGroups, groups};
}

function getControlPointsByIndex<DataT>(
  groups: Map<EdgeBundleKey, EdgeSample<DataT>[]>,
  bundleGroups: Map<EdgeBundleKey, BundleGroup>,
  options: ControlPointOptions
): Array<[number, number, number] | undefined> {
  const controlPoints: Array<[number, number, number] | undefined> = [];
  for (const [bundleKey, groupSamples] of groups.entries()) {
    const group = bundleGroups.get(bundleKey);
    if (!group) {
      continue;
    }
    for (const sample of groupSamples) {
      controlPoints[sample.index] = getStaticControlPoint(sample, group, options);
    }
  }
  return controlPoints;
}

function getStaticControlPoint<DataT>(
  sample: EdgeSample<DataT>,
  group: BundleGroup,
  options: Pick<ControlPointOptions, 'bundlingAlgorithm' | 'bundleStrength'>
): [number, number, number] {
  const bundleFactor = clamp01(options.bundleStrength) * getBundleFactor(group.count);
  if (bundleFactor <= 0) {
    return sample.midpoint;
  }
  if (options.bundlingAlgorithm === 'spine') {
    const spinePoint = projectPointToLine(sample.midpoint, group.sourceCenter, group.targetCenter);
    return lerpVector(sample.midpoint, spinePoint, bundleFactor);
  }
  return lerpVector(sample.midpoint, group.center, bundleFactor);
}

function sampleSpineBundlePath<DataT>(
  sample: EdgeSample<DataT>,
  group: BundleGroup,
  subdivisionCount: number,
  bundleStrength: number
): EdgePosition[] {
  const segments = Math.max(2, Math.round(subdivisionCount));
  const bundleFactor = clamp01(bundleStrength) * getBundleFactor(group.count);
  if (bundleFactor <= 0) {
    return sampleQuadraticBezier(sample.source, sample.midpoint, sample.target, segments, sample.hasZ);
  }

  const sourceJoin = lerpVector(sample.source, group.sourceCenter, Math.min(1, bundleFactor * 0.94));
  const targetJoin = lerpVector(sample.target, group.targetCenter, Math.min(1, bundleFactor * 0.94));
  const centerJoin = lerpVector(sample.midpoint, group.center, bundleFactor);
  const sourceControl = lerpVector(midpoint(sample.source, sourceJoin), centerJoin, bundleFactor * 0.62);
  const targetControl = lerpVector(midpoint(sample.target, targetJoin), centerJoin, bundleFactor * 0.62);

  return sampleTwoQuadraticBeziers(
    {
      source: sample.source,
      sourceControl,
      center: centerJoin,
      targetControl,
      target: sample.target
    },
    segments,
    sample.hasZ
  );
}

function computeForceDirectedBundledPaths<DataT>(
  edgeSamples: EdgeSample<DataT>[],
  options: {subdivisionCount: number; bundleStrength: number; forceIterations: number; forceStepSize: number}
): EdgeBundlePath<DataT>[] {
  const pointCount = Math.max(4, Math.round(options.subdivisionCount) + 1);
  let edgePoints = edgeSamples.map((sample) => createLinearPoints(sample.source, sample.target, pointCount));
  const compatibility = buildCompatibilityMatrix(edgeSamples, clamp01(options.bundleStrength));
  const totalIterations = Math.max(8, Math.round(options.forceIterations) * 8);
  let step = Math.max(0.00025, options.forceStepSize * 0.14);

  for (let iteration = 0; iteration < totalIterations; iteration++) {
    const nextPoints = edgePoints.map((points) => points.map((point) => [...point] as [number, number, number]));
    for (let edgeIndex = 0; edgeIndex < edgeSamples.length; edgeIndex++) {
      const sample = edgeSamples[edgeIndex];
      const kP = (0.12 + options.bundleStrength * 0.5) / Math.max(1e-4, sample.length * (pointCount - 1));
      for (let pointIndex = 1; pointIndex < pointCount - 1; pointIndex++) {
        const currentPoint = edgePoints[edgeIndex][pointIndex];
        const springForce = addVectors(
          scaleVector(subtractVectors(edgePoints[edgeIndex][pointIndex - 1], currentPoint), kP),
          scaleVector(subtractVectors(edgePoints[edgeIndex][pointIndex + 1], currentPoint), kP)
        );
        let electroForce: [number, number, number] = [0, 0, 0];
        for (let otherEdgeIndex = 0; otherEdgeIndex < edgeSamples.length; otherEdgeIndex++) {
          if (otherEdgeIndex === edgeIndex) {
            continue;
          }
          const compat = compatibility[edgeIndex][otherEdgeIndex];
          if (compat <= 0.06) {
            continue;
          }
          const otherPoint = edgePoints[otherEdgeIndex][pointIndex];
          const toOther = subtractVectors(otherPoint, currentPoint);
          const dist = Math.max(1e-4, vectorLength(toOther));
          const attraction = Math.min(1.85, compat / (dist * dist));
          electroForce = addVectors(electroForce, scaleVector(toOther, attraction));
        }
        const force = addVectors(springForce, electroForce);
        nextPoints[edgeIndex][pointIndex] = addVectors(currentPoint, scaleVector(force, step));
      }
    }
    edgePoints = smoothPoints(smoothPoints(nextPoints));
    step *= 0.985;
  }

  return edgeSamples.map((sample, index) => ({
    edge: sample.edge,
    path: edgePoints[index].map((point) => toEdgePosition(point, sample.hasZ))
  }));
}

function computeForceDirectedBundledPathsGpu<DataT>(
  edgeSamples: EdgeSample<DataT>[],
  options: {subdivisionCount: number; bundleStrength: number; forceIterations: number; forceStepSize: number}
): EdgeBundlePath<DataT>[] {
  const fallback = () => computeForceDirectedBundledPaths(edgeSamples, options);
  const pointCount = Math.max(4, Math.round(options.subdivisionCount) + 1);
  const compatibility = buildCompatibilityMatrix(edgeSamples, clamp01(options.bundleStrength));
  const totalIterations = Math.max(8, Math.round(options.forceIterations) * 8);
  const simulated = runForceSimulationOnGpu(edgeSamples, compatibility, {
    pointCount,
    totalIterations,
    step: Math.max(0.00025, options.forceStepSize * 0.14),
    springKScale: 0.12 + options.bundleStrength * 0.5
  });
  if (!simulated) {
    return fallback();
  }

  return edgeSamples.map((sample, edgeIndex) => {
    const path: EdgePosition[] = new Array(pointCount);
    for (let pointIndex = 0; pointIndex < pointCount; pointIndex++) {
      const offset = (pointIndex * edgeSamples.length + edgeIndex) * 4;
      const point: [number, number, number] = [simulated[offset + 0], simulated[offset + 1], simulated[offset + 2]];
      path[pointIndex] = toEdgePosition(point, sample.hasZ);
    }
    return {edge: sample.edge, path};
  });
}

function runForceSimulationOnGpu<DataT>(
  edgeSamples: EdgeSample<DataT>[],
  compatibility: number[][],
  options: {pointCount: number; totalIterations: number; step: number; springKScale: number}
): Float32Array | null {
  const edgeCount = edgeSamples.length;
  const gl = createGpuContext(edgeCount, options.pointCount);
  if (!gl) {
    return null;
  }
  const neighborCount = Math.min(48, Math.max(12, Math.round(Math.sqrt(edgeCount))));
  const neighborData = createNeighborTextureData(compatibility, edgeCount, neighborCount);

  const forceProgram = createProgram(
    gl,
    FULLSCREEN_VERT,
    createForceFragmentShader(64),
    'force-gpu-force-program'
  );
  const smoothProgram = createProgram(gl, FULLSCREEN_VERT, SMOOTH_FRAGMENT, 'force-gpu-smooth-program');
  if (!forceProgram || !smoothProgram) {
    return null;
  }

  const positionsData = createInitialPositionTextureData(edgeSamples, options.pointCount);
  const textures = createSimulationTextures(gl, {
    edgeCount,
    pointCount: options.pointCount,
    positionsData,
    neighborData,
    neighborCount
  });
  if (!textures) {
    return null;
  }

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  let readTex = textures.posA;
  let forceOutTex = textures.posB;
  let smoothOutTex = textures.posC;
  let step = options.step;
  const springK = options.springKScale / Math.max(1e-4, options.pointCount - 1);

  gl.viewport(0, 0, edgeCount, options.pointCount);
  for (let iteration = 0; iteration < options.totalIterations; iteration++) {
    runForcePass(gl, {
      program: forceProgram,
      posTexture: readTex,
      neighborTexture: textures.neighbors,
      outFramebuffer: forceOutTex.fbo,
      edgeCount,
      pointCount: options.pointCount,
      neighborCount,
      step,
      springK,
      compatThreshold: 0.06
    });
    runSmoothPass(gl, smoothProgram, forceOutTex, smoothOutTex.fbo, {
      edgeCount,
      pointCount: options.pointCount
    });
    const nextRead = smoothOutTex;
    const nextForceOut = readTex;
    const nextSmoothOut = forceOutTex;
    readTex = nextRead;
    forceOutTex = nextForceOut;
    smoothOutTex = nextSmoothOut;
    step *= 0.985;
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, readTex.fbo);
  const out = new Float32Array(edgeCount * options.pointCount * 4);
  gl.readPixels(0, 0, edgeCount, options.pointCount, gl.RGBA, gl.FLOAT, out);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindVertexArray(null);

  cleanupSimulationResources(gl, forceProgram, smoothProgram, textures, vao);
  return out;
}

function createGpuContext(edgeCount: number, pointCount: number): WebGL2RenderingContext | null {
  if (edgeCount === 0 || typeof document === 'undefined') {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = edgeCount;
  canvas.height = pointCount;
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    depth: false,
    stencil: false,
    alpha: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance'
  });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) {
    return null;
  }
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  if (edgeCount > maxTextureSize || pointCount > maxTextureSize) {
    return null;
  }
  return gl;
}

function runForcePass(
  gl: WebGL2RenderingContext,
  params: {
    program: WebGLProgram;
    posTexture: SimulationTexture;
    neighborTexture: SimulationTexture;
    outFramebuffer: WebGLFramebuffer;
    edgeCount: number;
    pointCount: number;
    neighborCount: number;
    step: number;
    springK: number;
    compatThreshold: number;
  }
): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, params.outFramebuffer);
  gl.useProgram(params.program);
  bindTexture(gl, params.posTexture.texture, 0);
  bindTexture(gl, params.neighborTexture.texture, 1);
  setUniform1i(gl, params.program, 'uPositions', 0);
  setUniform1i(gl, params.program, 'uNeighbors', 1);
  setUniform1i(gl, params.program, 'uEdgeCount', params.edgeCount);
  setUniform1i(gl, params.program, 'uPointCount', params.pointCount);
  setUniform1i(gl, params.program, 'uNeighborCount', params.neighborCount);
  setUniform1f(gl, params.program, 'uStep', params.step);
  setUniform1f(gl, params.program, 'uSpringK', params.springK);
  setUniform1f(gl, params.program, 'uCompatThreshold', params.compatThreshold);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function runSmoothPass(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  posTexture: SimulationTexture,
  outFramebuffer: WebGLFramebuffer,
  uniforms: {edgeCount: number; pointCount: number}
): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, outFramebuffer);
  gl.useProgram(program);
  bindTexture(gl, posTexture.texture, 0);
  setUniform1i(gl, program, 'uPositions', 0);
  setUniform1i(gl, program, 'uEdgeCount', uniforms.edgeCount);
  setUniform1i(gl, program, 'uPointCount', uniforms.pointCount);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

type SimulationTexture = {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
};

type SimulationTextures = {
  posA: SimulationTexture;
  posB: SimulationTexture;
  posC: SimulationTexture;
  neighbors: SimulationTexture;
};

function createSimulationTextures(
  gl: WebGL2RenderingContext,
  options: {
    edgeCount: number;
    pointCount: number;
    positionsData: Float32Array;
    neighborData: Float32Array;
    neighborCount: number;
  }
): SimulationTextures | null {
  const posA = createTextureWithFramebuffer(gl, options.edgeCount, options.pointCount, options.positionsData);
  const posB = createTextureWithFramebuffer(gl, options.edgeCount, options.pointCount, null);
  const posC = createTextureWithFramebuffer(gl, options.edgeCount, options.pointCount, null);
  const neighbors = createTextureWithFramebuffer(gl, options.edgeCount, options.neighborCount, options.neighborData);
  if (!posA || !posB || !posC || !neighbors) {
    return null;
  }
  return {posA, posB, posC, neighbors};
}

function createTextureWithFramebuffer(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  data: Float32Array | null
): SimulationTexture | null {
  const texture = gl.createTexture();
  const fbo = gl.createFramebuffer();
  if (!texture || !fbo) {
    return null;
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);

  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return null;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return {texture, fbo};
}

function bindTexture(gl: WebGL2RenderingContext, texture: WebGLTexture, unit: number): void {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
}

function setUniform1i(gl: WebGL2RenderingContext, program: WebGLProgram, name: string, value: number): void {
  const loc = gl.getUniformLocation(program, name);
  if (loc !== null) {
    gl.uniform1i(loc, value);
  }
}

function setUniform1f(gl: WebGL2RenderingContext, program: WebGLProgram, name: string, value: number): void {
  const loc = gl.getUniformLocation(program, name);
  if (loc !== null) {
    gl.uniform1f(loc, value);
  }
}

function createInitialPositionTextureData<DataT>(edgeSamples: EdgeSample<DataT>[], pointCount: number): Float32Array {
  const edgeCount = edgeSamples.length;
  const data = new Float32Array(edgeCount * pointCount * 4);
  for (let pointIndex = 0; pointIndex < pointCount; pointIndex++) {
    const t = pointCount <= 1 ? 0 : pointIndex / (pointCount - 1);
    for (let edgeIndex = 0; edgeIndex < edgeCount; edgeIndex++) {
      const sample = edgeSamples[edgeIndex];
      const point = [
        lerp(sample.source[0], sample.target[0], t),
        lerp(sample.source[1], sample.target[1], t),
        lerp(sample.source[2], sample.target[2], t)
      ];
      const offset = (pointIndex * edgeCount + edgeIndex) * 4;
      data[offset + 0] = point[0];
      data[offset + 1] = point[1];
      data[offset + 2] = point[2];
      data[offset + 3] = 1;
    }
  }
  return data;
}

function createNeighborTextureData(matrix: number[][], edgeCount: number, neighborCount: number): Float32Array {
  const data = new Float32Array(edgeCount * neighborCount * 4);
  for (let edgeIndex = 0; edgeIndex < edgeCount; edgeIndex++) {
    const neighbors: Array<{index: number; compat: number}> = [];
    for (let otherIndex = 0; otherIndex < edgeCount; otherIndex++) {
      if (otherIndex === edgeIndex) {
        continue;
      }
      const compat = matrix[edgeIndex][otherIndex];
      if (compat <= 0.03) {
        continue;
      }
      neighbors.push({index: otherIndex, compat});
    }
    neighbors.sort((a, b) => b.compat - a.compat);
    for (let n = 0; n < neighborCount; n++) {
      const row = neighbors[n];
      const offset = (n * edgeCount + edgeIndex) * 4;
      if (row) {
        data[offset + 0] = row.index;
        data[offset + 1] = row.compat;
      } else {
        data[offset + 0] = -1;
        data[offset + 1] = 0;
      }
      data[offset + 2] = 0;
      data[offset + 3] = 1;
    }
  }
  return data;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
  label: string
): WebGLProgram | null {
  const vert = gl.createShader(gl.VERTEX_SHADER);
  const frag = gl.createShader(gl.FRAGMENT_SHADER);
  if (!vert || !frag) {
    return null;
  }
  gl.shaderSource(vert, vertexSource);
  gl.shaderSource(frag, fragmentSource);
  gl.compileShader(vert);
  gl.compileShader(frag);
  if (!gl.getShaderParameter(vert, gl.COMPILE_STATUS) || !gl.getShaderParameter(frag, gl.COMPILE_STATUS)) {
    return null;
  }
  const program = gl.createProgram();
  if (!program) {
    return null;
  }
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return null;
  }
  gl.objectLabel?.(gl.PROGRAM, program, `${label}`);
  return program;
}

function cleanupSimulationResources(
  gl: WebGL2RenderingContext,
  forceProgram: WebGLProgram,
  smoothProgram: WebGLProgram,
  textures: SimulationTextures,
  vao: WebGLVertexArrayObject | null
): void {
  gl.deleteProgram(forceProgram);
  gl.deleteProgram(smoothProgram);
  gl.deleteTexture(textures.posA.texture);
  gl.deleteTexture(textures.posB.texture);
  gl.deleteTexture(textures.posC.texture);
  gl.deleteTexture(textures.neighbors.texture);
  gl.deleteFramebuffer(textures.posA.fbo);
  gl.deleteFramebuffer(textures.posB.fbo);
  gl.deleteFramebuffer(textures.posC.fbo);
  gl.deleteFramebuffer(textures.neighbors.fbo);
  if (vao) {
    gl.deleteVertexArray(vao);
  }
}

const FULLSCREEN_VERT = `#version 300 es
precision highp float;
void main() {
  vec2 pos;
  if (gl_VertexID == 0) {
    pos = vec2(-1.0, -1.0);
  } else if (gl_VertexID == 1) {
    pos = vec2(3.0, -1.0);
  } else {
    pos = vec2(-1.0, 3.0);
  }
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

function createForceFragmentShader(maxNeighbors: number): string {
  return `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D uPositions;
uniform sampler2D uNeighbors;
uniform int uEdgeCount;
uniform int uPointCount;
uniform int uNeighborCount;
uniform float uStep;
uniform float uSpringK;
uniform float uCompatThreshold;

out vec4 fragColor;

void main() {
  ivec2 coord = ivec2(gl_FragCoord.xy);
  int edgeIndex = coord.x;
  int pointIndex = coord.y;
  vec3 currentPoint = texelFetch(uPositions, coord, 0).xyz;
  if (pointIndex <= 0 || pointIndex >= uPointCount - 1) {
    fragColor = vec4(currentPoint, 1.0);
    return;
  }

  vec3 prevPoint = texelFetch(uPositions, ivec2(edgeIndex, pointIndex - 1), 0).xyz;
  vec3 nextPoint = texelFetch(uPositions, ivec2(edgeIndex, pointIndex + 1), 0).xyz;
  vec3 springForce = ((prevPoint - currentPoint) + (nextPoint - currentPoint)) * uSpringK;

  vec3 electroForce = vec3(0.0);
  for (int j = 0; j < ${maxNeighbors}; j++) {
    if (j >= uNeighborCount) {
      break;
    }
    vec2 neighbor = texelFetch(uNeighbors, ivec2(edgeIndex, j), 0).xy;
    int otherIndex = int(neighbor.x + 0.5);
    float compat = neighbor.y;
    if (otherIndex < 0 || otherIndex >= uEdgeCount || compat <= uCompatThreshold) {
      continue;
    }
    vec3 otherPoint = texelFetch(uPositions, ivec2(otherIndex, pointIndex), 0).xyz;
    vec3 toOther = otherPoint - currentPoint;
    float dist = max(0.0001, length(toOther));
    float attraction = min(1.85, compat / (dist * dist));
    electroForce += toOther * attraction;
  }

  vec3 force = springForce + electroForce;
  fragColor = vec4(currentPoint + force * uStep, 1.0);
}
`;
}

const SMOOTH_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D uPositions;
uniform int uEdgeCount;
uniform int uPointCount;

out vec4 fragColor;

void main() {
  ivec2 coord = ivec2(gl_FragCoord.xy);
  int edgeIndex = coord.x;
  int pointIndex = coord.y;
  vec3 currentPoint = texelFetch(uPositions, coord, 0).xyz;
  if (pointIndex <= 0 || pointIndex >= uPointCount - 1) {
    fragColor = vec4(currentPoint, 1.0);
    return;
  }
  vec3 prevPoint = texelFetch(uPositions, ivec2(edgeIndex, pointIndex - 1), 0).xyz;
  vec3 nextPoint = texelFetch(uPositions, ivec2(edgeIndex, pointIndex + 1), 0).xyz;
  vec3 smoothed = prevPoint * 0.25 + currentPoint * 0.5 + nextPoint * 0.25;
  fragColor = vec4(smoothed, 1.0);
}
`;

function buildCompatibilityMatrix<DataT>(
  edgeSamples: EdgeSample<DataT>[],
  bundleStrength: number
): number[][] {
  const count = edgeSamples.length;
  const matrix = Array.from({length: count}, () => new Array(count).fill(0));
  for (let i = 0; i < count; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < count; j++) {
      const compatibility = getTotalCompatibility(edgeSamples[i], edgeSamples[j], bundleStrength);
      matrix[i][j] = compatibility;
      matrix[j][i] = compatibility;
    }
  }
  return matrix;
}

function getTotalCompatibility<DataT>(
  edgeA: EdgeSample<DataT>,
  edgeB: EdgeSample<DataT>,
  bundleStrength: number
): number {
  const angleCompatibility =
    Math.abs(dot(edgeA.direction, edgeB.direction)) / Math.max(1e-4, edgeA.length * edgeB.length);
  const avgLength = (edgeA.length + edgeB.length) / 2;
  const minLength = Math.min(edgeA.length, edgeB.length);
  const maxLength = Math.max(edgeA.length, edgeB.length);
  const scaleCompatibility = (2 * minLength) / Math.max(1e-4, avgLength + maxLength / Math.max(1e-4, avgLength));
  const positionCompatibility = avgLength / (avgLength + distance(edgeA.midpoint, edgeB.midpoint));
  const visibilityCompatibility = Math.min(
    getVisibilityCompatibility(edgeA.source, edgeA.target, edgeB.midpoint),
    getVisibilityCompatibility(edgeB.source, edgeB.target, edgeA.midpoint)
  );
  const geometricCompatibility =
    angleCompatibility * scaleCompatibility * positionCompatibility * visibilityCompatibility;
  const bundleAffinity = edgeA.bundleKey === edgeB.bundleKey ? 1.35 : 0.32;
  const strength = Math.max(0.05, Math.pow(bundleStrength, 0.8));
  return clamp01(geometricCompatibility * strength * bundleAffinity);
}

function getVisibilityCompatibility(
  lineStart: [number, number, number],
  lineEnd: [number, number, number],
  otherMidpoint: [number, number, number]
): number {
  const projectedStart = projectPointToLine(lineStart, lineStart, lineEnd);
  const projectedEnd = projectPointToLine(lineEnd, lineStart, lineEnd);
  const projectedMidpoint = midpoint(projectedStart, projectedEnd);
  const denominator = Math.max(1e-4, distance(projectedStart, projectedEnd));
  return Math.max(0, 1 - (2 * distance(otherMidpoint, projectedMidpoint)) / denominator);
}

function projectPointToLine(
  point: [number, number, number],
  lineStart: [number, number, number],
  lineEnd: [number, number, number]
): [number, number, number] {
  const line = [lineEnd[0] - lineStart[0], lineEnd[1] - lineStart[1], lineEnd[2] - lineStart[2]];
  const lengthSquared = dot(line, line);
  if (lengthSquared <= 1e-9) {
    return lineStart;
  }
  const toPoint = [point[0] - lineStart[0], point[1] - lineStart[1], point[2] - lineStart[2]];
  const t = dot(toPoint, line) / lengthSquared;
  return [lineStart[0] + line[0] * t, lineStart[1] + line[1] * t, lineStart[2] + line[2] * t];
}

function createLinearPoints(
  source: [number, number, number],
  target: [number, number, number],
  pointCount: number
): [number, number, number][] {
  return Array.from({length: pointCount}, (_, pointIndex) => {
    const t = pointIndex / (pointCount - 1);
    return [lerp(source[0], target[0], t), lerp(source[1], target[1], t), lerp(source[2], target[2], t)];
  });
}

function smoothPoints(pointsByEdge: [number, number, number][][]): [number, number, number][][] {
  return pointsByEdge.map((points) => {
    const smoothed = points.map((point) => [...point] as [number, number, number]);
    for (let pointIndex = 1; pointIndex < points.length - 1; pointIndex++) {
      smoothed[pointIndex] = [
        points[pointIndex - 1][0] * 0.25 + points[pointIndex][0] * 0.5 + points[pointIndex + 1][0] * 0.25,
        points[pointIndex - 1][1] * 0.25 + points[pointIndex][1] * 0.5 + points[pointIndex + 1][1] * 0.25,
        points[pointIndex - 1][2] * 0.25 + points[pointIndex][2] * 0.5 + points[pointIndex + 1][2] * 0.25
      ];
    }
    smoothed[0] = points[0];
    smoothed[points.length - 1] = points[points.length - 1];
    return smoothed;
  });
}

function evaluateAccessor<DataT, TValue>(
  accessor: Accessor<DataT, TValue>,
  datum: DataT,
  index: number,
  data: DataT[]
): TValue {
  if (typeof accessor === 'function') {
    return accessor(datum, {index, data} as AccessorContext<DataT>);
  }
  return accessor;
}

function sampleQuadraticBezier(
  source: [number, number, number],
  control: [number, number, number],
  target: [number, number, number],
  subdivisionCount: number,
  hasZ: boolean
): EdgePosition[] {
  const segments = Math.max(1, Math.round(subdivisionCount));
  const path: EdgePosition[] = new Array(segments + 1);

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const k0 = (1 - t) * (1 - t);
    const k1 = 2 * (1 - t) * t;
    const k2 = t * t;
    path[i] = toEdgePosition(
      [
        source[0] * k0 + control[0] * k1 + target[0] * k2,
        source[1] * k0 + control[1] * k1 + target[1] * k2,
        source[2] * k0 + control[2] * k1 + target[2] * k2
      ],
      hasZ
    );
  }

  return path;
}

function sampleTwoQuadraticBeziers(
  points: {
    source: [number, number, number];
    sourceControl: [number, number, number];
    center: [number, number, number];
    targetControl: [number, number, number];
    target: [number, number, number];
  },
  subdivisionCount: number,
  hasZ: boolean
): EdgePosition[] {
  const segments = Math.max(2, Math.round(subdivisionCount));
  const firstSegments = Math.max(1, Math.floor(segments / 2));
  const secondSegments = Math.max(1, segments - firstSegments);
  const first = sampleQuadraticBezier(points.source, points.sourceControl, points.center, firstSegments, hasZ);
  const second = sampleQuadraticBezier(points.center, points.targetControl, points.target, secondSegments, hasZ);
  return [...first, ...second.slice(1)];
}

function appendToGroup<DataT>(
  groups: Map<EdgeBundleKey, EdgeSample<DataT>[]>,
  bundleKey: EdgeBundleKey,
  sample: EdgeSample<DataT>
): void {
  const groupSamples = groups.get(bundleKey) || [];
  groupSamples.push(sample);
  groups.set(bundleKey, groupSamples);
}

function addWeightedVector(
  sum: [number, number, number],
  vector: [number, number, number],
  weight: number
): void {
  sum[0] += vector[0] * weight;
  sum[1] += vector[1] * weight;
  sum[2] += vector[2] * weight;
}

function toPosition(position: Position): [number, number, number] {
  const x = Number(position?.[0] || 0);
  const y = Number(position?.[1] || 0);
  const z = Number(position?.[2] || 0);
  return [x, y, z];
}

function toEdgePosition(position: [number, number, number], hasZ: boolean): EdgePosition {
  return hasZ ? [position[0], position[1], position[2]] : [position[0], position[1]];
}

function hasZCoordinate(source: [number, number, number], target: [number, number, number]): boolean {
  return source[2] !== 0 || target[2] !== 0;
}

function getBundleFactor(groupCount: number): number {
  if (groupCount <= 1) {
    return 0;
  }
  return Math.min(1, (groupCount - 1) / 4);
}

function scaleVector(vector: [number, number, number], scalar: number): [number, number, number] {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

function lerpVector(
  from: [number, number, number],
  to: [number, number, number],
  t: number
): [number, number, number] {
  return [lerp(from[0], to[0], t), lerp(from[1], to[1], t), lerp(from[2], to[2], t)];
}

function addVectors(
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtractVectors(
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vectorLength(v: [number, number, number]): number {
  return Math.sqrt(dot(v, v));
}

function distance(a: [number, number, number], b: [number, number, number]): number {
  return vectorLength(subtractVectors(a, b));
}

function midpoint(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

function dot(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}
