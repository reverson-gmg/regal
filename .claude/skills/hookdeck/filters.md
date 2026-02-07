# Hookdeck Filters

Filters are declarative JSON rules that permit or block events based on the contents of their **Body**, **Headers**, **Query**, or **Path**. Events that do not match the filter are silently discarded (they will not appear in your events list).

## Core Concept

A filter defines what **should pass through**. If an event matches the filter, it is delivered. If it does not match, it is ignored.

Filters are applied per-section (body, headers, query, path). Each section is evaluated independently; all must pass for the event to be delivered.

## Construction Process

When building a filter, follow this process:

1. **Identify the goal**: What events should pass through? What should be blocked?
2. **Determine the target(s)**: Body, Headers, Path, or Query?
3. **Map the payload structure**: Identify the relevant fields and their nesting depth.
4. **Choose the approach**: Allowlist (match what you want) vs. blocklist (`$not` what you don't want). Prefer allowlist when the set of desired events is small and well-defined. Prefer blocklist when you want most events except a few.
5. **Select operators**: Pick the simplest operators that achieve the goal. Avoid over-engineering.
6. **Compose the filter**: Build from the inside out. Start with the innermost condition, then wrap with operators.

## Simple Matching

### Exact Value Match

Match a top-level or nested property by specifying its expected value:

```json
{
  "type": "order.created"
}
```

This passes events where `body.type === "order.created"`.

### Nested Object Match

```json
{
  "data": {
    "customer": {
      "status": "active"
    }
  }
}
```

Matches when `body.data.customer.status === "active"`. Other properties in the payload are ignored.

### Array Contains Match

Match if an array field contains a specific value:

```json
{
  "tags": "important"
}
```

Passes if `body.tags` is an array that includes `"important"`.

### Array Contains Multiple Values

Match if an array contains **all** specified values:

```json
{
  "tags": ["important", "urgent"]
}
```

Passes only if `body.tags` contains both `"important"` and `"urgent"`.

## Operators

### Comparison Operators

| Operator | Types | Description |
|----------|-------|-------------|
| `$eq` | array, number, object, string | Equal (deep equal for objects/arrays) |
| `$neq` | array, number, object, string | Not equal |
| `$gt` | number, string | Greater than |
| `$gte` | number, string | Greater than or equal to |
| `$lt` | number, string | Less than |
| `$lte` | number, string | Less than or equal to |

**Example: numeric comparison**
```json
{
  "order": {
    "total": { "$gte": 100 }
  }
}
```

### String Operators

| Operator | Description |
|----------|-------------|
| `$in` | String contains substring |
| `$nin` | String does not contain substring |
| `$startsWith` | Starts with text |
| `$endsWith` | Ends with text |

**Example: string contains**
```json
{
  "event_type": { "$in": "order" }
}
```
Matches `"order.created"`, `"order.updated"`, `"new_order"`, etc.

**Example: starts with**
```json
{
  "event_type": { "$startsWith": "customer." }
}
```

### Array Operators

| Operator | Description |
|----------|-------------|
| `$in` | Array contains value |
| `$nin` | Array does not contain value |

**Example: array contains**
```json
{
  "roles": { "$in": "admin" }
}
```

**Example: array does not contain**
```json
{
  "tags": { "$nin": "spam" }
}
```

> **Array equality vs. contains**: `{ "tags": "gift" }` checks if the array *contains* `"gift"`. To check if the array is *exactly* `["gift"]`, use `{ "tags": { "$eq": ["gift"] } }`.

### Existence Operator

| Operator | Description |
|----------|-------------|
| `$exist` | `true` = field must exist, `false` = field must not exist |

**Example:**
```json
{
  "metadata": { "$exist": true },
  "deleted_at": { "$exist": false }
}
```

> **`$exist: false` vs. null**: `$exist: false` matches when the key is completely absent (undefined), not when its value is `null`. To match null, use `{ "field": null }`.

**Example: existence + value combo** (field must exist AND match a pattern):
```json
{
  "callback_url": {
    "$exist": true,
    "$startsWith": "https://"
  }
}
```

### Boolean / Logical Operators

#### `$or` - Match any condition

```json
{
  "status": {
    "$or": ["active", "pending"]
  }
}
```

`$or` can also combine entire filter objects:

```json
{
  "$or": [
    { "type": "order.created" },
    { "type": "order.updated" }
  ]
}
```

#### `$and` - Match all conditions

```json
{
  "amount": {
    "$and": [
      { "$gte": 100 },
      { "$lte": 500 }
    ]
  }
}
```

**Shorthand**: Multiple operators on a single field are implicitly ANDed, so this is equivalent:

```json
{
  "amount": {
    "$gte": 100,
    "$lte": 500
  }
}
```

#### `$not` - Negate a condition

```json
{
  "$not": {
    "status": "deleted"
  }
}
```

### Reference Operator (`$ref`)

Compare a field against another field in the same payload:

```json
{
  "updated_at": {
    "$neq": { "$ref": "created_at" }
  }
}
```

Nested paths work: `"$ref": "data.customer.id"`

Array index references work: `"$ref": "items[0].sku"`

Dynamic index with `$index` for array iteration: `"$ref": "variants[$index].created_at"`

`$ref` combines with other operators:
```json
{
  "inventory": {
    "$lt": { "$ref": "reorder_threshold" }
  }
}
```

## Non-Object / Path Matching

When filtering on `path` or a non-object body, treat the value as the root:

```json
{
  "$in": "/webhooks"
}
```

This matches any path containing `"/webhooks"`.

**Exclude a path:**
```json
{
  "$not": {
    "$in": "/health"
  }
}
```

## Routing Pattern Examples

### Allow Only Specific Event Types

```json
{
  "event_type": {
    "$or": ["order.created", "order.updated", "order.completed"]
  }
}
```

### Block Specific Event Subtypes

```json
{
  "$not": {
    "event": {
      "subtype": {
        "$or": ["message_changed", "message_deleted"]
      }
    }
  }
}
```

### Combine Positive and Negative Conditions

Allow `type = "message"` but exclude certain subtypes and team IDs:

```json
{
  "event": {
    "type": "message"
  },
  "$not": {
    "$or": [
      {
        "event": {
          "subtype": { "$or": ["message_changed", "message_deleted"] }
        }
      },
      {
        "team_id": { "$or": ["team1", "team2"] }
      }
    ]
  }
}
```

### Filter by Header Value

Apply this filter on the **Headers** tab:

```json
{
  "x-webhook-source": "stripe"
}
```

### High-Value Order Routing

Route only high-value orders to a specific destination:

```json
{
  "event_type": "order.created",
  "data": {
    "total_amount": { "$gte": 1000 }
  }
}
```

### Fan-Out: Route by Region

Create multiple connections from the same source, each with a different filter:

**Connection A (US orders):**
```json
{
  "data": {
    "shipping_country": { "$or": ["US", "CA"] }
  }
}
```

**Connection B (EU orders):**
```json
{
  "data": {
    "shipping_country": { "$or": ["DE", "FR", "GB", "IT", "ES"] }
  }
}
```

### Only Pass Events Where a Field Changed

Using `$ref` to compare current vs. previous values:

```json
{
  "data": {
    "status": {
      "$neq": { "$ref": "data.previous_status" }
    }
  }
}
```

## Common Mistakes

1. **Forgetting implicit AND**: Multiple top-level keys in a filter are ANDed. If you want OR across different fields, use `{ "$or": [ {cond1}, {cond2} ] }`.
2. **`$not` at wrong nesting level**: `$not` negates whatever schema is inside it. Placing it one level too high or too low changes semantics entirely. Always wrap the complete condition you want to negate.
3. **`$or` on one field vs. across fields**: `{ "field": { "$or": ["a", "b"] } }` checks one field against multiple values. `{ "$or": [ {"field1": "a"}, {"field2": "b"} ] }` checks across different fields.
4. **Confusing `$exist` with null**: `$exist: false` means the key is completely absent, not that its value is `null`. To match null, use `{ "field": null }`.
5. **Array equality vs. contains**: `{ "tags": "gift" }` checks if the array contains `"gift"`. `{ "tags": { "$eq": ["gift"] } }` checks if the array is exactly `["gift"]`.
6. **Filtering on post-transformation fields**: If your filter references a field that only exists after a transformation, the transformation must run first. Check the rule execution order in connection settings.

## Debugging Filters

When a filter isn't working as expected:

1. **Get the filter JSON and a sample payload** (or the expected behavior description).
2. **Check for common issues**:
   - Incorrect nesting depth (one level too deep or too shallow)
   - Wrong operator for the data type (e.g., `$gt` on a non-numeric string)
   - Implicit AND when OR was intended (or vice versa)
   - `$not` placed at the wrong level
   - Missing field path segments in nested objects
   - Rule ordering: filter runs before a transformation that creates the field being filtered on
3. **Use the Hookdeck UI test tool**: Edit the payload in the left pane, click "Test Filter," and verify pass/fail per section (Body, Headers, Path, Query).

## Tips

1. **Filters define what passes, not what gets blocked.** To block a specific event type, wrap the condition in `$not`.
2. **Filters are JSON only.** For complex logic (regex-like matching, computed conditions, payload parsing), use a transformation to add a computed property, then filter on that property.
3. **All filter sections must pass.** If you set filters on both Body and Headers, both must match for the event to be delivered.
4. **Order matters with transformations.** If a transformation runs before the filter, the filter sees the transformed payload. Configure execution order in the connection rules.
