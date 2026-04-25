// deck.gl-community
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors

import {MapboxOverlay} from '@deck.gl/mapbox';
import {ScatterplotLayer, TextLayer} from '@deck.gl/layers';
import type {PickingInfo} from '@deck.gl/core';
import {
  EdgeBundleLayer,
  type EdgeBundleLayerProps,
  type EdgeBundleRenderMode,
  type EdgeBundlingAlgorithm
} from '@deck.gl-community/edge-bundle-layers';
import maplibregl from 'maplibre-gl';

import 'maplibre-gl/dist/maplibre-gl.css';

type Node = {
  id: number;
  city: string;
  state: string;
  name: string;
  position: [number, number];
  region?: number;
  degree?: number;
  isHub?: boolean;
};

type Edge = {
  source: Node;
  target: Node;
  bundleKey: number;
  weight: number;
  bundleLoad: number;
  bundleLoadNorm: number;
  family: 'trunk' | 'corridor' | 'local';
  hotRank: number;
  color: [number, number, number, number];
  label: string;
};

type DemoDatasetId = 'synthetic50' | 'paperAirlines';

type DemoData = {
  id: DemoDatasetId;
  title: string;
  nodes: Node[];
  edges: Edge[];
  topBundleLoads: Array<{bundleKey: number; load: number}>;
};

type EdgeBundleDemoState = {
  datasetId: DemoDatasetId;
  bundlingAlgorithm: EdgeBundlingAlgorithm;
  bundleStrength: number;
  forceIterations: number;
  renderMode: EdgeBundleRenderMode;
};

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const INITIAL_STATE: EdgeBundleDemoState = {
  datasetId: 'paperAirlines',
  bundlingAlgorithm: 'force-gpu',
  bundleStrength: 0.88,
  forceIterations: 10,
  renderMode: 'path'
};

const BASE_EDGE_COLOR: [number, number, number, number] = [146, 186, 228, 172];
const BLUE_LIGHT: [number, number, number] = [201, 224, 246];
const BLUE_MID: [number, number, number] = [170, 205, 240];
const BLUE_DARK: [number, number, number] = [113, 162, 217];
const AIRLINES_XML_URL = new URL('./data/airlines.xml', import.meta.url).toString();

