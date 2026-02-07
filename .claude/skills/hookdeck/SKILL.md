# Hookdeck Skill

Hookdeck is a webhook infrastructure platform for receiving, processing, and delivering webhooks reliably. This skill covers writing **transformations** and **filters** for Hookdeck connections.

## When to Use Each Sub-File

### [transformations.md](./transformations.md)
Use when the task involves:
- Writing or editing a Hookdeck transformation (JavaScript handler)
- Modifying webhook payloads before delivery (reshaping body, adding/removing headers, rewriting paths or query strings)
- Converting payload formats (XML to JSON, flattening nested structures, unifying models across sources)
- Adding computed properties, normalizing data, or enriching payloads
- Conditionally failing/rejecting events with `$transform.fail()`
- Understanding the V8 isolate execution environment and its constraints

### [filters.md](./filters.md)
Use when the task involves:
- Writing or editing a Hookdeck filter (JSON schema)
- Permitting or blocking events based on body, headers, query, or path content
- Routing events to different destinations using fan-out patterns
- Using comparison operators (`$gt`, `$lt`, `$eq`, `$in`, `$startsWith`, etc.)
- Combining conditions with `$or`, `$and`, `$not`
- Checking field existence with `$exist`

## Shared Context

### Connection Rules
Transformations and filters are both **connection rules**. A connection links a **source** (where webhooks arrive) to a **destination** (where they're delivered). Rules execute in a configurable order, so a transformation can run before or after a filter.

### Execution Order Matters
- If a transformation runs **before** a filter, the filter evaluates the transformed payload.
- If a filter runs **before** a transformation, the filter evaluates the original payload.

### Key Constraints
- Transformations run in a sandboxed V8 isolate with no network/filesystem access and a 1-second timeout.
- Filters are declarative JSON; they have no scripting capability. Use a transformation if you need logic beyond what filter operators support.
- Both transformations and filters can be shared across multiple connections.

### Environment Variables
Transformations support `process.env` for secrets (API keys, tokens). These are configured per-transformation in the Hookdeck UI or API. Filters do not use environment variables.
