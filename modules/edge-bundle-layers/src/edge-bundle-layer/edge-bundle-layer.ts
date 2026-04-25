// deck.gl-community
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

import {
  CompositeLayer,
  type Accessor,
  type Color,
  type DefaultProps,
  type LayerProps,
  type Position,
  type UpdateParameters
} from '@deck.gl/core';
import {ArcLayer, PathLayer, type PathLayerProps} from '@deck.gl/layers';
import {
  computeBundledPaths,
  type EdgeBundleKey,
  type EdgeBundlingAlgorithm,
  type EdgeBundlePath,
  type EdgePosition
} from './edge-bundle-utils';

export type EdgeBundleRenderMode = 'path' | 'arc';

type AccessorContext = {
  index: number;
};

type _EdgeBundleLayerProps<DataT> = {
  getSourcePosition?: Accessor<DataT, Position>;
  getTargetPosition?: Accessor<DataT, Position>;
  getBundleKey?: Accessor<DataT, EdgeBundleKey>;
  getWeight?: Accessor<DataT, number>;
  bundleStrength?: number;
  subdivisionCount?: number;
  bundlingAlgorithm?: EdgeBundlingAlgorithm;
  forceIterations?: number;
  forceStepSize?: number;
  renderMode?: EdgeBundleRenderMode;
};

export type EdgeBundleLayerProps<DataT = unknown> = _EdgeBundleLayerProps<DataT> &
  Omit<PathLayerProps<DataT>, 'getPath'>;

const defaultProps: DefaultProps<EdgeBundleLayerProps> = {
  getSourcePosition: {
    type: 'accessor',
    value: (d: any) => d.sourcePosition
  },
  getTargetPosition: {
    type: 'accessor',
    value: (d: any) => d.targetPosition
  },
  getBundleKey: {
    type: 'accessor',
    value: (_d: any, {index}: AccessorContext) => index
  },
  getWeight: {
    type: 'accessor',
    value: 1
  },
  bundleStrength: {
    type: 'number',
    min: 0,
    max: 1,
    value: 0.85
  },
  subdivisionCount: {
    type: 'number',
    min: 1,
    value: 16
  },
  bundlingAlgorithm: {
    type: 'string',
    value: 'centroid'
  },
  forceIterations: {
    type: 'number',
    min: 1,
    value: 8
  },
  forceStepSize: {
    type: 'number',
    min: 0.001,
    value: 0.15
  },
  renderMode: {
    type: 'string',
    value: 'path'
  }
};

type EdgeBundleLayerState<DataT> = {
  edgeData: DataT[];
  bundledPaths: EdgeBundlePath<DataT>['path'][];
  pathVersion: number;
};

export class EdgeBundleLayer<DataT = unknown> extends CompositeLayer<
  Required<_EdgeBundleLayerProps<DataT>> & EdgeBundleLayerProps<DataT>
