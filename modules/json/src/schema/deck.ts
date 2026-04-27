import {z} from 'zod';

import {
  classDescriptorSchema,
  convertedValueSchema,
  functionDescriptorSchema,
  jsonValueSchema
} from './conversion';
import {layerDescriptorSchema} from './layer';

export const catalogObjectSchema = z
  .record(z.string(), z.unknown())
  .describe('Runtime catalog map supplied to JSONConfiguration.');

export const deckJsonConfigurationSchema = z
  .object({
    classes: catalogObjectSchema.optional(),
    functions: catalogObjectSchema.optional(),
    enumerations: catalogObjectSchema.optional(),
    constants: catalogObjectSchema.optional(),
    reactComponents: catalogObjectSchema.optional(),
    React: z.unknown().optional(),
    typeKey: z.string().optional(),
    functionKey: z.string().optional(),
    convertFunction: z.unknown().optional(),
    preProcessClassProps: z.unknown().optional(),
    postProcessConvertedJson: z.unknown().optional()
  })
  .passthrough()
  .describe('Plain-object shape accepted by JSONConfiguration and JSONConverter.');

export const viewDescriptorSchema = classDescriptorSchema.describe(
  'Generic deck.gl JSON view descriptor. Detailed view props are added by catalog entries.'
);

export const effectDescriptorSchema = classDescriptorSchema.describe(
  'Generic deck.gl JSON effect descriptor. Detailed effect props are added by catalog entries.'
);

export const deckJsonRootSchema = z
  .object({
    layers: z.array(layerDescriptorSchema),
    views: z.union([viewDescriptorSchema, z.array(viewDescriptorSchema)]).optional(),
    initialViewState: z.record(z.string(), convertedValueSchema).optional(),
    controller: z.union([z.boolean(), convertedValueSchema]).optional(),
    effects: z.array(effectDescriptorSchema).optional(),
    parameters: z.record(z.string(), convertedValueSchema).optional(),
    getTooltip: z.union([functionDescriptorSchema, z.string()]).optional(),
    configuration: deckJsonConfigurationSchema.optional()
  })
  .catchall(jsonValueSchema)
  .describe('Generic deck.gl JSON document passed to JSONConverter.');

export type DeckJsonConfiguration = z.infer<typeof deckJsonConfigurationSchema>;
export type DeckJsonLayerDescriptor = z.infer<typeof layerDescriptorSchema>;
export type DeckJsonViewDescriptor = z.infer<typeof viewDescriptorSchema>;
export type DeckJsonRoot = z.infer<typeof deckJsonRootSchema>;
