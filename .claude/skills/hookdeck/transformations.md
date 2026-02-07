# Hookdeck Transformations

Transformations let you modify webhook payloads using JavaScript (ES6) before delivery to a destination.

## Execution Environment

- **Runtime:** V8 isolate (not Node.js). No access to network, filesystem, or native Node.js APIs.
- **Timeout:** 1 second max execution time.
- **Code size limit:** 5 MB.
- **No async:** Promises and async/await are not supported.
- **Available globals:** `JSON.parse()`, `JSON.stringify()`, `console.log()`, `console.warn()`, `console.error()`, `process.env`.
- **External libraries:** Can be bundled with webpack, but libraries relying on Node.js APIs may need polyfills or may not work at all.

## Handler Function

Every transformation must register a handler using `addHandler`:

```js
addHandler("transform", (request, context) => {
  // Modify request here
  return request;
});
```

### The `request` Object

```typescript
{
  headers: { [key: string]: string };  // HTTP headers (lowercase keys)
  body: string | boolean | number | object | null;  // Parsed payload
  query: string;           // Raw query string
  parsed_query: object;    // Parsed query parameters
  path: string;            // URL path
}
```

You can read and modify any of these properties:

- **`request.body`** - The webhook payload. Usually an object, but can be any JSON-compatible type.
- **`request.headers`** - HTTP headers as key-value pairs. Keys are lowercase.
- **`request.query`** - The raw query string.
- **`request.parsed_query`** - Query string parsed into an object. You can ignore this in return values; Hookdeck regenerates it automatically.
- **`request.path`** - The URL path portion of the request.

### The `context` Object

```js
{
  connection: Connection  // The full connection object (source, destination, rules, etc.)
}
```

Access source/destination info via `context.connection.source.name`, `context.connection.destination.name`, etc.

### Return Value

The handler **must** return a valid request object with a valid `content-type` header. Returning `undefined` or an invalid object will cause a fatal error.

## Failing a Transformation

Use `$transform.fail()` to explicitly reject an event. This prevents the event from being created and delivered.

```js
addHandler("transform", (request, context) => {
  if (!request.body || !request.body.event_type) {
    $transform.fail("Missing required event_type field");
    // Execution stops here; nothing after this runs
  }

  return request;
});
```

When `$transform.fail()` is called:
- The event is not delivered.
- It appears as an ignored event tied to a transformation issue.
- The message passed to `$transform.fail()` is logged for debugging.

## Environment Variables

Access secrets stored in the transformation's configuration via `process.env`:

```js
addHandler("transform", (request, context) => {
  request.headers["x-api-key"] = process.env.API_KEY;
  return request;
});
```

## Logging

Use `console.log()`, `console.warn()`, and `console.error()` for debugging. Logs appear in the transformation execution logs in the Hookdeck dashboard.

- `console.warn()` and `console.error()` will open an Issue in Hookdeck, so use them for genuine problems, not routine logging.

## Construction Process

When building a transformation, follow this process:

1. **Clarify the goal**: What should the payload look like after transformation? What does the input look like?
2. **Identify which parts of the request to modify**: body, headers, query, path, or a combination?
3. **Design the logic**: Map input fields to output fields. Handle edge cases (missing fields, unexpected types, null values).
4. **Write defensively**: Always check that fields exist before accessing nested properties. Use optional chaining or explicit checks.
5. **Keep helper functions outside the handler**: Define utility functions above `addHandler` for clarity and reuse.
6. **Return the full request object**: Always return the complete request, even if you only modified one part.
7. **Use environment variables for secrets**: Never hardcode API keys, tokens, or sensitive values.

## Defensive Coding Patterns

Always write defensively. Hookdeck kills the isolate on uncaught exceptions, resulting in FATAL errors and lost events.

### Null-safe field access

```js
// Bad: crashes if body.order is undefined
const orderId = request.body.order.id;

// Good: optional chaining
const orderId = request.body?.order?.id;

// Good: explicit fallback
const orderId = (request.body.order && request.body.order.id) || null;
```

### Type checking before operations

```js
// Bad: crashes if tags is not an array
const firstTag = request.body.tags[0];

// Good: verify type
const firstTag = Array.isArray(request.body.tags) ? request.body.tags[0] : null;
```

### Safe JSON string parsing

When the body arrives as a JSON string instead of a parsed object:

```js
addHandler("transform", (request, context) => {
  if (typeof request.body === "string") {
    try {
      request.body = JSON.parse(request.body);
    } catch (e) {
      console.error("JSON parse failed:", e.message);
      return request; // Return unmodified rather than crashing
    }
  }

  // Continue with transformation logic...
  return request;
});
```

### Try/catch wrapper to prevent FATAL errors

```js
addHandler("transform", (request, context) => {
  try {
    // Transformation logic here
    request.body.processed = true;
  } catch (e) {
    // Log the error but still return a valid request
    console.error("Transformation error:", e.message);
  }
  return request;
});
```

This pattern ensures the event is still delivered (possibly unmodified) rather than lost to a FATAL error.

## Patterns and Examples

### Add or Modify Headers

```js
addHandler("transform", (request, context) => {
  request.headers["x-custom-header"] = "my-value";
  request.headers["x-source"] = context.connection.source.name;
  return request;
});
```

### Reshape the Body

```js
addHandler("transform", (request, context) => {
  const { body } = request;

  request.body = {
    event_type: body.type,
    customer_id: body.data?.customer?.id || null,
    amount: body.data?.amount_cents / 100,
    currency: body.data?.currency?.toUpperCase(),
    timestamp: body.created_at,
  };

  return request;
});
```

### Conditionally Fail on Invalid Payloads

