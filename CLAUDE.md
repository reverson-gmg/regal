# CLAUDE.md

## Project Overview

This repository manages webhook integration pipelines for automotive dealership data, with two data sources feeding into **Hookdeck -> Xano -> Regal**:

- **Promax DEX** (WebSocket events) — customer profiles, appointments, communications, showroom visits, status changes, notifications
- **Feathery** (form submissions) — lead capture events (vehicle inquiries, appointment bookings, finance applications)

It contains Hookdeck transformation scripts, filter rules, reference documentation, and example payloads that show data at each stage of the pipeline.

## Repository Structure

```
.claude/
  docs/                                    # API schema documentation
    1-promax-raw.md                        # Promax DEX WebSocket event schema (source of truth)
  skills/                                  # Claude skill definitions
    hookdeck/                              # Hookdeck transformation & filter skill
    xano/                                  # XanoScript skill (language, filters, functions)

hookdeck/
  transformations/
    1-promax-raw/                          # Stage 1→2: Promax DEX → Xano (7 handlers)
    3-xano-to-regal-raw/                   # Stage 3→4: Xano → Regal (2 handlers)
  filters/
    1-promax-raw/                          # JSON filter rules (9 filters, one per event type)

examples/                                  # Real-world payload examples at each pipeline stage
  appointment/                             # Sales appointment events (9 states)
  communications/                          # Phone, text, email, note events
  customer/                                # Customer profile events
  lead/                                    # Feathery form submission events (13 types)
  notifications/                           # System events (delete, merge, transfer, other)
  service_appointment/                     # Service appointment events
  showroom_visit/                          # Showroom visit events
  status/                                  # Lead/service status change events
```

## Data Pipeline

### Promax DEX Pipeline (stage 1 → 2 → 3 → 4)

1. **Promax DEX** sends WebSocket events (see `.claude/docs/1-promax-raw.md` for the wire format)
2. **Hookdeck** receives events, applies filters to route them, then runs `1-promax-raw` transformations to reshape payloads into Xano's expected format
3. **Xano** processes the transformed data via backend logic
4. **Hookdeck** runs `3-xano-to-regal-raw` transformations on Xano's output, then sends to **Regal**

### Feathery Pipeline (stage 1 → 2 → 3 → 4)

1. **Feathery** sends form submission webhooks (lead capture events)
2. **Xano** receives and processes the form data
3. **Xano** outputs formatted data
4. **Regal** receives the final contact/event data

> Note: Feathery events are processed by Xano directly (no Hookdeck transformations in this repo). Examples are provided under `examples/lead/` for reference.

## Hookdeck Transformations

- **Runtime:** Sandboxed V8 isolate (no Node.js, no network/filesystem access, 1-second timeout)
- **Language:** JavaScript (ES6)
- **Locations:**
  - `hookdeck/transformations/1-promax-raw/` — Promax DEX → Xano (7 handlers)
  - `hookdeck/transformations/3-xano-to-regal-raw/` — Xano → Regal (2 handlers)
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

1. `1-promax-raw.json` or `1-feathery-raw.json` — Raw source event (Promax DEX WebSocket or Feathery form)
2. `2-xano-formatted.json` — Hookdeck transformation output (sent to Xano)
3. `3-xano-to-regal-raw.json` — Xano processing output (if applicable)
4. `4-regal-formatted.json` — Final Regal API payload (if applicable)

Not all events have all four stages. Customer, status, and service appointment examples typically only have stages 1–2.

## Event Types

### Stage 1→2: Promax DEX → Xano (`hookdeck/transformations/1-promax-raw/`)

| Event | Transformation File | Filter File |
|-------|-------------------|-------------|
| Customer profile | `customer.js` | `customer.json` |
| Sales appointment | `appointments.js` | `appointments.json` |
| Communications | `communications.js` | `communications.json` |
| Showroom visits | `showroom_visits.js` | `showroom_visits.json` |
| Status changes | `status.js` | `status.json` |
| Notifications (other) | `notifications_other.js` | `notification_other.json` |
| Notifications (transfer/delete/merge) | `notifications_transfer_delete_merge.js` | `notification_transfer.json`, `notification_delete.json`, `notification_merge.json` |

### Stage 3→4: Xano → Regal (`hookdeck/transformations/3-xano-to-regal-raw/`)

| Event | Transformation File |
|-------|-------------------|
| Communications | `communications.js` |
| Showroom visits | `showroom_visits.js` |

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