const SYNTHETIC_NODES: Node[] = [
  {id: 1, city: 'Seattle', state: 'WA', name: 'Seattle, WA', position: [-122.3321, 47.6062], region: 0},
  {id: 2, city: 'Portland', state: 'OR', name: 'Portland, OR', position: [-122.6765, 45.5231], region: 0},
  {id: 3, city: 'San Francisco', state: 'CA', name: 'San Francisco, CA', position: [-122.4194, 37.7749], region: 0},
  {id: 4, city: 'San Jose', state: 'CA', name: 'San Jose, CA', position: [-121.8863, 37.3382], region: 0},
  {id: 5, city: 'Sacramento', state: 'CA', name: 'Sacramento, CA', position: [-121.4944, 38.5816], region: 0},
  {id: 6, city: 'Los Angeles', state: 'CA', name: 'Los Angeles, CA', position: [-118.2437, 34.0522], region: 0},
  {id: 7, city: 'San Diego', state: 'CA', name: 'San Diego, CA', position: [-117.1611, 32.7157], region: 0},
  {id: 8, city: 'Las Vegas', state: 'NV', name: 'Las Vegas, NV', position: [-115.1398, 36.1699], region: 0},
  {id: 9, city: 'Phoenix', state: 'AZ', name: 'Phoenix, AZ', position: [-112.074, 33.4484], region: 0},
  {id: 10, city: 'Tucson', state: 'AZ', name: 'Tucson, AZ', position: [-110.9747, 32.2226], region: 0},
  {id: 11, city: 'Salt Lake City', state: 'UT', name: 'Salt Lake City, UT', position: [-111.891, 40.7608], region: 0},
  {id: 12, city: 'Boise', state: 'ID', name: 'Boise, ID', position: [-116.2023, 43.615], region: 0},
  {id: 13, city: 'Denver', state: 'CO', name: 'Denver, CO', position: [-104.9903, 39.7392], region: 1},
  {id: 14, city: 'Albuquerque', state: 'NM', name: 'Albuquerque, NM', position: [-106.6504, 35.0844], region: 0},
  {id: 15, city: 'El Paso', state: 'TX', name: 'El Paso, TX', position: [-106.485, 31.7619], region: 2},
  {id: 16, city: 'Omaha', state: 'NE', name: 'Omaha, NE', position: [-95.9345, 41.2565], region: 1},
  {id: 17, city: 'Kansas City', state: 'MO', name: 'Kansas City, MO', position: [-94.5786, 39.0997], region: 1},
  {id: 18, city: 'St. Louis', state: 'MO', name: 'St. Louis, MO', position: [-90.1994, 38.627], region: 1},
  {id: 19, city: 'Minneapolis', state: 'MN', name: 'Minneapolis, MN', position: [-93.265, 44.9778], region: 1},
  {id: 20, city: 'Milwaukee', state: 'WI', name: 'Milwaukee, WI', position: [-87.9065, 43.0389], region: 1},
  {id: 21, city: 'Chicago', state: 'IL', name: 'Chicago, IL', position: [-87.6298, 41.8781], region: 1},
  {id: 22, city: 'Indianapolis', state: 'IN', name: 'Indianapolis, IN', position: [-86.1581, 39.7684], region: 1},
  {id: 23, city: 'Detroit', state: 'MI', name: 'Detroit, MI', position: [-83.0458, 42.3314], region: 1},
  {id: 24, city: 'Columbus', state: 'OH', name: 'Columbus, OH', position: [-82.9988, 39.9612], region: 1},
  {id: 25, city: 'Cleveland', state: 'OH', name: 'Cleveland, OH', position: [-81.6944, 41.4993], region: 1},
  {id: 26, city: 'Pittsburgh', state: 'PA', name: 'Pittsburgh, PA', position: [-79.9959, 40.4406], region: 3},
  {id: 27, city: 'Dallas', state: 'TX', name: 'Dallas, TX', position: [-96.797, 32.7767], region: 2},
  {id: 28, city: 'Fort Worth', state: 'TX', name: 'Fort Worth, TX', position: [-97.3308, 32.7555], region: 2},
  {id: 29, city: 'Austin', state: 'TX', name: 'Austin, TX', position: [-97.7431, 30.2672], region: 2},
  {id: 30, city: 'San Antonio', state: 'TX', name: 'San Antonio, TX', position: [-98.4936, 29.4241], region: 2},
  {id: 31, city: 'Houston', state: 'TX', name: 'Houston, TX', position: [-95.3698, 29.7604], region: 2},
  {id: 32, city: 'New Orleans', state: 'LA', name: 'New Orleans, LA', position: [-90.0715, 29.9511], region: 2},
  {id: 33, city: 'Oklahoma City', state: 'OK', name: 'Oklahoma City, OK', position: [-97.5164, 35.4676], region: 2},
  {id: 34, city: 'Memphis', state: 'TN', name: 'Memphis, TN', position: [-90.049, 35.1495], region: 2},
  {id: 35, city: 'Nashville', state: 'TN', name: 'Nashville, TN', position: [-86.7816, 36.1627], region: 2},
  {id: 36, city: 'Atlanta', state: 'GA', name: 'Atlanta, GA', position: [-84.388, 33.749], region: 2},
  {id: 37, city: 'Charlotte', state: 'NC', name: 'Charlotte, NC', position: [-80.8431, 35.2271], region: 2},
  {id: 38, city: 'Raleigh', state: 'NC', name: 'Raleigh, NC', position: [-78.6382, 35.7796], region: 2},
  {id: 39, city: 'Jacksonville', state: 'FL', name: 'Jacksonville, FL', position: [-81.6557, 30.3322], region: 2},
  {id: 40, city: 'Orlando', state: 'FL', name: 'Orlando, FL', position: [-81.3792, 28.5383], region: 2},
  {id: 41, city: 'Miami', state: 'FL', name: 'Miami, FL', position: [-80.1918, 25.7617], region: 2},
  {id: 42, city: 'Washington', state: 'DC', name: 'Washington, DC', position: [-77.0369, 38.9072], region: 3},
  {id: 43, city: 'Baltimore', state: 'MD', name: 'Baltimore, MD', position: [-76.6122, 39.2904], region: 3},
  {id: 44, city: 'Philadelphia', state: 'PA', name: 'Philadelphia, PA', position: [-75.1652, 39.9526], region: 3},
  {id: 45, city: 'New York', state: 'NY', name: 'New York, NY', position: [-74.006, 40.7128], region: 3},
  {id: 46, city: 'Boston', state: 'MA', name: 'Boston, MA', position: [-71.0589, 42.3601], region: 3},
  {id: 47, city: 'Buffalo', state: 'NY', name: 'Buffalo, NY', position: [-78.8784, 42.8864], region: 3},
  {id: 48, city: 'Richmond', state: 'VA', name: 'Richmond, VA', position: [-77.436, 37.5407], region: 3},
  {id: 49, city: 'Norfolk', state: 'VA', name: 'Norfolk, VA', position: [-76.2859, 36.8508], region: 3},
  {id: 50, city: 'Providence', state: 'RI', name: 'Providence, RI', position: [-71.4128, 41.824], region: 3}
];

const SYNTHETIC_DEMO_DATA = buildSyntheticDemoData();
let airlinesDataPromise: Promise<DemoData> | null = null;

