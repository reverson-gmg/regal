# XanoScript Language Basics

## Primitives

Every XanoScript component follows a five-part structure:

```
<type> <name> {
  description = "..."

  input {
    <type> <field_name>
  }

  stack {
    // logic here
  }

  response = <value>

  // settings
  tags = ["tag1"]
  history = {inherit: true}
}
```

For authenticated primitives, add `auth = "user"` inside the declaration block.

---

## Input Types

Inputs define the data a primitive accepts. The `input` block declaration is mandatory even if empty.

### Available Types

| Type | Syntax | Description |
|------|--------|-------------|
| `int` | `int id` | Whole numbers |
| `text` | `text name` | String data |
| `email` | `email user_email` | Email addresses |
| `password` | `password user_pass` | Password fields |
| `bool` | `bool active` | True/false |
| `decimal` | `decimal price` | Precise decimals |
| `timestamp` | `timestamp created_at` | Date-time (milliseconds) |
| `date` | `date birth_date` | Calendar date (no time) |
| `enum` | `enum status {values=["active","inactive"]}` | Predefined set |
| `object` | `object address {schema={}}` | Nested structured data |
| `json` | `json metadata` | Flexible unstructured data |
| `uuid` | `uuid session_id` | Universally unique ID |
| `image` | `image avatar` | Image file |
| `video` | `video recording` | Video file |
| `audio` | `audio message` | Audio file |
| `attachment` | `attachment document` | Generic file |
| `vector` | `vector embedding` | ML embedding |

### Input Modifiers

```
text name                    // Required, non-nullable
text name?                   // Optional, non-nullable
text? name                   // Required, nullable
?text? name                  // Required, nullable (alternative)
text name?="default"         // Optional with default value

text[] tags                  // Array/list input
text email filters=trim|lower  // Input filters applied on receipt
int user_id { dbtable = "users" }  // Table reference
```

### Input Validation Filters

Apply at the input boundary to validate and transform data before it enters the stack:

```
input {
  text name filters=trim                          // Remove whitespace
  email email filters=trim|lower                  // Trim + lowercase
  password password filters=min:8|minAlpha:1|minDigit:1  // Password rules
  text slug filters=trim|lower|alphaOk|digitOk    // Allow only alphanumeric
  int page filters=default:1                       // Default value
}
```

Available validation filters: `min:n`, `max:n`, `minAlpha:n`, `minDigit:n`, `trim`, `lower`, `upper`, `alphaOk`, `digitOk`, `ok:chars`, `startsWith:prefix`, `prevent:blacklist`, `pattern:regex`, `default:value`

---

## Variables

### Create

```
var myVar {
  value = "Hello world"
}

var count {
  value = 42
}

// CRITICAL: arrays and objects require json_decode
var items {
  value = "[1, 2, 3]"|json_decode
}

var config {
  value = '{"key": "value"}' |json_decode
}
```

### Update

```
var.update $myVar {
  value = "New value"
}
```

The `$` prefix is required when referencing an existing variable.

---

## Dot Notation

Navigate nested data:

```
$user.name            // Object property
$users.0              // Array index (0-based)
$user.address.city    // Deep nesting
$order.items.0.sku    // Array element property
```

---

## Expressions

Conditions and computations use backtick-wrapped expressions.

Single-line:
```
`$price * $quantity`
`$user.role == "admin"`
`$count > 0 && $status == "active"`
```

Multi-line (triple backticks):
```
```
$base_price * $quantity
+ $shipping_cost
- $discount
```
```

**Operators:** `+`, `-`, `*`, `/`, `%`, `==`, `!=`, `>`, `<`, `>=`, `<=`, `&&`, `||`

---

## Conditionals

### If / Elseif / Else

```
conditional {
  if (`$user.role == "admin"`) {
    var $access { value = "full" }
  }
  elseif (`$user.role == "editor"`) {
    var $access { value = "write" }
  }
  else {
    var $access { value = "read" }
  }
}
```

Compound conditions:
```
conditional {
  if (`$user.role == "admin" && $user.active == true`) {
    // ...
  }
  if (`$status == "draft" || $status == "review"`) {
    // ...
  }
}
```

### Switch / Case

```
switch ($status) {
  case ("active") {
    debug.log { value = "Active" }
  } break

  case ("pending") {
    debug.log { value = "Pending" }
  } break

  default {
    debug.log { value = "Unknown" }
  }
}
```

Every `case` block **must** end with `break`. `default` is optional.

---

## Loops

### ForEach (iterate a collection)

```
foreach ($users) {
  each as $user {
    debug.log { value = $user.name }
  }
}
```

### For (fixed iterations)

```
for (`$count`) {
  each as $index {
    debug.log { value = $index }
  }
}
```

### While (condition-based)

```
while (`$retries < 3 && $success == false`) {
  each {
    // attempt operation
    math.add $retries { value = 1 }
  }
}
```

### Loop Control

```
break       // Exit loop immediately
continue    // Skip to next iteration
```

### Real-World Loop Pattern: Build a Summary from Records

