// deck.gl-community
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

import {
  CompositeLayer,
  type Accessor,
  type DefaultProps,
  type LayerProps,
  type Position,
  type UpdateParameters
} from '@deck.gl/core';
import {PathLayer, type PathLayerProps} from '@deck.gl/layers';
import {
  computeBundledPaths,
  type EdgeBundlingAlgorithm,
  type EdgeBundleKey,
  type EdgeBundlePath
} from './edge-bundle-utils';

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
    const {updateTriggers} = this.props;
    const pathLayerProps = {...this.props};
    delete pathLayerProps.getSourcePosition;
    delete pathLayerProps.getTargetPosition;
    delete pathLayerProps.getBundleKey;
    delete pathLayerProps.getWeight;
    delete pathLayerProps.bundleStrength;
    delete pathLayerProps.subdivisionCount;
    delete pathLayerProps.bundlingAlgorithm;
    delete pathLayerProps.forceIterations;
    delete pathLayerProps.forceStepSize;
    delete pathLayerProps.updateTriggers;

    return new PathLayer<DataT>(
      this.getSubLayerProps({
        ...pathLayerProps,
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

function toIterable<DataT>(data: LayerProps['data']): Iterable<DataT> {
  if (!data) {
    return [];
  }
  if (Symbol.iterator in Object(data)) {
    return data as Iterable<DataT>;
  }
  return [];
}