export function mountEdgeBundleLayerExample(container: HTMLElement): () => void {
  const root = container.ownerDocument.createElement('div');
  root.style.position = 'relative';
  root.style.width = '100%';
  root.style.height = '100%';
  container.replaceChildren(root);

  const mapElement = container.ownerDocument.createElement('div');
  mapElement.style.position = 'absolute';
  mapElement.style.inset = '0';
  root.appendChild(mapElement);

  const controls = createControls(root, INITIAL_STATE, SYNTHETIC_DEMO_DATA);
  let currentData = SYNTHETIC_DEMO_DATA;
  let currentLayers = buildLayers(INITIAL_STATE, currentData, handleEdgeHover);
  let hoveredEdge: Edge | null = null;
  let destroyed = false;

  function applyLayers() {
    const layers = appendHoverEndpointLayer(currentLayers, hoveredEdge);
    deckOverlay.setProps({layers});
  }

  function handleEdgeHover(nextEdge: Edge | null) {
    if (hoveredEdge === nextEdge) {
      return;
    }
    hoveredEdge = nextEdge;
    if (!destroyed) {
      applyLayers();
    }
  }

  const deckOverlay = new MapboxOverlay({interleaved: false, layers: [], getTooltip});
  applyLayers();

  const map = new maplibregl.Map({
    container: mapElement,
    style: MAP_STYLE,
    center: [-98, 39.5],
    zoom: 3.4,
    pitch: 0,
    bearing: 0
  });
  map.addControl(deckOverlay);

  const updateView = () => {
    if (destroyed) {
      return;
    }
    const nextState = controls.readState();
    currentLayers = buildLayers(nextState, currentData, handleEdgeHover);
    applyLayers();
    controls.updateDatasetMeta(currentData);
  };

  const applyDataset = async (datasetId: DemoDatasetId) => {
    const data = await getDataset(datasetId);
    if (destroyed) {
      return;
    }
    currentData = data;
    updateView();
  };

  controls.onChange(() => {
    const state = controls.readState();
    applyDataset(state.datasetId).catch(() => {});
  });

  applyDataset(INITIAL_STATE.datasetId).catch(() => {});

  return () => {
    destroyed = true;
    controls.destroy();
    map.removeControl(deckOverlay);
    deckOverlay.finalize();
    map.remove();
    root.remove();
    container.replaceChildren();
  };
}

async function getDataset(datasetId: DemoDatasetId): Promise<DemoData> {
  if (datasetId === 'synthetic50') {
    return SYNTHETIC_DEMO_DATA;
  }
  if (airlinesDataPromise === null) {
    airlinesDataPromise = loadAirlinesDemoData().catch(() => SYNTHETIC_DEMO_DATA);
  }
  return airlinesDataPromise;
}

function buildLayers(
  state: EdgeBundleDemoState,
  data: DemoData,
  onEdgeHover: (edge: Edge | null) => void
) {
  const bundlingData = getBundlingDataForState(data, state);
  const renderSplit = splitEdgesForRendering(bundlingData, 0.78);
  const baseEdges = renderSplit.baseEdges;
  const structureEdges = renderSplit.structureEdges;
  const isPaperAirlines = data.id === 'paperAirlines';
  const isForceMode = state.bundlingAlgorithm === 'force';
  const isForceGpuMode = state.bundlingAlgorithm === 'force-gpu';
  const hotEdges =
    data.id === 'paperAirlines'
      ? getAirlinesHotEdges(structureEdges)
      : structureEdges.filter((edge) => edge.hotRank < 3);
  const effectiveForceIterations = isPaperAirlines && isForceMode
    ? Math.min(state.forceIterations, 5)
    : isPaperAirlines && isForceGpuMode
      ? Math.min(state.forceIterations, 7)
    : state.forceIterations;
  const effectiveSubdivisionCount = isPaperAirlines && isForceMode ? 12 : isPaperAirlines ? 20 : 36;
  const sharedEdgeBundleProps: EdgeBundleLayerProps<Edge> = {
    id: 'edge-bundle-layer',
    data: bundlingData,
    pickable: true,
    widthUnits: 'pixels',
    widthMinPixels: 1,
    widthMaxPixels: 10,
    getSourcePosition: (edge) => edge.source.position,
    getTargetPosition: (edge) => edge.target.position,
    getBundleKey: (edge) => edge.bundleKey,
    getWeight: (edge) => edge.weight * (1 + edge.bundleLoadNorm * 0.45),
    bundlingAlgorithm: state.bundlingAlgorithm,
    bundleStrength: state.bundleStrength,
    forceIterations: effectiveForceIterations,
    forceStepSize: 0.1,
    subdivisionCount: effectiveSubdivisionCount,
    renderMode: state.renderMode
  };
  const onHoverEdge = (info: PickingInfo<Edge>) => {
    onEdgeHover(info.object || null);
  };
  return [
    new EdgeBundleLayer<Edge>({
      ...sharedEdgeBundleProps,
      data: baseEdges,
      id: 'edge-bundle-layer-halo',
      pickable: true,
      autoHighlight: true,
      highlightColor: [214, 62, 62, 215],
      onHover: onHoverEdge,
      rounded: true,
      capRounded: true,
      jointRounded: true,
      getColor: (edge) =>
        withAlpha(
          mixToward(BASE_EDGE_COLOR, BLUE_LIGHT, 0.68),
          data.id === 'paperAirlines'
            ? 20 + Math.round(Math.pow(edge.bundleLoadNorm, 0.9) * 20)
            : 14 + Math.round(Math.pow(edge.bundleLoadNorm, 0.9) * 24)
        ),
      getWidth: (edge) =>
        data.id === 'paperAirlines'
          ? 0.05 + Math.pow(edge.bundleLoadNorm, 1.02) * 0.34
          : 0.09 + Math.pow(edge.bundleLoadNorm, 1.02) * 0.62
    }),
    new EdgeBundleLayer<Edge>({
      ...sharedEdgeBundleProps,
      data: structureEdges,
      id: 'edge-bundle-layer-main',
      onHover: onHoverEdge,
      rounded: true,
      capRounded: true,
      jointRounded: true,
      getColor: (edge) =>
        withAlpha(
          mixToward(blueMidColor(edge.bundleLoadNorm), BLUE_LIGHT, 0.06),
          data.id === 'paperAirlines'
            ? 52 + Math.round(edge.bundleLoadNorm * 74)
            : 24 + Math.round(edge.bundleLoadNorm * 66)
        ),
      getWidth: (edge) =>
        data.id === 'paperAirlines'
          ? 0.12 + Math.pow(edge.bundleLoadNorm, 0.92) * 0.84
          : 0.05 + Math.pow(edge.bundleLoadNorm, 0.92) * 0.82
    }),
    new EdgeBundleLayer<Edge>({
      ...sharedEdgeBundleProps,
      data: hotEdges,
      id: 'edge-bundle-layer-hot',
      pickable: true,
      autoHighlight: true,
      highlightColor: [214, 62, 62, 215],
      onHover: onHoverEdge,
      rounded: true,
      capRounded: true,
      jointRounded: true,
      getColor: (edge) =>
        withAlpha(
          blueHotColor(edge.hotRank, edge.bundleLoadNorm),
          data.id === 'paperAirlines'
            ? 24 + Math.round(edge.bundleLoadNorm * 30)
            : 88 + Math.round(edge.bundleLoadNorm * 66)
        ),
      getWidth: (edge) =>
        data.id === 'paperAirlines'
          ? 0.12 + Math.pow(edge.bundleLoadNorm, 0.9) * 0.24
          : 0.75 + Math.pow(edge.bundleLoadNorm, 0.86) * 1.2
    }),
    new ScatterplotLayer<Node>({
      id: 'edge-bundle-nodes',
      data: data.nodes,
      pickable: true,
      radiusUnits: 'pixels',
      radiusMinPixels: 1,
      radiusMaxPixels: 10,
      getPosition: (node) => node.position,
      getRadius: (() => {
        const maxDeg = Math.max(...data.nodes.map((n) => n.degree || 0), 1);
        return (node: Node) => 1.5 + ((node.degree || 0) / maxDeg) * 7;
      })(),
      getFillColor: (node) =>
        isHub(node)
          ? [46, 62, 84, 206]
          : withAlpha(mixToward(BASE_EDGE_COLOR, [38, 50, 74], 0.32), 128),
      getLineColor: [246, 249, 255, 196],
      lineWidthUnits: 'pixels',
      lineWidthMinPixels: 1
    })
  ];
}

