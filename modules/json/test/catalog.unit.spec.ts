import {describe, expect, test} from 'vitest';
import {z} from 'zod';

import {
  baseLayerPropsSchema,
  classDescriptorSchema,
  createDeckJsonCatalog,
  deckJsonCatalog,
  getDeckJsonSchema,
  getDeckJsonZodSchema
} from '../src';

describe('@deck.gl-community/json catalog', () => {
  test('starts with an isolated empty default catalog', () => {
    expect(deckJsonCatalog.layers.size).toBe(0);
    expect(deckJsonCatalog.views.size).toBe(0);
  });

  test('validates a generic deck.gl JSON document with conversion syntax', () => {
    const schema = getDeckJsonZodSchema();
    const result = schema.safeParse({
      initialViewState: {longitude: -122.4, latitude: 37.8, zoom: 10},
      views: [{'@@type': 'MapView', id: 'map'}],
      layers: [
        {
          '@@type': 'ScatterplotLayer',
          id: 'earthquakes',
          data: 'https://example.com/earthquakes.json',
          getPosition: '@@=[longitude, latitude]',
          getRadius: '@@=Math.pow(2, magnitude) * 1000',
          getFillColor: '@@=magnitude >= 6 ? [220, 40, 40] : [245, 170, 60]'
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  test('validates base layer props without requiring a concrete layer schema', () => {
    const result = baseLayerPropsSchema.safeParse({
      '@@type': 'ScatterplotLayer',
      id: 'earthquakes',
      opacity: 0.7,
      pickable: '3d',
      coordinateSystem: 'lnglat',
      coordinateOrigin: [0, 0, 0],
      modelMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -122.4, 37.8, 0, 1],
      highlightColor: [0, 0, 128, 128],
      updateTriggers: {
        getFillColor: ['status']
      },
      onClick: {'@@function': 'handleClick'}
    });

    expect(result.success).toBe(true);
  });

  test('rejects invalid known base layer props', () => {
    const result = baseLayerPropsSchema.safeParse({
      '@@type': 'ScatterplotLayer',
      opacity: 2
    });

    expect(result.success).toBe(false);
  });

  test('requires class descriptors to have a non-empty @@type', () => {
    const result = classDescriptorSchema.safeParse({'@@type': ''});

    expect(result.success).toBe(false);
  });

  test('creates JSON Schema from the root Zod schema', () => {
    const jsonSchema = getDeckJsonSchema();

    expect(jsonSchema).toMatchObject({
      $schema: 'http://json-schema.org/draft-07/schema#'
    });
  });

  test('allows clients to create an extended catalog without mutating defaults', () => {
    const customLayerSchema = z.object({'@@type': z.literal('CustomLayer')}).passthrough();
    const catalog = createDeckJsonCatalog({
      layers: [
        {
          type: 'CustomLayer',
          kind: 'layer',
          schema: customLayerSchema
        }
      ]
    });

    expect(catalog.getEntry('layer', 'CustomLayer')).toBeDefined();
    expect(
      catalog.getSchema('layer', 'CustomLayer').safeParse({'@@type': 'CustomLayer'}).success
    ).toBe(true);
    expect(catalog.getJsonSchema('layer', 'CustomLayer')).toMatchObject({
      $schema: 'http://json-schema.org/draft-07/schema#'
    });
    expect(deckJsonCatalog.getEntry('layer', 'CustomLayer')).toBeUndefined();
  });
});
