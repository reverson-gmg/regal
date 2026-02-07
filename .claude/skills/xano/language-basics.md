# XanoScript Language Basics

## Primitives

Primitives are the top-level building blocks (APIs, custom functions, tasks, triggers, etc.). Every primitive follows this structure:

```
<type> <name> {
  description = "..."

  input {
    <type> <name>
  }

  stack {
    // logic here
  }

  response = <value>

  // settings
  tags = ["tag1", "tag2"]
  history = {inherit: true}
}
```

For authenticated primitives, add `auth = "user"` inside the declaration block.

## Input Types

Inputs define the data a primitive accepts. The `input` block is required even if empty.

### Available Input Types

| Type | Syntax | Description |
|------|--------|-------------|
| `int` | `int id` | Whole numbers |
| `text` | `text name` | String data |
| `email` | `email user_email` | Email addresses |
| `password` | `password user_pass` | Password fields |
| `bool` | `bool active` | True/false values |
| `decimal` | `decimal price` | Precise numbers |
| `timestamp` | `timestamp created_at` | Date-time values |
| `date` | `date birth_date` | Calendar dates |
| `enum` | `enum status {values=["active","inactive"]}` | Predefined value set |
| `object` | `object address {schema={}}` | Nested structured data |
| `json` | `json metadata` | Flexible unstructured data |
| `uuid` | `uuid session_id` | Universally unique identifiers |
| `image` | `image avatar` | Image files |
| `video` | `video recording` | Video files |
| `audio` | `audio message` | Audio files |
| `attachment` | `attachment document` | General file uploads |
| `vector` | `vector embedding` | ML embeddings |

### Input Modifiers

```
// Optional input (nullable)
text name?

// Optional type
text? name

// List/array input
text[] tags

// Filtered input
text email filters=trim|lower

// Table reference
int user_id { dbtable = "users" }
```

## Field Types (Database Schema)

Field types for database table definitions:

```
int id                                    // Integer (auto-increment primary key)
text name                                 // String
bool active                               // Boolean
decimal price                             // Precise decimal
timestamp created_at                      // Date-time
date birth_date                           // Calendar date
uuid session_id                           // UUID
enum status {values=["active","inactive"]} // Enum
object address {schema={}}                // Nested object with schema
json metadata                             // Flexible JSON
password secret {sensitive = true}        // Password with sensitivity flag
vector embedding                          // ML vector
image avatar                              // Image
video recording                           // Video
audio message                             // Audio
attachment document                       // File
geo_point location                        // Geographic point
geo_polygon boundary                      // Geographic polygon
```

## Variables

### Create a Variable

```
var myVariable {
  value = "Hello world"
}
```

Supports strings, numbers, and complex types:
```
var count {
  value = 1234
}

var items {
  value = "[1,2,3,4,5]"|json_decode
}
```

### Update a Variable

```
var.update $myVariable {
  value = "New value"
}
```

**Important:** Complex data types (arrays, objects) require the `json_decode` filter.

## Dot Notation

Access nested data with periods:

```
$variable.key          // Object property
$variable.0            // Array index (0-based)
$variable.nested.deep  // Deep nesting
```

## Expressions

Single-line expressions use backticks:
```
`$price * $quantity`
```

Multi-line expressions use triple backticks:
```
```
$base_price * $quantity
+ $shipping_cost
- $discount
```
```

Expressions support standard operators: `+`, `-`, `*`, `/`, `%`, `==`, `!=`, `>`, `<`, `>=`, `<=`, `&&`, `||`

## Conditionals

### If / Elseif / Else

```
conditional {
  if (`$user_age >= 18`) {
    debug.log { value = "Adult" }
  }
  elseif (`$user_age >= 13`) {
    debug.log { value = "Teenager" }
  }
  else {
    debug.log { value = "Child" }
  }
}
```

Conditions support `&&` (AND) and `||` (OR) with grouping:
```
conditional {
  if (`$role == "admin" && $active == true`) {
    // ...
  }
}
```

### Switch / Case

```
var $status {
  value = "pending"
}

switch ($status) {
  case ("active") {
    debug.log { value = "Status is active" }
  } break

  case ("pending") {
    debug.log { value = "Status is pending" }
  } break

  default {
    debug.log { value = "Unknown status" }
  }
}
```

Each `case` block **must** end with `break`. `default` is optional.

## Loops

### ForEach Loop

Iterate through a list:
```
foreach ($items) {
  each as $item {
    debug.log { value = $item }
  }
}
```

Access object properties inside loop with dot notation: `$item.name`, `$item.id`

### For Loop

Fixed number of iterations:
```
for (`$count`) {
  each as $index {
    debug.log { value = $index }
  }
}
```

### While Loop

Continue while condition is true:
```
while (`$counter < 10`) {
  each {
    math.add $counter { value = 1 }
  }
}
```

### Loop Control

```
break       // Exit loop immediately
continue    // Skip to next iteration
```

Both work in all loop types. Nested loops are supported.

## Stacks

Stacks contain the core logic. Functions are called with `namespace.function` syntax:

```
stack {
  db.query user {
    where = $db.user.status == "active"
    return = {type: "list"}
  } as $users

  var $names {
    value = "[]"|json_decode
  }

  foreach ($users) {
    each as $user {
      array.push $names {
        value = $user.name|to_upper
      }
    }
  }
}
```

## Responses

The response block defines what the primitive returns:

```
response = $result

// Or return an object
response = {
  users: $users,
  total: $count
}
```

## Settings

Settings appear after the response:

```
description = "Fetches active users"
tags = ["users", "public"]
auth = "user"
history = {inherit: true}

cache = {
  ttl: 300,
  input: true,
  auth: true,
  datasource: true,
  ip: false,
  headers: ["x-custom-header"],
  env: ["API_KEY"]
}
```

| Setting | Type | Description |
|---------|------|-------------|
| `description` | string | Human-readable description |
| `tags` | array | Organization/categorization labels |
| `auth` | string | Authentication requirement (e.g., `"user"`) |
| `history` | object | Version inheritance (`{inherit: true}`) |
| `cache` | object | Response caching configuration |
