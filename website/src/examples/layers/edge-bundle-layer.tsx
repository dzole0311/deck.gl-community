import {GITHUB_TREE} from '../../constants/defaults';
import {makeImperativeExample} from '../../components';

export default makeImperativeExample(
  {
    title: 'Edge bundle layer',
    code: `${GITHUB_TREE}/examples/layers/edge-bundle-layer`,
    async mount(container) {
      const {mountEdgeBundleLayerExample} = await import('../../../../examples/layers/edge-bundle-layer/app');
      return mountEdgeBundleLayerExample(container);
    }
  },
  {addInfoPanel: false}
);