function appendHoverEndpointLayer(
  layers: ReturnType<typeof buildLayers>,
  hoveredEdge: Edge | null
) {
  const highlightNodes = hoveredEdge ? [hoveredEdge.source, hoveredEdge.target] : [];
  return [
    ...layers,
    new ScatterplotLayer<Node>({
      id: 'edge-bundle-hover-endpoints',
      data: highlightNodes,
      pickable: false,
      radiusUnits: 'pixels',
      radiusMinPixels: 6,
      radiusMaxPixels: 10,
      stroked: true,
      filled: true,
      getPosition: (node) => node.position,
      getRadius: (_node, {index}) => (index === 0 ? 7.2 : 6.6),
      getFillColor: (_node, {index}) => (index === 0 ? [214, 62, 62, 225] : [228, 94, 94, 215]),
      getLineColor: [246, 250, 255, 240],
      lineWidthUnits: 'pixels',
      lineWidthMinPixels: 2
    }),
    new TextLayer<Node>({
      id: 'edge-bundle-hover-endpoint-labels',
      data: highlightNodes,
      pickable: false,
      getPosition: (node) => node.position,
      getText: (node, {index}) => `${index === 0 ? 'Start' : 'End'}: ${node.name}`,
      getColor: [24, 40, 66, 245],
      getSize: 12,
      getTextAnchor: 'start',
      getAlignmentBaseline: 'bottom',
      getPixelOffset: [8, -8],
      sizeUnits: 'pixels',
      billboard: true,
      background: true,
      getBackgroundColor: [247, 251, 255, 210],
      getBorderColor: [223, 142, 142, 220],
      borderWidth: 1,
      characterSet: 'auto'
    })
  ];
}

function getBundlingDataForState(data: DemoData, state: EdgeBundleDemoState): Edge[] {
  if (data.id !== 'paperAirlines') {
    return data.edges;
  }
  if (state.bundlingAlgorithm === 'force') {
    return getForceSafeEdges(data.edges, 720);
  }
  return data.edges;
}

function splitEdgesForRendering(
  edges: Edge[],
  structureQuantile: number
): {baseEdges: Edge[]; structureEdges: Edge[]} {
  if (edges.length === 0) {
    return {baseEdges: [], structureEdges: []};
  }
  const values = edges.map((edge) => edge.bundleLoadNorm).sort((a, b) => a - b);
  const threshold = getQuantile(values, structureQuantile);
  const structureEdges = edges.filter((edge) => edge.bundleLoadNorm >= threshold);
  return {
    baseEdges: edges,
    structureEdges: structureEdges.length > 0 ? structureEdges : edges
  };
}

function getQuantile(sortedValues: number[], q: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }
  const t = clamp01(q);
  const index = Math.max(0, Math.min(sortedValues.length - 1, Math.floor(t * (sortedValues.length - 1))));
  return sortedValues[index];
}

function getTooltip(info: PickingInfo<Edge | Node>) {
  if (!info.object) {
    return null;
  }
  if ('source' in info.object) {
    return {
      text: `Route: ${info.object.label}\nBundle: ${info.object.bundleKey}\nLoad: ${info.object.bundleLoad}`
    };
  }
  return {text: info.object.name};
}

