# Defining XanoScript Primitives

This file covers how to define custom functions, APIs, middleware, background tasks, triggers, and tests in XanoScript.

---

## Custom Functions

Custom functions are reusable logic blocks that can be called from APIs, other functions, or tasks.

### Structure

```
function <path/name> {
  description = "Description of what this function does"

  input {
    text name
    int age?                           // optional parameter
    text email filters=trim|lower      // with input filters
  }

  stack {
    // Logic here — uses the same functions as APIs
    conditional {
      if (`$input.age >= 18`) {
        var $status { value = "adult" }
      }
      else {
        var $status { value = "minor" }
      }
    }
  }

  response = {
    name: $input.name,
    status: $status
  }

  tags = ["utilities"]
  history = {inherit: true}
}
```

### Naming Convention

Use forward slashes for folder organization: `utilities/format_name`, `auth/validate_token`, `maths/calculate_total`.

### Calling Custom Functions

```
function.run "utilities/format_name" {
  input = {
    first_name: "john",
    last_name: "doe"
  }
} as $formatted
```

### Error Handling

Functions that use `precondition` or input filters may throw errors. Wrap calls in `try_catch`:

```
try_catch {
  try {
    function.run "auth/validate_token" {
      input = {token: $input.token}
    } as $user
  }
  catch ($error) {
    precondition {
      conditions = `false`
      type = "unauthorized"
      message = "Invalid token"
    }
  }
}
```

### Settings

| Setting | Type | Purpose |
|---------|------|---------|
| `description` | string | Human-readable overview |
| `tags` | array | Organization labels |
| `history` | object | Version inheritance (`{inherit: true}`) |
| `cache` | object | Response caching (see below) |

**Cache options:**
```
cache = {
  ttl: 300,            // seconds (0 = disabled)
  input: true,         // include request body in cache key
  auth: true,          // include auth state
  datasource: true,    // include datasource
  ip: false,           // include IP
  headers: [],         // specific headers
  env: []              // environment variables
}
```

---

## APIs

APIs define REST endpoints. Each maps to a visual builder endpoint.

### Structure

```
query <api_name> verb=<VERB> {
  description = "Description"
  auth = "user"                // authentication requirement

  input {
    text search?
    int page filters=default:1
  }

  stack {
    db.query product {
      where = $db.product.name|icontains:$input.search
      return = {type: "list", paging: {page: $input.page, per_page: 25}}
    } as $products
  }

  response = $products

  tags = ["products", "public"]
  history = {inherit: true}
  cache = {ttl: 60, input: true}
}
```

### HTTP Verbs

Use `verb=GET`, `verb=POST`, `verb=PUT`, `verb=PATCH`, `verb=DELETE`.

### API Path Names

Use forward slashes for route grouping: `auth/signup`, `auth/login`, `users/profile`.

### Complete Example: Signup API

```
query auth/signup verb=POST {
  description = "Register a new user"

  input {
    text name
    email email filters=trim|lower
    password password
  }

  stack {
    // Check if user already exists
    db.has user {
      field_name = "email"
      field_value = $input.email
    } as $exists

    precondition {
      conditions = `$exists == false`
      type = "badrequest"
      message = "Email already registered"
    }

    // Create user
    db.add user {
      data = {
        name: $input.name,
        email: $input.email,
        password: $input.password,
        created_at: "now"
      }
    } as $user

    // Generate auth token
    security.create_auth_token {
      table = "user"
      id = $user.id
      expiration = 86400
    } as $authToken
  }

  response = {authToken: $authToken}

  tags = ["auth"]
}
```

---

## Middleware

Middleware provides reusable pre/post processing for APIs, functions, tasks, and AI tools.

### Structure

```
middleware <name> {
  description = "Description"

  input {
    json vars                          // context variables from the calling object
    enum type {values=["pre","post"]}  // pre or post processing phase
  }

  stack {
    // Example: validate user is not banned
    db.get user {
      field_name = "id"
      field_value = $input.vars.auth.id
    } as $user

    precondition {
      conditions = `$user.banned == false`
      type = "accessdenied"
      message = "Account is suspended"
    }
  }

  response = {
    user: $user
  }

  // Settings
  response_strategy = "merge"      // "merge" (default) or "replace"
  exception_policy = "critical"    // "critical" | "silent" (default) | "rethrow"
  tags = ["security"]
}
```

### Input Context

The `vars` object contains context-specific data:
- **APIs**: `$input.vars.auth`, `$input.vars.input`, plus API-specific variables
- **Functions**: Parameters and context variables
- **Tasks**: Task configuration and variables
- **AI Tools**: Tool inputs and context

### Settings

| Setting | Type | Values |
|---------|------|--------|
| `response_strategy` | string | `"merge"` (default) — merge response into calling context; `"replace"` — replace |
| `exception_policy` | string | `"silent"` (default) — swallow errors; `"critical"` — halt execution; `"rethrow"` — re-throw |
| `tags` | array | Categorization labels |

---

## Background Tasks

Tasks run on a schedule without API requests. They have no inputs and no response.

### Structure

