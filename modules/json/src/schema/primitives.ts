import {z} from 'zod';

import {
  constantReferenceSchema,
  convertedValueSchema,
  expressionReferenceSchema,
  functionDescriptorSchema,
  jsonValueSchema
} from './conversion';

export const finiteNumberSchema = z.number().finite();

export const colorSchema = z
  .union([
    z.tuple([finiteNumberSchema, finiteNumberSchema, finiteNumberSchema]),
    z.tuple([finiteNumberSchema, finiteNumberSchema, finiteNumberSchema, finiteNumberSchema])
  ])
  .describe('RGB or RGBA color array.');

export const position2Schema = z.tuple([finiteNumberSchema, finiteNumberSchema]);
export const position3Schema = z.tuple([
  finiteNumberSchema,
  finiteNumberSchema,
  finiteNumberSchema
]);
export const positionSchema = z
  .union([position2Schema, position3Schema])
  .describe('2D or 3D position.');

export const boundsSchema = z
  .tuple([finiteNumberSchema, finiteNumberSchema, finiteNumberSchema, finiteNumberSchema])
  .describe('[minX, minY, maxX, maxY] bounds.');

export const matrix4Schema = z
  .array(finiteNumberSchema)
  .length(16)
  .describe('4x4 matrix represented as a 16-number array.');

export const coordinateSystemSchema = z.union([
  z.enum(['default', 'cartesian', 'lnglat', 'meter-offsets', 'lnglat-offsets']),
  finiteNumberSchema,
  constantReferenceSchema
]);

export const unitSchema = z.enum(['meters', 'common', 'pixels']);

export const callbackReferenceSchema = z
  .union([functionDescriptorSchema, constantReferenceSchema, expressionReferenceSchema])
  .describe('Function-like value resolved by deck.gl JSON conversion.');

export const numericAccessorSchema = z.union([
  finiteNumberSchema,
  expressionReferenceSchema,
  functionDescriptorSchema,
  constantReferenceSchema
]);

export const booleanAccessorSchema = z.union([
  z.boolean(),
  expressionReferenceSchema,
  functionDescriptorSchema,
  constantReferenceSchema
]);

export const stringAccessorSchema = z.union([
  z.string(),
  expressionReferenceSchema,
  functionDescriptorSchema,
  constantReferenceSchema
]);

export const colorAccessorSchema = z.union([
  colorSchema,
  expressionReferenceSchema,
  functionDescriptorSchema,
  constantReferenceSchema
]);

export const positionAccessorSchema = z.union([
  positionSchema,
  expressionReferenceSchema,
  functionDescriptorSchema,
  constantReferenceSchema
]);

export const updateTriggersSchema = z
  .record(z.string(), convertedValueSchema)
  .describe('Map of accessor prop names to values that trigger recalculation.');

export const transitionsSchema = z
  .union([z.boolean(), z.record(z.string(), convertedValueSchema)])
  .describe('Layer transition settings.');

export const parametersSchema = z
  .record(z.string(), convertedValueSchema)
  .describe('luma.gl render parameters.');

export const materialSchema = z.union([
  z.boolean(),
  z.object({}).catchall(convertedValueSchema),
  constantReferenceSchema
]);

export const loadOptionsSchema = z.object({}).catchall(jsonValueSchema);

export const dataAttributeSchema = z.object({}).catchall(convertedValueSchema);

export const layerDataSchema = z.union([
  z.string(),
  z.array(convertedValueSchema),
  z
    .object({
      length: finiteNumberSchema.optional(),
      attributes: z.record(z.string(), dataAttributeSchema).optional()
    })
    .catchall(convertedValueSchema),
  functionDescriptorSchema,
  constantReferenceSchema
]);
