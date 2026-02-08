# CLAUDE.md

## Project Overview

This repository manages the **Promax DEX -> Hookdeck -> Xano -> Regal** webhook integration pipeline for automotive dealership data. It contains Hookdeck transformation scripts, filter rules, reference documentation, and example payloads that show data at each stage of the pipeline.

## Repository Structure

```
.claude/
  docs/                         # API schema documentation
    1-promax-raw.md             # Promax DEX WebSocket event schema (source of truth)
  skills/                       # Claude skill definitions
    hookdeck/                   # Hookdeck transformation & filter skill
    xano/                       # XanoScript skill (language, filters, functions)

hookdeck/
  transformations/1-promax-raw/ # JavaScript transformation handlers (one per event type)
  filters/1-promax-raw/         # JSON filter rules (one per event type)

examples/                       # Real-world payload examples at each pipeline stage
  appointment/                  # Sales appointment events (9 states)
  communications/               # Phone, text, email, note events
  customer/                     # Customer profile events
  notifications/                # System events (delete, merge, transfer, other)
  service_appointment/          # Service appointment events
  showroom_visit/               # Showroom visit events
  status/                       # Lead/service status change events
```

## Data Pipeline

1. **Promax DEX** sends WebSocket events (see `.claude/docs/1-promax-raw.md` for the wire format)
2. **Hookdeck** receives events, applies filters to route them, then runs transformations to reshape payloads into Xano's expected format
3. **Xano** processes the transformed data via backend logic
4. **Regal** receives the final formatted contact/event data

## Hookdeck Transformations

- **Runtime:** Sandboxed V8 isolate (no Node.js, no network/filesystem access, 1-second timeout)
- **Language:** JavaScript (ES6)
- **Location:** `hookdeck/transformations/1-promax-raw/`
- **Handler signature:** `function handler(request, context) { ... }` — must return a `request` object or call `$transform.fail()`

### Code Conventions

- Configuration constants (`NAMESPACE`, `SCHEMA_VERSION`, `EVENT_NAME`, `MAX_BODY_BYTES`) at the top of each file
- MD5-based deterministic `event_id` generation with namespace prefixing
- Sparse field mapping: only include non-null values in the output
- Field-level metadata tracking: `field_last_received_at` and `field_last_received_by`
- Unicode NFKD normalization for names, E.164 formatting for phone numbers
- PII is separated into dedicated objects (e.g., `promax_customer_sensitive`)
- Null-like string handling: treat `'null'`, `'n/a'`, empty strings as null
- Utility functions are defined inline (no imports available in the V8 sandbox)
- Extensive header comments listing all features with checkmarks

## Hookdeck Filters

- **Format:** Declarative JSON
- **Location:** `hookdeck/filters/1-promax-raw/`
- **Operators:** `$exist`, `$eq`, `$gt`, `$lt`, `$in`, `$startsWith`, `$or`, `$and`, `$not`

## Example Payloads

Each example subdirectory contains numbered files showing the payload at each pipeline stage:

1. `1-promax-raw.json` — Raw WebSocket event from Promax DEX
2. `2-xano-formatted.json` — Hookdeck transformation output (sent to Xano)
3. `3-xano-to-regal.json` — Xano processing output (if applicable)
4. `4-regal-formatted.json` — Final Regal API payload (if applicable)

## Event Types

| Event | Transformation File | Filter File |
|-------|-------------------|-------------|
| Customer profile | `customer.js` | `customer.json` |
| Sales appointment | `appointments.js` | `appointments.json` |
| Communications | `communications.js` | `communications.json` |
| Showroom visits | `showroom_visits.js` | `showroom_visits.json` |
| Status changes | `status.js` | `status.json` |
| Notifications (other) | `notifications_other.js` | `notification_other.json` |
| Notifications (transfer/delete/merge) | `notifications_transfer_delete_merge.js` | `notification_transfer.json`, `notification_delete.json`, `notification_merge.json` |

## Reference Documentation

- **Promax DEX schema:** `.claude/docs/1-promax-raw.md` — Wire format for all 7 WebSocket event categories
- **Hookdeck skill:** `.claude/skills/hookdeck/` — Transformation handler patterns, filter syntax, V8 constraints
- **Xano skill:** `.claude/skills/xano/` — XanoScript language, filters, functions, custom primitives

## Key Patterns to Follow

- When adding a new event type, create both a transformation (`.js`) and filter (`.json`) file
- Add example payloads under `examples/` showing at minimum the raw and transformed stages
- Keep transformation scripts self-contained (all utilities inline, no external imports)
- Use schema versioning — increment `SCHEMA_VERSION` when changing output structure
- Validate all assumptions about incoming data (fields may be null or absent)
- Never expose raw PII; use separate objects or obfuscation for sensitive fields
