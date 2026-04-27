import {z} from 'zod';

export const jsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export type JsonPrimitive = z.infer<typeof jsonPrimitiveSchema>;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([jsonPrimitiveSchema, z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)])
);

export const typeNameSchema = z.string().min(1).describe('Name resolved from JSONConfiguration.');

export const expressionReferenceSchema = z
  .string()
  .startsWith('@@=')
  .describe('Accessor expression parsed by @deck.gl/json. Example: @@=[lng, lat]');

export const constantReferenceSchema = z
  .string()
  .startsWith('@@#')
  .describe('Constant or enumeration reference resolved from JSONConfiguration.');

export const functionDescriptorSchema = z
  .object({
    '@@function': typeNameSchema
  })
  .catchall(jsonValueSchema)
  .describe('Named function call resolved from JSONConfiguration.functions.');

export const classDescriptorSchema = z
  .object({
    '@@type': typeNameSchema
  })
  .catchall(jsonValueSchema)
  .describe('Class or React component descriptor resolved from JSONConfiguration.');

export const convertedValueSchema = z.union([
  jsonValueSchema,
  expressionReferenceSchema,
  constantReferenceSchema,
  functionDescriptorSchema,
  classDescriptorSchema
]);

export type FunctionDescriptor = z.infer<typeof functionDescriptorSchema>;
export type ClassDescriptor = z.infer<typeof classDescriptorSchema>;
