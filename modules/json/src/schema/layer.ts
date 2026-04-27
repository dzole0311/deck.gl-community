import {z} from 'zod';

import {classDescriptorSchema, convertedValueSchema} from './conversion';
import {
  callbackReferenceSchema,
  colorAccessorSchema,
  coordinateSystemSchema,
  layerDataSchema,
  loadOptionsSchema,
  matrix4Schema,
  parametersSchema,
  position3Schema,
  transitionsSchema,
  updateTriggersSchema
} from './primitives';

export const dataDiffRangeSchema = z.object({
  startRow: z.number().int().min(0),
  endRow: z.number().int().min(0)
});

export const baseLayerPropsSchema = classDescriptorSchema
  .extend({
    id: z.string().optional(),
    data: layerDataSchema.optional(),
    visible: z.boolean().optional(),
    opacity: z.number().min(0).max(1).optional(),
    extensions: z.array(convertedValueSchema).optional(),
    onError: callbackReferenceSchema.optional(),

    pickable: z.union([z.boolean(), z.literal('3d')]).optional(),
    onHover: callbackReferenceSchema.optional(),
    onClick: callbackReferenceSchema.optional(),
    onDragStart: callbackReferenceSchema.optional(),
    onDrag: callbackReferenceSchema.optional(),
    onDragEnd: callbackReferenceSchema.optional(),
    highlightColor: colorAccessorSchema.optional(),
    highlightedObjectIndex: z.union([z.number().int(), z.null()]).optional(),
    autoHighlight: z.boolean().optional(),

    coordinateSystem: coordinateSystemSchema.optional(),
    coordinateOrigin: position3Schema.optional(),
    wrapLongitude: z.boolean().optional(),
    modelMatrix: matrix4Schema.optional(),

    dataComparator: callbackReferenceSchema.optional(),
    dataTransform: callbackReferenceSchema.optional(),
    _dataDiff: callbackReferenceSchema.optional(),
    positionFormat: z.enum(['XYZ', 'XY']).optional(),
    colorFormat: z.enum(['RGBA', 'RGB']).optional(),
    numInstances: z.number().int().min(0).optional(),
    updateTriggers: updateTriggersSchema.optional(),
    loadOptions: loadOptionsSchema.optional(),

    parameters: parametersSchema.optional(),
    transitions: transitionsSchema.optional()
  })
  .catchall(convertedValueSchema)
  .describe('Base deck.gl Layer JSON descriptor props shared by all layers.');

export const baseCompositeLayerPropsSchema = baseLayerPropsSchema
  .extend({
    _subLayerProps: z.record(z.string(), z.object({}).catchall(convertedValueSchema)).optional()
  })
  .catchall(convertedValueSchema)
  .describe('Base CompositeLayer JSON descriptor props shared by composite layers.');

export const layerDescriptorSchema = baseLayerPropsSchema.describe(
  'Generic deck.gl JSON layer descriptor. Detailed layer props are added by catalog entries.'
);

export type BaseLayerProps = z.infer<typeof baseLayerPropsSchema>;
export type BaseCompositeLayerProps = z.infer<typeof baseCompositeLayerPropsSchema>;
