// This file contains webpack configuration settings that allow
// examples to be built against the source code in this repo instead
// of building against their installed version of the modules.

import {defineConfig} from 'vite';
import {getOcularConfig} from '@vis.gl/dev-tools';
import {join} from 'path';

const rootDir = join(__dirname, '..');

/** https://vitejs.dev/config/ */
export default defineConfig(async () => {
  const {aliases} = await getOcularConfig({root: rootDir});

  console.log(aliases);
  const staticAliases = {
    // Use root dependencies
    '@deck.gl': join(rootDir, './node_modules/@deck.gl'),
    '@luma.gl': join(rootDir, './node_modules/@luma.gl'),
    '@math.gl': join(rootDir, './node_modules/@math.gl'),
    '@loaders.gl': join(rootDir, './node_modules/@loaders.gl'),
    // TODO: Example 'editable-layers/editor' fails (loading two copies of react)
    // without these overrides. That's unexpected and should be fixed.
    'react': join(rootDir, './node_modules/react'),
    'react-dom': join(rootDir, './node_modules/react-dom')
  };
  const mergedAliases = {...aliases, ...staticAliases};
  delete mergedAliases['@luma.gl/webgl/constants'];
  const aliasEntries = Object.entries(mergedAliases).map(([find, replacement]) => ({find, replacement}));

  return {
    resolve: {
      alias: [
        {
          find: '@luma.gl/webgl/constants',
          replacement: join(rootDir, './node_modules/@luma.gl/webgl/dist/constants/index.js')
        },
        ...aliasEntries
      ]
    },
    define: {
      'process.env.GoogleMapsAPIKey': JSON.stringify(process.env.GoogleMapsAPIKey),
      'process.env.GoogleMapsMapId': JSON.stringify(process.env.GoogleMapsMapId),
      'process.env.MapboxAccessToken': JSON.stringify(process.env.MapboxAccessToken),
      'process.env.BingMapsAPIKey': JSON.stringify(process.env.BingMapsAPIKey)
    },
    server: {
      open: true,
      port: 8080
    },
    optimizeDeps: {
      exclude: ['@deck.gl-community/edge-bundle-layers'],
      esbuildOptions: {target: 'es2020'}
    }
  };
});