function createControls(parent: HTMLDivElement, state: EdgeBundleDemoState, data: DemoData) {
  const panel = parent.ownerDocument.createElement('div');
  applyPanelStyles(panel);

  const title = parent.ownerDocument.createElement('div');
  title.style.fontWeight = '700';
  panel.appendChild(title);

  const subtitle = parent.ownerDocument.createElement('div');
  subtitle.style.opacity = '0.85';
  panel.appendChild(subtitle);

  const bundleLoadDebug = createBundleLoadDebug(panel.ownerDocument, data.topBundleLoads);
  panel.appendChild(bundleLoadDebug.element);

  const datasetSelect = createSelect(
    panel,
    'Dataset',
    [
      {value: 'paperAirlines', label: 'US airlines (GraphML)'},
      {value: 'synthetic50', label: 'Synthetic 50 US cities'}
    ],
    state.datasetId
  );
  const algorithmSelect = createSelect(
    panel,
    'Algorithm',
    [
      {value: 'centroid', label: 'centroid'},
      {value: 'spine', label: 'spine'},
      {value: 'force-gpu', label: 'force-gpu'}
    ],
    state.bundlingAlgorithm
  );
  const renderModeSelect = createSelect(
    panel,
    'Render mode',
    [
      {value: 'path', label: 'path'},
      {value: 'arc', label: 'arc'}
    ],
    state.renderMode
  );
  parent.appendChild(panel);

  const listeners = new Set<() => void>();
  bindControlEvents([datasetSelect, algorithmSelect, renderModeSelect], listeners);
  datasetSelect.addEventListener('change', () => {
    if (datasetSelect.value === 'paperAirlines') {
      algorithmSelect.value = 'force-gpu';
    }
  });

  const updateDatasetMeta = (nextData: DemoData) => {
    title.textContent = nextData.title;
    subtitle.textContent = `${nextData.nodes.length} nodes • ${nextData.edges.length} routes`;
    bundleLoadDebug.setRows(nextData.topBundleLoads);
  };

  updateDatasetMeta(data);

  return {
    readState(): EdgeBundleDemoState {
      return {
        datasetId: datasetSelect.value as DemoDatasetId,
        bundlingAlgorithm: algorithmSelect.value as EdgeBundlingAlgorithm,
        bundleStrength: state.bundleStrength,
        forceIterations: state.forceIterations,
        renderMode: renderModeSelect.value as EdgeBundleRenderMode
      };
    },
    updateDatasetMeta,
    onChange(fn: () => void) {
      listeners.add(fn);
    },
    destroy() {
      listeners.clear();
      panel.remove();
    }
  };
}

function createSelect(
  panel: HTMLElement,
  labelText: string,
  options: Array<{value: string; label: string}>,
  currentValue: string
): HTMLSelectElement {
  const label = panel.ownerDocument.createElement('label');
  label.style.display = 'grid';
  label.style.gap = '4px';
  label.textContent = labelText;
  const select = panel.ownerDocument.createElement('select');
  for (const optionValue of options) {
    const option = panel.ownerDocument.createElement('option');
    option.value = optionValue.value;
    option.textContent = optionValue.label;
    select.appendChild(option);
  }
  select.value = currentValue;
  label.appendChild(select);
  panel.appendChild(label);
  return select;
}

function applyPanelStyles(panel: HTMLDivElement): void {
  panel.style.position = 'absolute';
  panel.style.top = '12px';
  panel.style.left = '12px';
  panel.style.zIndex = '1';
  panel.style.padding = '10px 12px';
  panel.style.background = 'rgba(15, 23, 42, 0.82)';
  panel.style.color = '#f8fafc';
  panel.style.borderRadius = '8px';
  panel.style.fontFamily = 'ui-sans-serif, system-ui, sans-serif';
  panel.style.fontSize = '12px';
  panel.style.display = 'grid';
  panel.style.gap = '8px';
  panel.style.minWidth = '260px';
}

function bindControlEvents(
  elements: Array<HTMLInputElement | HTMLSelectElement>,
  listeners: Set<() => void>
): void {
  const notify = () => {
    for (const fn of listeners) {
      fn();
    }
  };
  elements.forEach((element) => {
    element.addEventListener('input', notify);
    element.addEventListener('change', notify);
  });
}

function buildSyntheticDemoData(): DemoData {
  const edges = createSyntheticEdges(SYNTHETIC_NODES);
  return {
    id: 'synthetic50',
    title: 'MapLibre + 50 US locations (synthetic)',
    nodes: SYNTHETIC_NODES,
    edges,
    topBundleLoads: getTopBundleLoads(edges, 8)
  };
}

function createSyntheticEdges(nodes: Node[]): Edge[] {
  const byCity = new Map(nodes.map((node) => [node.city, node]));
  const la = getNodeByCity(byCity, 'Los Angeles');
  const nyc = getNodeByCity(byCity, 'New York');
  const atl = getNodeByCity(byCity, 'Atlanta');
  const chicago = getNodeByCity(byCity, 'Chicago');
  const dallas = getNodeByCity(byCity, 'Dallas');

  const edges: Array<Omit<Edge, 'bundleLoad' | 'bundleLoadNorm' | 'hotRank'>> = [];
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    const majorHub = chooseMajorHub(node, {la, nyc, atl});
    maybeAddEdge(edges, node, majorHub, {bundleKey: 900 + majorHub.id, weight: 1.65, family: 'trunk', enabled: true});

    maybeAddEdge(edges, node, chicago, {
      bundleKey: 1200,
      weight: 1.08,
      family: 'corridor',
      enabled: index % 2 === 0 && node.id !== chicago.id
    });
    maybeAddEdge(edges, node, dallas, {
      bundleKey: 1201,
      weight: 1.02,
      family: 'corridor',
      enabled: index % 3 === 0 && node.id !== dallas.id
    });

    addLocalWebEdges(edges, nodes, node, index);
    addSparseInterRegionEdge(edges, nodes, node, index);
  }
  const routes = edges.map((e) => ({sourceId: e.source.id, targetId: e.target.id}));
  applyRouteDegrees(nodes, routes);
  return enrichEdgesWithBundleLoad(edges);
}

