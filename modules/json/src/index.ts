export {
  createDeckJsonCatalog,
  deckJsonCatalog,
  getDeckJsonSchema,
  getDeckJsonZodSchema
} from './schema/catalog';
export type {
  DeckJsonCatalog,
  DeckJsonCatalogDefinition,
  DeckJsonCatalogEntry,
  DeckJsonSchemaKind,
  JsonSchema
} from './schema/catalog';

export {
  deckJsonConfigurationSchema,
  deckJsonRootSchema,
  effectDescriptorSchema,
  viewDescriptorSchema
} from './schema/deck';
export type {
  DeckJsonConfiguration,
  DeckJsonLayerDescriptor,
  DeckJsonRoot,
  DeckJsonViewDescriptor
} from './schema/deck';

export {
  baseCompositeLayerPropsSchema,
  baseLayerPropsSchema,
  dataDiffRangeSchema,
  layerDescriptorSchema
} from './schema/layer';
export type {BaseCompositeLayerProps, BaseLayerProps} from './schema/layer';

export {
  booleanAccessorSchema,
  boundsSchema,
  callbackReferenceSchema,
  colorAccessorSchema,
  colorSchema,
  coordinateSystemSchema,
  dataAttributeSchema,
  finiteNumberSchema,
  layerDataSchema,
  loadOptionsSchema,
  materialSchema,
  matrix4Schema,
  numericAccessorSchema,
  parametersSchema,
  position2Schema,
  position3Schema,
  positionAccessorSchema,
  positionSchema,
  stringAccessorSchema,
  transitionsSchema,
  unitSchema,
  updateTriggersSchema
} from './schema/primitives';

export {
  classDescriptorSchema,
  constantReferenceSchema,
  convertedValueSchema,
  expressionReferenceSchema,
  functionDescriptorSchema,
  jsonPrimitiveSchema,
  jsonValueSchema,
  typeNameSchema
} from './schema/conversion';
export type {
  ClassDescriptor,
  FunctionDescriptor,
  JsonPrimitive,
  JsonValue
} from './schema/conversion';
