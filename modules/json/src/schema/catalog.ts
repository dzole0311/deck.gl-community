import {toJSONSchema, z} from 'zod';

import {
  deckJsonConfigurationSchema,
  deckJsonRootSchema,
  effectDescriptorSchema,
  viewDescriptorSchema
} from './deck';
import {layerDescriptorSchema} from './layer';

export type DeckJsonSchemaKind =
  | 'layer'
  | 'view'
  | 'controller'
  | 'effect'
  | 'extension'
  | 'dataSource'
  | 'constant'
  | 'enumeration'
  | 'function'
  | 'root'
  | 'configuration';

export type JsonSchema = Record<string, unknown>;

export type DeckJsonCatalogEntry<TSchema extends z.ZodTypeAny = z.ZodTypeAny> = {
  /** Public type token used in deck.gl JSON, e.g. `ScatterplotLayer` or `MapView`. */
  type: string;
  /** Which registry bucket this schema belongs to. */
  kind: DeckJsonSchemaKind;
  /** Zod schema for validation and JSON Schema generation. */
  schema: TSchema;
  /** Optional package/module hint for docs, playgrounds and LLM context. */
  module?: string;
  /** Optional short human-readable description. */
  description?: string;
};

export type DeckJsonCatalogDefinition = {
  layers?: DeckJsonCatalogEntry[];
  views?: DeckJsonCatalogEntry[];
  controllers?: DeckJsonCatalogEntry[];
  effects?: DeckJsonCatalogEntry[];
  extensions?: DeckJsonCatalogEntry[];
  dataSources?: DeckJsonCatalogEntry[];
  constants?: DeckJsonCatalogEntry[];
  enumerations?: DeckJsonCatalogEntry[];
  functions?: DeckJsonCatalogEntry[];
};

export type DeckJsonCatalog = {
  layers: ReadonlyMap<string, DeckJsonCatalogEntry>;
  views: ReadonlyMap<string, DeckJsonCatalogEntry>;
  controllers: ReadonlyMap<string, DeckJsonCatalogEntry>;
  effects: ReadonlyMap<string, DeckJsonCatalogEntry>;
  extensions: ReadonlyMap<string, DeckJsonCatalogEntry>;
  dataSources: ReadonlyMap<string, DeckJsonCatalogEntry>;
  constants: ReadonlyMap<string, DeckJsonCatalogEntry>;
  enumerations: ReadonlyMap<string, DeckJsonCatalogEntry>;
  functions: ReadonlyMap<string, DeckJsonCatalogEntry>;
  rootSchema: typeof deckJsonRootSchema;
  configurationSchema: typeof deckJsonConfigurationSchema;
  getEntry: (kind: DeckJsonSchemaKind, type: string) => DeckJsonCatalogEntry | undefined;
  getSchema: (kind: DeckJsonSchemaKind, type?: string) => z.ZodTypeAny;
  getJsonSchema: (kind?: DeckJsonSchemaKind, type?: string) => JsonSchema;
};

function toMap(entries: DeckJsonCatalogEntry[] = []): Map<string, DeckJsonCatalogEntry> {
  return new Map(entries.map(entry => [entry.type, entry]));
}

function schemaToJsonSchema(schema: z.ZodTypeAny, name: string): JsonSchema {
  const jsonSchema = toJSONSchema(schema, {
    target: 'draft-7'
  }) as JsonSchema;

  return {
    title: name,
    ...jsonSchema
  };
}

function entriesToUnion(entries: ReadonlyMap<string, DeckJsonCatalogEntry>): z.ZodTypeAny {
  const schemas = Array.from(entries.values(), entry => entry.schema);

  if (schemas.length === 0) {
    return z.never();
  }

  if (schemas.length === 1) {
    return schemas[0];
  }

  return z.union(schemas as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
}

export function createDeckJsonCatalog(definition: DeckJsonCatalogDefinition = {}): DeckJsonCatalog {
  const layers = toMap(definition.layers);
  const views = toMap(definition.views);
  const controllers = toMap(definition.controllers);
  const effects = toMap(definition.effects);
  const extensions = toMap(definition.extensions);
  const dataSources = toMap(definition.dataSources);
  const constants = toMap(definition.constants);
  const enumerations = toMap(definition.enumerations);
  const functions = toMap(definition.functions);

  function getEntry(kind: DeckJsonSchemaKind, type: string): DeckJsonCatalogEntry | undefined {
    switch (kind) {
      case 'layer':
        return layers.get(type);
      case 'view':
        return views.get(type);
      case 'controller':
        return controllers.get(type);
      case 'effect':
        return effects.get(type);
      case 'extension':
        return extensions.get(type);
      case 'dataSource':
        return dataSources.get(type);
      case 'constant':
        return constants.get(type);
      case 'enumeration':
        return enumerations.get(type);
      case 'function':
        return functions.get(type);
      default:
        return undefined;
    }
  }

  function getSchema(kind: DeckJsonSchemaKind, type?: string): z.ZodTypeAny {
    if (type) {
      const entry = getEntry(kind, type);
      if (!entry) {
        throw new Error(`No ${kind} schema registered for ${type}`);
      }
      return entry.schema;
    }

    switch (kind) {
      case 'layer':
        return layerDescriptorSchema;
      case 'view':
        return viewDescriptorSchema;
      case 'effect':
        return effectDescriptorSchema;
      case 'root':
        return deckJsonRootSchema;
      case 'configuration':
        return deckJsonConfigurationSchema;
      case 'controller':
        return entriesToUnion(controllers);
      case 'extension':
        return entriesToUnion(extensions);
      case 'dataSource':
        return entriesToUnion(dataSources);
      case 'constant':
        return entriesToUnion(constants);
      case 'enumeration':
        return entriesToUnion(enumerations);
      case 'function':
        return entriesToUnion(functions);
      default:
        throw new Error(`Unsupported schema kind ${kind}`);
    }
  }

  function getJsonSchema(kind: DeckJsonSchemaKind = 'root', type?: string): JsonSchema {
    const schema = getSchema(kind, type);
    const name = type ?? `DeckJson${kind[0].toUpperCase()}${kind.slice(1)}`;
    return schemaToJsonSchema(schema, name);
  }

  return {
    layers,
    views,
    controllers,
    effects,
    extensions,
    dataSources,
    constants,
    enumerations,
    functions,
    rootSchema: deckJsonRootSchema,
    configurationSchema: deckJsonConfigurationSchema,
    getEntry,
    getSchema,
    getJsonSchema
  };
}

export const deckJsonCatalog = createDeckJsonCatalog();

export function getDeckJsonZodSchema(
  kind: DeckJsonSchemaKind = 'root',
  type?: string
): z.ZodTypeAny {
  return deckJsonCatalog.getSchema(kind, type);
}

export function getDeckJsonSchema(kind: DeckJsonSchemaKind = 'root', type?: string): JsonSchema {
  return deckJsonCatalog.getJsonSchema(kind, type);
}
