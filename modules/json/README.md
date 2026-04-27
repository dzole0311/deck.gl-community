# @deck.gl-community/json

Experimental schema utilities for deck.gl JSON specifications.

This module is intended to be optional: applications import it when they want schema validation, JSON Schema generation, editor integration, or LLM-facing guidance for deck.gl JSON. Other deck.gl-community modules should not depend on it.

The first implementation slice defines the generic deck.gl JSON descriptor grammar and an extensible catalog API. Detailed layer prop schemas are expected to land incrementally in follow-up changes.

## Current Scope

- Generic `@@type` class descriptors
- Generic `@@function` function descriptors
- `@@=` expression references
- `@@#` constant or enumeration references
- Generic root deck JSON schema
- Shared schema primitives for colors, positions, accessors, units, parameters, transitions, and data bindings
- Base `Layer` and `CompositeLayer` prop schemas
- Isolated catalog creation via `createDeckJsonCatalog`
- JSON Schema generation from Zod schemas

## Out Of Scope For This Slice

- Editable layer integration
- GeoJSON data schemas
- GeoArrow layer schemas
- Exhaustive layer prop coverage