async function loadAirlinesDemoData(): Promise<DemoData> {
  const response = await fetch(AIRLINES_XML_URL);
  if (!response.ok) {
    throw new Error(`Failed to load airlines GraphML: ${response.status}`);
  }
  const xml = await response.text();
  const {nodes, routes} = parseAirlinesGraphMl(xml);
  const edges = createAirlinesEdges(nodes, routes);
  return {
    id: 'paperAirlines',
    title: 'US airlines GraphML',
    nodes,
    edges,
    topBundleLoads: getTopBundleLoads(edges, 8)
  };
}

function parseAirlinesGraphMl(xml: string): {nodes: Node[]; routes: Array<{sourceId: number; targetId: number}>} {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('Could not parse airlines GraphML XML');
  }

  const nodeElements = Array.from(doc.getElementsByTagNameNS('*', 'node'));
  const nodes: Node[] = nodeElements
    .map((nodeElement) => {
      const idText = nodeElement.getAttribute('id');
      if (!idText) {
        return null;
      }
      const id = Number(idText);
      if (!Number.isFinite(id)) {
        return null;
      }
      const tooltip = getDataValue(nodeElement, 'tooltip');
      const {code, lng, lat} = parseAirportTooltip(tooltip, getDataValue(nodeElement, 'x'), getDataValue(nodeElement, 'y'));
      return {
        id,
        city: code,
        state: '',
        name: code,
        position: [lng, lat],
        region: getRegionFromLongitude(lng),
        degree: 0,
        isHub: false
      } as Node;
    })
    .filter((node): node is Node => Boolean(node));

  const edgeElements = Array.from(doc.getElementsByTagNameNS('*', 'edge'));
  const routes = edgeElements
    .map((edgeElement) => {
      const sourceId = Number(edgeElement.getAttribute('source'));
      const targetId = Number(edgeElement.getAttribute('target'));
      if (!Number.isFinite(sourceId) || !Number.isFinite(targetId) || sourceId === targetId) {
        return null;
      }
      return {sourceId, targetId};
    })
    .filter((route): route is {sourceId: number; targetId: number} => Boolean(route));

  return {nodes, routes};
}

function createAirlinesEdges(nodes: Node[], routes: Array<{sourceId: number; targetId: number}>): Edge[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  applyRouteDegrees(nodes, routes);
  const hubs = createHubMeta(nodes);
  const maxDegree = Math.max(...nodes.map((node) => node.degree || 0), 1);
  const edges = routes
    .map((route) => buildAirlinesEdge(route, nodesById, hubs, maxDegree))
    .filter((edge): edge is Omit<Edge, 'bundleLoad' | 'bundleLoadNorm' | 'hotRank'> => Boolean(edge));
  return enrichEdgesWithBundleLoad(edges);
}

function applyRouteDegrees(nodes: Node[], routes: Array<{sourceId: number; targetId: number}>): void {
  const degreeMap = new Map<number, number>();
  for (const route of routes) {
    degreeMap.set(route.sourceId, (degreeMap.get(route.sourceId) || 0) + 1);
    degreeMap.set(route.targetId, (degreeMap.get(route.targetId) || 0) + 1);
  }
  for (const node of nodes) {
    node.degree = degreeMap.get(node.id) || 0;
  }
}

function createHubMeta(nodes: Node[]): {hubNodes: Node[]; topHubIds: Set<number>} {
  const hubNodes = [...nodes]
    .sort((a, b) => (b.degree || 0) - (a.degree || 0))
    .slice(0, 8);
  const topHubIds = new Set(hubNodes.slice(0, 3).map((node) => node.id));
  const hubIdSet = new Set(hubNodes.map((node) => node.id));
  for (const node of nodes) {
    node.isHub = hubIdSet.has(node.id);
  }
  return {hubNodes, topHubIds};
}

function buildAirlinesEdge(
  route: {sourceId: number; targetId: number},
  nodesById: Map<number, Node>,
  hubs: {hubNodes: Node[]; topHubIds: Set<number>},
  maxDegree: number
): Omit<Edge, 'bundleLoad' | 'bundleLoadNorm' | 'hotRank'> | null {
  const source = nodesById.get(route.sourceId);
  const target = nodesById.get(route.targetId);
  if (!source || !target) {
    return null;
  }

  const sourceHub = findNearestNode(source.position, hubs.hubNodes);
  const targetHub = findNearestNode(target.position, hubs.hubNodes);
  const hubLow = Math.min(sourceHub.id, targetHub.id);
  const hubHigh = Math.max(sourceHub.id, targetHub.id);
  const bundleKey = hubLow * 1000 + hubHigh;
  const degreeStrength = ((source.degree || 0) + (target.degree || 0)) / (2 * maxDegree);
  const weight = 0.74 + degreeStrength * 1.06;
  const family = getAirlinesFamily(sourceHub.id, targetHub.id, hubs.topHubIds);
  return createEdge(source, target, bundleKey, weight, family);
}