```
db.query order {
  where = $db.order.user_id == $input.user_id
  return = {type: "list"}
} as $orders

var $total_revenue {
  value = 0
}
var $order_summaries {
  value = "[]"|json_decode
}

foreach ($orders) {
  each as $order {
    math.add $total_revenue { value = $order.amount }
    array.push $order_summaries {
      value = '{}' |json_decode
        |set:"id":$order.id
        |set:"amount":$order.amount
        |set:"date":$order.created_at|format_timestamp:"Y-m-d":"UTC"
    }
  }
}
```

---

## Responses

```
// Return a single value
response = $result

// Return a shaped object
response = {
  user: $user|unpick:["password"],
  token: $authToken
}
```

---

## Settings

```
description = "Fetches active users with pagination"
tags = ["users", "public"]
auth = "user"
history = {inherit: true}

cache = {
  ttl: 300,           // Seconds. 0 = disabled.
  input: true,        // Include request body/query in cache key
  auth: true,         // Include auth state in cache key
  datasource: true,   // Include datasource in cache key
  ip: false,          // Include client IP in cache key
  headers: ["x-tenant-id"],  // Specific headers in cache key
  env: ["FEATURE_FLAG"]      // Env vars in cache key
}
```

---

## Database Table Definitions

Tables follow a four-part structure: **Schema, Indexes, Views, Settings.**

```
// User accounts table with authentication
table user {
  auth = true

  schema {
    int id
    timestamp created_at?=now
    text name filters=trim
    email email filters=trim|lower
    password password filters=min:8|minAlpha:1|minDigit:1
    enum role {values=["user","admin"]}?="user"
    bool active?=true
    timestamp? last_login
    int[] user_photos? { table = "photo" }   // Relationship to photo table
  }

  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree|unique", field: [{name: "email", op: "asc"}]}
    {type: "btree", field: [{name: "created_at", op: "desc"}]}
    {type: "btree", field: [{name: "role", op: "asc"}, {name: "active", op: "asc"}]}
  ]

  views = {
    public_profile: {
      alias: "sql_public_user"
      hide: ["password", "email"]
      sort: {id: "asc"}
    }
  }

  tags = ["user data", "auth"]
}
```

### Field Modifiers in Schema

| Modifier | Meaning | Example |
|----------|---------|---------|
| `field` | Required, non-nullable | `text name` |
| `field?` | Optional, non-nullable | `text bio?` |
| `?field` | Required, nullable | `?timestamp deleted_at` |
| `field?=value` | Optional with default | `bool active?=true` |
| `field filters=...` | Validation/transformation | `email email filters=trim\|lower` |
| `type[] field { table = "x" }` | Relationship (foreign key) | `int[] posts { table = "post" }` |

### Index Types

| Type | Purpose |
|------|---------|
| `primary` | Primary key (required, one per table) |
| `btree` | Standard sorted index for equality and range queries |
| `gin` | Generalized inverted index for full-text search, arrays, JSONB |
| `btree\|unique` | Unique constraint + index |

### Views

Views define filtered representations of the table for API responses:

```
views = {
  <view_name>: {
    alias: "<sql_alias>"       // SQL-accessible name
    hide: ["field1", "field2"] // Fields to exclude
    sort: {field: "asc|desc"}  // Default sort
    id: "<uuid>"               // Optional stable ID
  }
}
```

---

## Addons

Addons are reusable database query components that can be attached to other queries. They can **only** contain database operations.

```
addon recent_comments {
  input {
    int user_id?
  }

  stack {
    db.query comment {
      where = $db.comment.user_id == $input.user_id
      sort = {comment.created_at: "desc"}
      return = {type: "list", paging: {per_page: 10}}
    }
  }

  tags = ["database", "comments"]
}
```

Addons automatically return whatever the database query returns — no `response` block needed.

**Important:** Addons must be defined before they can be referenced in other database queries.

---

## AI Agents

Agents combine LLM configuration with callable tools for autonomous workflows.

```
agent "Customer Support" {
  canonical = "SUPPORT_001"
  tags = ["support"]

  llm = {
    type: "anthropic"
    system_prompt: "You are a helpful support agent. Look up user info before responding."
    max_steps: 8
    prompt: "Customer says: {{ $args.message }}"
    api_key: "{{ $env.ANTHROPIC_KEY }}"
    model: "claude-sonnet-4-5-20250929"
    temperature: 0.3
  }

  tools = [
    {name: "Get_User_Info"}
    {name: "Create_Support_Ticket"}
    {name: "Search_Knowledge_Base"}
  ]
}
```

### LLM Providers

| Provider | `type` value | Required Fields |
|----------|-------------|-----------------|
| Anthropic | `"anthropic"` | `api_key`, `model` |
| OpenAI | `"openai"` | `api_key`, `model` |
| Google AI | `"google-genai"` | `api_key`, `model` |
| Xano Free (Gemini) | `"xano-free"` | None |

### Provider-Specific Options