> {
  static override layerName = 'EdgeBundleLayer';
  static override defaultProps = defaultProps;

  override state!: EdgeBundleLayerState<DataT>;

  override initializeState(): void {
    this.setState({
      edgeData: [],
      bundledPaths: [],
      pathVersion: 0
    });
  }

  override updateState(params: UpdateParameters<this>): void {
    const {changeFlags, oldProps, props} = params;
    const accessorChanged =
      props.getSourcePosition !== oldProps.getSourcePosition ||
      props.getTargetPosition !== oldProps.getTargetPosition ||
      props.getBundleKey !== oldProps.getBundleKey ||
      props.getWeight !== oldProps.getWeight ||
      props.bundleStrength !== oldProps.bundleStrength ||
      props.subdivisionCount !== oldProps.subdivisionCount ||
      props.bundlingAlgorithm !== oldProps.bundlingAlgorithm ||
      props.forceIterations !== oldProps.forceIterations ||
      props.forceStepSize !== oldProps.forceStepSize;

    if (!changeFlags.dataChanged && !accessorChanged) {
      return;
    }

    const edgePaths = computeBundledPaths({
      data: toIterable(props.data),
      getSourcePosition: props.getSourcePosition,
      getTargetPosition: props.getTargetPosition,
      getBundleKey: props.getBundleKey,
      getWeight: props.getWeight,
      bundleStrength: props.bundleStrength,
      subdivisionCount: props.subdivisionCount,
      bundlingAlgorithm: props.bundlingAlgorithm,
      forceIterations: props.forceIterations,
      forceStepSize: props.forceStepSize
    });

    this.setState({
      edgeData: edgePaths.map((edgePath) => edgePath.edge),
      bundledPaths: edgePaths.map((edgePath) => edgePath.path),
      pathVersion: this.state.pathVersion + 1
    });
  }

  override renderLayers() {
    const {updateTriggers, renderMode} = this.props;
    const sharedProps = {...this.props};
    delete sharedProps.getSourcePosition;
    delete sharedProps.getTargetPosition;
    delete sharedProps.getBundleKey;
    delete sharedProps.getWeight;
    delete sharedProps.bundleStrength;
    delete sharedProps.subdivisionCount;
    delete sharedProps.bundlingAlgorithm;
    delete sharedProps.forceIterations;
    delete sharedProps.forceStepSize;
    delete sharedProps.renderMode;
    delete sharedProps.updateTriggers;

    if (renderMode === 'arc') {
      const {edgeData, bundledPaths, pathVersion} = this.state;
      return new ArcLayer<DataT>(
        this.getSubLayerProps({
          id: 'bundled-arcs',
          data: edgeData,
          getSourcePosition: (_, {index}) => {
            const path = bundledPaths[index];
            return path ? path[0] : [0, 0];
          },
          getTargetPosition: (_, {index}) => {
            const path = bundledPaths[index];
            return path ? path[path.length - 1] : [0, 0];
          },
          getSourceColor: sharedProps.getColor as Accessor<DataT, Color> | undefined,
          getTargetColor: sharedProps.getColor as Accessor<DataT, Color> | undefined,
          getWidth: sharedProps.getWidth,
          widthUnits: sharedProps.widthUnits,
          widthMinPixels: sharedProps.widthMinPixels,
          widthMaxPixels: sharedProps.widthMaxPixels,
          getHeight: (_, {index}) => arcHeight(bundledPaths[index]),
          getTilt: (_, {index}) => arcTilt(bundledPaths[index]),
          updateTriggers: {
            ...updateTriggers,
            getSourcePosition: pathVersion,
            getTargetPosition: pathVersion,
            getHeight: pathVersion,
            getTilt: pathVersion,
            getSourceColor: updateTriggers?.getColor,
            getTargetColor: updateTriggers?.getColor,
            getWidth: updateTriggers?.getWidth
          }
        })
      );
    }

    return new PathLayer<DataT>(
      this.getSubLayerProps({
        ...sharedProps,
        id: 'bundled-paths',
        data: this.state.edgeData,
        getPath: (_, {index}) => this.state.bundledPaths[index] || [],
        updateTriggers: {
          ...updateTriggers,
          getPath: this.state.pathVersion
        }
      })
    );
  }
}

function arcHeight(path: EdgePosition[] | undefined): number {
  if (!path || path.length < 2) return 0;
  const source = path[0];
  const target = path[path.length - 1];
  const dx = target[0] - source[0];
  const dy = target[1] - source[1];
  const edgeLen = Math.sqrt(dx * dx + dy * dy);
  if (edgeLen < 1e-6) return 0;
  const perpX = -dy / edgeLen;
  const perpY = dx / edgeLen;
  let totalDev = 0;
  const inner = path.slice(1, -1);
  for (const pt of inner) {
    const t = ((pt[0] - source[0]) * dx + (pt[1] - source[1]) * dy) / (edgeLen * edgeLen);
    const closestX = source[0] + t * dx;
    const closestY = source[1] + t * dy;
    const devX = pt[0] - closestX;
    const devY = pt[1] - closestY;
    totalDev += Math.abs(devX * perpX + devY * perpY);
  }
  const meanDev = inner.length > 0 ? totalDev / inner.length : 0;
  return (2 * meanDev) / edgeLen;
}

function arcTilt(path: EdgePosition[] | undefined): number {
  if (!path || path.length < 2) return 90;
  const source = path[0];
  const target = path[path.length - 1];
  const peak = path[Math.floor(path.length / 2)];
  const dx = target[0] - source[0];
  const dy = target[1] - source[1];
  const edgeLen = Math.sqrt(dx * dx + dy * dy);
  if (edgeLen < 1e-6) return 90;
  const perpX = -dy / edgeLen;
  const perpY = dx / edgeLen;
  const mx = (source[0] + target[0]) / 2;
  const my = (source[1] + target[1]) / 2;
  const dPerp = (peak[0] - mx) * perpX + (peak[1] - my) * perpY;
  return dPerp >= 0 ? 90 : -90;
}

function toIterable<DataT>(data: LayerProps['data']): Iterable<DataT> {
  if (!data) {
    return [];
  }
  if (Symbol.iterator in Object(data)) {
    return data as Iterable<DataT>;
  }
  return [];
}