function getAirlinesFamily(sourceHubId: number, targetHubId: number, topHubIds: Set<number>): Edge['family'] {
  if (sourceHubId === targetHubId) {
    return 'local';
  }
  if (topHubIds.has(sourceHubId) || topHubIds.has(targetHubId)) {
    return 'trunk';
  }
  return 'corridor';
}

function parseAirportTooltip(tooltip: string, xRaw: string, yRaw: string): {code: string; lng: number; lat: number} {
  const match = /^([A-Z0-9]{3,4})\(lngx=([-0-9.]+),laty=([-0-9.]+)\)$/.exec(tooltip.trim());
  if (match) {
    return {
      code: match[1],
      lng: Number(match[2]),
      lat: Number(match[3])
    };
  }

  const fallbackLng = Number(xRaw) / 10;
  const fallbackLat = -Number(yRaw) / 10;
  return {
    code: 'UNK',
    lng: Number.isFinite(fallbackLng) ? fallbackLng : 0,
    lat: Number.isFinite(fallbackLat) ? fallbackLat : 0
  };
}

function getDataValue(nodeElement: Element, key: string): string {
  const dataElements = Array.from(nodeElement.getElementsByTagNameNS('*', 'data'));
  const item = dataElements.find((dataElement) => dataElement.getAttribute('key') === key);
  return item?.textContent?.trim() || '';
}

function getRegionFromLongitude(longitude: number): number {
  if (longitude < -108) {
    return 0;
  }
  if (longitude < -92) {
    return 1;
  }
  if (longitude < -82) {
    return 2;
  }
  return 3;
}

function findNearestNode(position: [number, number], candidates: Node[]): Node {
  let nearest = candidates[0];
  let minDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const distance = getDistanceSq(position, candidate.position);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = candidate;
    }
  }
  return nearest;
}

function createEdge(
  source: Node,
  target: Node,
  bundleKey: number,
  weight: number,
  family: Edge['family']
): Edge {
  return {
    source,
    target,
    bundleKey,
    weight,
    bundleLoad: 0,
    bundleLoadNorm: 0,
    hotRank: 99,
    family,
    color: BASE_EDGE_COLOR,
    label: `${source.name} to ${target.name}`
  };
}

function isHub(node: Node): boolean {
  return Boolean(node.isHub);
}

function getNodeByCity(byCity: Map<string, Node>, city: string): Node {
  const node = byCity.get(city);
  if (!node) {
    throw new Error(`Missing city in dataset: ${city}`);
  }
  return node;
}

function maybeAddEdge(
  edges: Array<Omit<Edge, 'bundleLoad' | 'bundleLoadNorm' | 'hotRank'>>,
  source: Node,
  target: Node | undefined,
  options: {bundleKey: number; weight: number; family: Edge['family']; enabled: boolean}
): void {
  if (!options.enabled || !target || source.id === target.id) {
    return;
  }
  edges.push(createEdge(source, target, options.bundleKey, options.weight, options.family));
}

function enrichEdgesWithBundleLoad(
  edges: Array<Omit<Edge, 'bundleLoad' | 'bundleLoadNorm' | 'hotRank'>>
): Edge[] {
  const counts = new Map<number, number>();
  for (const edge of edges) {
    counts.set(edge.bundleKey, (counts.get(edge.bundleKey) || 0) + 1);
  }
  const maxCount = Math.max(...counts.values(), 1);
  const hotRanks = getTopBundleLoadsFromCounts(counts, 3);
  const hotMap = new Map(hotRanks.map((entry, index) => [entry.bundleKey, index]));
  return edges.map((edge) => {
    const bundleLoad = counts.get(edge.bundleKey) || 1;
    return {
      ...edge,
      bundleLoad,
      bundleLoadNorm: bundleLoad / maxCount,
      hotRank: hotMap.get(edge.bundleKey) ?? 99
    };
  });
}

function withAlpha(color: [number, number, number, number], alpha: number): [number, number, number, number] {
  return [color[0], color[1], color[2], clampByte(alpha)];
}