- **Anthropic**: `temperature`, `reasoning`
- **OpenAI**: `temperature`, `reasoning_effort`, `organization`, `project`, `compatibility`
- **Google/Xano Free**: `temperature`, `search_grounding`, `thinking_tokens`, `include_thoughts`

### Dynamic Data in Prompts

Use `{{ $args.property }}` for arguments and `{{ $env.VAR }}` for environment variables within prompt and system_prompt strings.

---

## Workspace Settings

```
// Production workspace configuration
workspace "My App" {
  acceptance = {ai_terms: true}
  preferences = {
    internal_docs: false
    track_performance: true     // Capture execution metrics
    sql_names: false            // Custom SQL identifiers
    sql_columns: true           // Individual columns vs JSONB
  }
}
```

---

## Common Mistakes

1. **Forgetting `json_decode` for complex values.** This is the #1 XanoScript mistake.
   ```
   // WRONG — assigns the literal string "[1,2,3]"
   var items { value = "[1,2,3]" }

   // RIGHT — creates an actual array
   var items { value = "[1,2,3]"|json_decode }
   ```

2. **Missing `$` when referencing variables.**
   ```
   // WRONG — "myVar" is a literal string
   var.update myVar { value = 10 }

   // RIGHT
   var.update $myVar { value = 10 }
   ```

3. **Omitting backticks in conditions.**
   ```
   // WRONG
   conditional {
     if ($age >= 18) { ... }
   }

   // RIGHT
   conditional {
     if (`$age >= 18`) { ... }
   }
   ```

4. **Forgetting `break` in switch cases.** Without `break`, execution falls through to the next case.

5. **Not capturing results with `as`.** Every function that produces output needs `as $variable` to capture it.

6. **Using `var` when you mean `var.update`.** `var` creates a new variable. To modify an existing one, use `var.update $existingVar`.

7. **Accessing nested properties on null.** If `db.get` returns null, accessing `$result.name` crashes. Always use `precondition` to check first:
   ```
   db.get user {
     field_name = "id"
     field_value = $input.user_id
   } as $user

   precondition {
     conditions = `$user|is_not_null`
     type = "notfound"
     message = "User not found"
   }

   // Now safe to access $user.name
   ```

8. **Wrong field modifier syntax.** `text? name` (nullable type) vs `text name?` (optional field) mean different things. Choose based on whether you need the field to be nullable or optional.

---

## Debugging

1. **Use `debug.log` liberally** during development to inspect values at any point in the stack:
   ```
   debug.log { value = $user }
   debug.log { value = $items|count }
   debug.log { value = "checkpoint: past validation" }
   ```

2. **Use `stop_and_debug`** to halt execution and return the current state of any variable:
   ```
   stop_and_debug { value = $suspiciousVariable }
   ```

3. **Use `precondition` to surface specific errors** instead of letting things fail silently:
   ```
   precondition {
     conditions = `$response.status|equals:200`
     type = "badrequest"
     message = "External API returned non-200"
     payload = {status: $response.status, body: $response.body}
   }
   ```

4. **Wrap risky operations in `try_catch`** to see the error without crashing:
   ```
   try_catch {
     try {
       api.request { url = "https://flaky-api.com/data", method = "GET" } as $data
     }
     catch ($error) {
       debug.log { value = $error }
       var $data { value = '{"fallback": true}'|json_decode }
     }
   }
   ```

5. **Check your datasource.** If data looks wrong, confirm you're querying the right datasource (`live` vs `draft`). Use `util.set_datasource` to switch explicitly.

6. **Inspect variable types.** Use type-check filters in debug logs: `$value|is_array`, `$value|is_object`, `$value|is_null`, `$value|is_text`.

---

## Defensive Patterns

### Always validate database lookups

```
db.get user {
  field_name = "id"
  field_value = $input.user_id
} as $user

precondition {
  conditions = `$user|is_not_null`
  type = "notfound"
  message = "User not found"
}
```

### Always validate ownership before mutations

```
db.get post {
  field_name = "id"
  field_value = $input.post_id
} as $post

precondition {
  conditions = `$post|is_not_null`
  type = "notfound"
  message = "Post not found"
}

precondition {
  conditions = `$post.user_id == $auth.id`
  type = "accessdenied"
  message = "You do not own this post"
}

// Now safe to edit
db.edit post {
  field_name = "id"
  field_value = $input.post_id
  data = { title: $input.title }
}
```

### Build objects safely with `set` filter

Instead of inline JSON (which can break with null values), build objects using the `set` filter:

```
var $response_obj {
  value = "{}"|json_decode
    |set:"id":$user.id
    |set:"name":$user.name
    |set_ifnotnull:"avatar":$user.avatar
    |set:"role":$user.role
}
```

### Default values for optional inputs

```
var $page {
  value = $input.page|coalesce:1
}
var $per_page {
  value = $input.per_page|coalesce:25
}
```

### Safe array iteration

Check that a value is actually an array before looping:

```
conditional {
  if (`$data.items|is_array && $data.items|count > 0`) {
    foreach ($data.items) {
      each as $item {
        // process
      }
    }
  }
}
```