```
task <name> {
  active = true
  datasource = "live"
  description = "Description of what this task does"

  stack {
    // Example: re-engage inactive users
    db.query user {
      where = $db.user.last_login|less_than:$db.user.created_at|add_secs_to_timestamp:604800
      return = {type: "list"}
    } as $inactiveUsers

    foreach ($inactiveUsers) {
      each as $user {
        api.request {
          url = "https://api.sendgrid.com/v3/mail/send"
          method = "POST"
          headers = []|push:"Authorization: Bearer $env.SENDGRID_KEY"
          params = {
            to: $user.email,
            subject: "We miss you!"
          }
        }
      }
    }
  }

  schedule = [
    {
      starts_on: "2025-01-01 00:00:00+00:00",
      freq: 604800,                               // weekly (in seconds)
      ends_on: null                                // runs indefinitely
    }
  ]

  tags = ["engagement"]
  history = {inherit: true}
}
```

### Key Constraints
- No `input` block (tasks accept no inputs)
- No `response` block (tasks return nothing)
- `schedule` is an array of schedule entries with `starts_on`, `freq` (seconds), and optional `ends_on`

---

## Triggers

Triggers execute automatically in response to events. Four types exist.

### Database Trigger

Responds to table changes (insert, update, delete, truncate):

```
table_trigger <name> {
  table = "user"
  description = "Send welcome email on signup"

  input {
    object new                     // new record data
    object old                     // previous record data (for updates)
    enum action {values=["insert","update","delete","truncate"]}
    text datasource
  }

  stack {
    conditional {
      if (`$input.action == "insert"`) {
        api.request {
          url = "https://api.sendgrid.com/v3/mail/send"
          method = "POST"
          params = {to: $input.new.email, subject: "Welcome!"}
        }
      }
    }
  }

  // Settings: which events trigger this
  actions = {insert: true, update: false, delete: false, truncate: false}
  tags = ["notifications"]
}
```

### Workspace Trigger

Responds to workspace events (branch changes, deployments):

```
workspace_trigger <name> {
  description = "Notify on branch merge"

  input {
    object target_branch
    object source_branch
    enum action {values=["branch_live","branch_merge","branch_new"]}
  }

  stack {
    conditional {
      if (`$input.action == "branch_merge"`) {
        // notify admin
      }
    }
  }

  actions = {branch_live: true, branch_merge: true, branch_new: false}
  tags = ["devops"]
}
```

### Realtime Trigger

Responds to realtime channel events:

```
realtime_trigger <name> {
  channel = "chat"
  description = "Log chat messages"

  input {
    enum action {values=["message","join"]}
    text channel
    object client
    object options
    json payload
  }

  stack {
    conditional {
      if (`$input.action == "message"`) {
        db.add chat_log {
          data = {
            channel: $input.channel,
            message: $input.payload,
            created_at: "now"
          }
        }
      }
    }
  }

  response = {status: "logged"}

  actions = {message: true, join: true}
  tags = ["chat"]
}
```

### MCP Server Trigger

Responds to MCP server connection events. Must return modified toolset and tools:

```
mcp_server_trigger <name> {
  mcp_server = "my_mcp_server"
  description = "Filter tools by user permissions"

  input {
    object toolset
    json tools                     // array of {id, name, instructions}
  }

  stack {
    // Modify available tools based on context
    array.filter ($input.tools) if (`$this.name != "admin_tool"`) as $filteredTools
  }

  response = {
    toolset: $input.toolset,
    tools: $filteredTools
  }

  actions = {connection: true}
  tags = ["mcp"]
}
```

---

## Tests

### Unit Tests

Embedded within the primitive being tested:

```
test "should return user by ID" {
  datasource = "live"

  input = {
    user_id: 1
  }

  // Expectations on the response
  expect.to_be_defined { value = $response }
  expect.to_equal { value = $response.id, expected = 1 }
  expect.to_contain { value = $response.name, expected = "John" }
}
```

### Workflow Tests

Standalone tests that can invoke multiple functions/APIs:

```
workflow_test "full signup and login flow" {
  stack {
    // Step 1: Sign up
    function.run "auth/signup" {
      input = {name: "Test User", email: "test@example.com", password: "pass123"}
    } as $signup

    expect.to_be_defined { value = $signup.authToken }

    // Step 2: Login
    function.run "auth/login" {
      input = {email: "test@example.com", password: "pass123"}
    } as $login

    expect.to_be_defined { value = $login.authToken }
    expect.to_not_equal { value = $login.authToken, expected = $signup.authToken }
  }

  tags = ["auth", "integration"]
}
```

### Available Expectations

| Assertion | Description |
|-----------|-------------|
| `expect.to_be_defined` | Value exists and is not null |
| `expect.to_not_be_defined` | Value is null/undefined |
| `expect.to_equal` | Value equals expected |
| `expect.to_not_equal` | Value does not equal expected |
| `expect.to_contain` | Value contains expected content |
| `expect.to_true` | Value is true |
| `expect.to_false` | Value is false |

### Test Configuration

| Setting | Purpose |
|---------|---------|
| `datasource` | Testing environment (`"live"`, `"draft"`, or custom) |
| `input` | Test data (unit tests only) |
| `tags` | Test categorization (workflow tests) |
| `description` | Test purpose documentation |

Expectations can be placed anywhere in the `stack` for workflow tests. For unit tests, expectations follow the input configuration.