function mixToward(
  color: [number, number, number, number],
  target: [number, number, number],
  amount: number
): [number, number, number, number] {
  const t = clamp01(amount);
  return [
    Math.round(color[0] + (target[0] - color[0]) * t),
    Math.round(color[1] + (target[1] - color[1]) * t),
    Math.round(color[2] + (target[2] - color[2]) * t),
    color[3]
  ];
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function blueMidColor(loadNorm: number): [number, number, number, number] {
  const t = clamp01(loadNorm);
  return [
    Math.round(BLUE_LIGHT[0] + (BLUE_MID[0] - BLUE_LIGHT[0]) * t),
    Math.round(BLUE_LIGHT[1] + (BLUE_MID[1] - BLUE_LIGHT[1]) * t),
    Math.round(BLUE_LIGHT[2] + (BLUE_MID[2] - BLUE_LIGHT[2]) * t),
    255
  ];
}

function blueHotColor(hotRank: number, loadNorm: number): [number, number, number, number] {
  const rankFactor = hotRank === 0 ? 1 : hotRank === 1 ? 0.84 : 0.72;
  const t = clamp01(loadNorm * rankFactor);
  return [
    Math.round(BLUE_MID[0] + (BLUE_DARK[0] - BLUE_MID[0]) * t),
    Math.round(BLUE_MID[1] + (BLUE_DARK[1] - BLUE_MID[1]) * t),
    Math.round(BLUE_MID[2] + (BLUE_DARK[2] - BLUE_MID[2]) * t),
    255
  ];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getTopBundleLoads(edges: Edge[], limit: number): Array<{bundleKey: number; load: number}> {
  const counts = new Map<number, number>();
  for (const edge of edges) {
    counts.set(edge.bundleKey, (counts.get(edge.bundleKey) || 0) + 1);
  }
  return getTopBundleLoadsFromCounts(counts, limit);
}

function getTopBundleLoadsFromCounts(
  counts: Map<number, number>,
  limit: number
): Array<{bundleKey: number; load: number}> {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([bundleKey, load]) => ({bundleKey, load}));
}

function getAirlinesHotEdges(edges: Edge[]): Edge[] {
  const counts = new Map<number, number>();
  for (const edge of edges) {
    if (edge.family === 'trunk') {
      counts.set(edge.bundleKey, (counts.get(edge.bundleKey) || 0) + 1);
    }
  }

  const topBundles = getTopBundleLoadsFromCounts(counts, 2).map((row) => row.bundleKey);
  const selected: Edge[] = [];
  for (const bundleKey of topBundles) {
    const bundleEdges = edges
      .filter((edge) => edge.bundleKey === bundleKey && edge.bundleLoadNorm >= 0.2)
      .sort((a, b) => b.bundleLoadNorm - a.bundleLoadNorm)
      .slice(0, 20);
    selected.push(...bundleEdges);
  }
  return selected;
}

function getForceSafeEdges(edges: Edge[], maxEdges: number): Edge[] {
  if (edges.length <= maxEdges) {
    return edges;
  }
  const ranked = [...edges].sort((a, b) => {
    const aScore = getEdgePriorityScore(a);
    const bScore = getEdgePriorityScore(b);
    return bScore - aScore;
  });
  return ranked.slice(0, maxEdges);
}

function getEdgePriorityScore(edge: Edge): number {
  const familyBoost = edge.family === 'trunk' ? 2.2 : edge.family === 'corridor' ? 1.4 : 1;
  return familyBoost * (0.4 + edge.bundleLoadNorm * 1.6) * edge.weight;
}

function createBundleLoadDebug(doc: Document, rows: Array<{bundleKey: number; load: number}>) {
  const container = doc.createElement('div');
  container.style.display = 'grid';
  container.style.gap = '2px';
  container.style.paddingTop = '2px';
  container.style.fontSize = '11px';
  container.style.lineHeight = '1.25';
  container.style.opacity = '0.88';

  const title = doc.createElement('div');
  title.textContent = 'Top bundle loads';
  title.style.fontWeight = '600';
  container.appendChild(title);

  const list = doc.createElement('div');
  list.style.display = 'grid';
  list.style.gap = '1px';
  container.appendChild(list);

  const setRows = (nextRows: Array<{bundleKey: number; load: number}>) => {
    list.replaceChildren();
    for (const row of nextRows) {
      const item = doc.createElement('div');
      item.textContent = `${row.bundleKey}: ${row.load}`;
      list.appendChild(item);
    }
  };

  setRows(rows);

  return {element: container, setRows};
}

function chooseMajorHub(
  node: Node,
  hubs: {la: Node; nyc: Node; atl: Node}
): Node {
  if (node.position[0] < -108) {
    return hubs.la;
  }
  if (node.position[0] > -86) {
    return hubs.nyc;
  }
  return hubs.atl;
}

function addLocalWebEdges(
  edges: Array<Omit<Edge, 'bundleLoad' | 'bundleLoadNorm' | 'hotRank'>>,
  nodes: Node[],
  node: Node,
  index: number
): void {
  const neighbors = findNearestNodes(nodes, node, 3);
  for (let i = 0; i < neighbors.length; i++) {
    maybeAddEdge(edges, node, neighbors[i], {
      bundleKey: 3000 + (node.region || 0) * 100 + i * 20 + (index % 20),
      weight: 0.72,
      family: 'local',
      enabled: index % 2 === 1 || i === 0
    });
  }
}

function addSparseInterRegionEdge(
  edges: Array<Omit<Edge, 'bundleLoad' | 'bundleLoadNorm' | 'hotRank'>>,
  nodes: Node[],
  node: Node,
  index: number
): void {
  if (index % 5 !== 0) {
    return;
  }
  const targetIndex = (index * 7 + 11) % nodes.length;
  const target = nodes[targetIndex];
  if (target.region === node.region) {
    return;
  }
  maybeAddEdge(edges, node, target, {
    bundleKey: 5000 + index,
    weight: 0.62,
    family: 'local',
    enabled: true
  });
}

function findNearestNodes(nodes: Node[], source: Node, count: number): Node[] {
  const candidates = nodes
    .filter((node) => node.id !== source.id)
    .map((node) => ({node, distance: getDistanceSq(source.position, node.position)}))
    .sort((a, b) => a.distance - b.distance);
  return candidates.slice(0, count).map((candidate) => candidate.node);
}

function getDistanceSq(a: [number, number], b: [number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}