```js
addHandler("transform", (request, context) => {
  const { body } = request;

  if (!body || typeof body !== "object") {
    $transform.fail("Payload must be a JSON object");
  }

  const requiredFields = ["event_type", "customer_id"];
  for (const field of requiredFields) {
    if (!(field in body)) {
      $transform.fail(`Missing required field: ${field}`);
    }
  }

  return request;
});
```

### Unify Models from Different Sources

```js
const normalizeShopify = (body) => ({
  order_id: body.id,
  email: body.email,
  total: parseFloat(body.total_price),
  currency: body.currency,
  items: body.line_items.map((li) => ({
    sku: li.sku,
    quantity: li.quantity,
    price: parseFloat(li.price),
  })),
});

const normalizeWooCommerce = (body) => ({
  order_id: body.id,
  email: body.billing?.email,
  total: parseFloat(body.total),
  currency: body.currency,
  items: body.line_items.map((li) => ({
    sku: li.sku,
    quantity: li.quantity,
    price: parseFloat(li.price),
  })),
});

addHandler("transform", (request, context) => {
  const sourceName = context.connection.source.name;

  if (sourceName === "shopify") {
    request.body = normalizeShopify(request.body);
  } else if (sourceName === "woocommerce") {
    request.body = normalizeWooCommerce(request.body);
  }

  return request;
});
```

### Add a Computed Property for Downstream Filtering

```js
addHandler("transform", (request, context) => {
  const { body } = request;

  // Tag high-value orders so a downstream filter or app can act on it
  body._is_high_value = body.total_amount > 1000;
  body._source = context.connection.source.name;

  return request;
});
```

### Early Return with Minimal Modification

```js
addHandler("transform", (request, context) => {
  // Only process order events; pass everything else through unchanged
  if (request.body?.type !== "order.created") {
    return request;
  }

  request.body.processed_at = new Date().toISOString();
  return request;
});
```

### Remove Sensitive Headers Before Forwarding

```js
const sensitiveHeaders = ["x-internal-key", "x-debug-token", "x-raw-signature"];

addHandler("transform", (request, context) => {
  for (const header of sensitiveHeaders) {
    delete request.headers[header];
  }
  return request;
});
```

### Redact Sensitive Fields in Body

Recursively replaces values of sensitive keys with `[REDACTED]`:

```js
const sensitiveFields = ["ssn", "social_security", "credit_card", "password", "secret"];

function redactFields(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redactFields);
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveFields.includes(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = redactFields(value);
    }
  }
  return result;
}

addHandler("transform", (request, context) => {
  request.body = redactFields(request.body);
  return request;
});
```

### Flatten Nested Object to Dot-Notation Keys

```js
function flatten(obj, prefix = "") {
  const result = {};
  for (const [key, value] of Object.entries(obj || {})) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flatten(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

addHandler("transform", (request, context) => {
  request.body = flatten(request.body);
  return request;
});
```

### Unflatten Dot-Notation Keys Back to Nested Object

```js
function unflatten(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj || {})) {
    const keys = key.split(".");
    let current = result;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }
  return result;
}

addHandler("transform", (request, context) => {
  request.body = unflatten(request.body);
  return request;
});
```

### Deduplicate Array Items by Key

```js
function deduplicateBy(arr, key) {
  const seen = new Set();
  return arr.filter((item) => {
    const value = item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

addHandler("transform", (request, context) => {
  const body = request.body || {};
  if (Array.isArray(body.events)) {
    body.events = deduplicateBy(body.events, "event_id");
  }
  request.body = body;
  return request;
});
```

## Common Mistakes

1. **Not returning the request**: The handler MUST return a request object. Forgetting the return statement causes a FATAL error and the event is lost.
2. **Accessing nested properties without null checks**: `request.body.deeply.nested.field` crashes the isolate if any segment is undefined. Use optional chaining (`?.`) or explicit checks.
3. **Using async/await or fetch**: The runtime does not support promises or network I/O. All code must be synchronous and self-contained.
4. **Exceeding 1-second timeout**: Complex loops over large arrays or deeply recursive logic can hit the time limit. Keep logic efficient.
5. **Logging warnings/errors for non-issues**: `console.warn` and `console.error` open Issues in Hookdeck even if the transformation succeeds. Use `console.log` for routine debugging.
6. **Hardcoding secrets**: Use `process.env` for API keys, tokens, and sensitive values. Never embed them in transformation code.
7. **Replacing headers without content-type**: If you overwrite `request.headers` entirely, you must include a valid `content-type`. Missing it causes a FATAL error.
8. **Modifying `parsed_query` unnecessarily**: You can safely ignore `parsed_query` in the return. Hookdeck rebuilds it automatically from `query`.

## Debugging Transformations

When a transformation isn't working or is throwing FATAL errors:

1. **Check the execution logs** in the Hookdeck dashboard:
   - **Input tab**: The raw request before transformation
   - **Output tab**: The request after transformation
   - **Diff tab**: What changed between input and output
   - **Console section**: Any `console.log`/`warn`/`error` output
2. **Check for common issues**:
   - Missing return statement
   - Accessing nested properties without null checks
   - Using async/await or promises
   - Attempting I/O (network, filesystem)
   - Exceeding execution time on large payloads
   - Invalid or missing `content-type` header in the returned request
   - Referencing `context.connection` properties that may not exist
3. **Check for lost events**: If events are missing, look for Ignored Events in the associated Issue. Hookdeck tracks events that failed due to FATAL transformation errors, and they can be retried after fixing the code.
4. **Use `console.log` liberally** during development to inspect values:

```js
addHandler("transform", (request, context) => {
  console.log("Body type:", typeof request.body);
  console.log("Body keys:", Object.keys(request.body || {}));
  console.log("Source:", context.connection.source.name);
  // ... transformation logic
  return request;
});
```
