# Defining XanoScript Primitives

This file covers how to define custom functions, APIs, middleware, background tasks, triggers, and tests in XanoScript.

---

## Custom Functions

Custom functions are reusable logic blocks callable from APIs, other functions, or tasks via `function.run`.

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

Use forward slashes for folder organization: `utilities/format_name`, `auth/validate_token`, `payments/process_charge`.

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
      where = $db.product.name|INCLUDES:$input.search
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

### Complete Example: User Signup API

```
query auth/signup verb=POST {
  description = "Register a new user"

  input {
    text name filters=trim
    email email filters=trim|lower
    password password filters=min:8|minAlpha:1|minDigit:1
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

### Complete Example: Paginated Search with Ownership

```
query posts/list verb=GET {
  description = "List authenticated user's posts with search"
  auth = "user"

  input {
    text search?
    int page?
    int per_page?
    text sort_by?
  }

  stack {
    var $page { value = $input.page|coalesce:1 }
    var $per_page { value = $input.per_page|coalesce:25 }
    var $sort_by { value = $input.sort_by|coalesce:"created_at" }

    db.query post {
      where = $db.post.user_id == $auth.id
        && $db.post.title|INCLUDES:$input.search
      sort = {post.$sort_by: "desc"}
      return = {type: "list", paging: {page: $page, per_page: $per_page, totals: true}}
    } as $posts
  }

  response = $posts

  tags = ["posts"]
  cache = {ttl: 30, input: true, auth: true}
}
```

### Complete Example: CRUD Delete with Ownership Check

```
query posts/delete verb=DELETE {
  description = "Delete a post owned by the authenticated user"
  auth = "user"

  input {
    int post_id
  }

  stack {
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

    db.del post {
      field_name = "id"
      field_value = $input.post_id
    }
  }

  response = {success: true}

  tags = ["posts"]
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
    // Example: clean up expired sessions
    db.query session {
      where = $db.session.expires_at < "now"|to_timestamp:"UTC"
      return = {type: "list"}
    } as $expiredSessions

    foreach ($expiredSessions) {
      each as $session {
        db.del session {
          field_name = "id"
          field_value = $session.id
        }
      }
    }
  }

  schedule = [
    {
      starts_on: "2025-01-01 00:00:00+00:00",
      freq: 3600,                               // hourly (in seconds)
      ends_on: null                              // runs indefinitely
    }
  ]

  tags = ["maintenance"]
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
          headers = "[]"|json_decode|push:"Authorization: Bearer "|concat:$env.SENDGRID_KEY
          params = {
            personalizations: [{to: [{email: $input.new.email}]}],
            from: {email: "noreply@app.com"},
            subject: "Welcome!",
            content: [{type: "text/plain", value: "Welcome to our platform!"}]
          }
        }
      }
    }
  }

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
        // notify admin via webhook
        api.request {
          url = $env.SLACK_WEBHOOK_URL
          method = "POST"
          params = {text: "Branch merged: "|concat:$input.source_branch.name}
        }
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

Unit tests are embedded within the primitive being tested. They validate inputs produce expected outputs.

```
test "should return user by ID" {
  datasource = "live"

  input = {
    user_id: 1
  }

  expect.to_be_defined ($response)
  expect.to_equal ($response.id, 1)
  expect.to_contain ($response.name, "John")
}
```

### Available Assertions

| Assertion | Syntax | Description |
|-----------|--------|-------------|
| `expect.to_be_defined` | `expect.to_be_defined ($value)` | Value exists and is not null |
| `expect.to_not_be_defined` | `expect.to_not_be_defined ($value)` | Value is null/undefined |
| `expect.to_equal` | `expect.to_equal ($value, <expected>)` | Value equals expected |
| `expect.to_not_equal` | `expect.to_not_equal ($value, <expected>)` | Value does not equal expected |
| `expect.to_contain` | `expect.to_contain ($value, <content>)` | Value contains expected content |
| `expect.to_be_true` | `expect.to_be_true ($value)` | Value is true |
| `expect.to_be_false` | `expect.to_be_false ($value)` | Value is false |

### Mock Responses

Mock blocks override the return values of specific function calls during tests. This ensures consistent test results regardless of external state.

To mock a function in a test:
1. Right-click the function in the stack and choose "Mock Test Response"
2. Configure mock data for each individual test
3. The mock response replaces the real function's output during that test

Mocks work on any statement that returns a value (`db.get`, `db.query`, `function.run`, `api.request`, etc.).

### Unit Test with Auth

For authenticated function stacks, provide auth tokens:

```
test "should return user's own posts" {
  datasource = "live"

  input = {
    page: 1,
    per_page: 10
  }

  // Auth token and extras configured in test settings
  // Token expiration can be ignored during testing

  expect.to_be_defined ($response)
  expect.to_be_true ($response|count|greater_than:0)
}
```

### Workflow Tests

Standalone tests that can invoke multiple functions/APIs in sequence:

```
workflow_test "full signup and login flow" {
  stack {
    // Step 1: Sign up
    function.run "auth/signup" {
      input = {name: "Test User", email: "test@example.com", password: "Pass1234"}
    } as $signup

    expect.to_be_defined ($signup.authToken)

    // Step 2: Login with same credentials
    function.run "auth/login" {
      input = {email: "test@example.com", password: "Pass1234"}
    } as $login

    expect.to_be_defined ($login.authToken)
    expect.to_not_equal ($login.authToken, $signup.authToken)
  }

  tags = ["auth", "integration"]
}
```

### Workflow Test with API Calls

```
workflow_test "create and retrieve a post" {
  stack {
    // Create a post via API
    api.call posts/create verb=POST {
      api_group = "v1"
      input = {title: "Test Post", body: "Content here"}
    } as $created

    expect.to_be_defined ($created.id)
    expect.to_equal ($created.title, "Test Post")

    // Retrieve it
    api.call posts/get verb=GET {
      api_group = "v1"
      input = {post_id: $created.id}
    } as $retrieved

    expect.to_equal ($retrieved.id, $created.id)
    expect.to_equal ($retrieved.title, "Test Post")
  }

  tags = ["posts", "integration"]
}
```

### Test Configuration

| Setting | Purpose |
|---------|---------|
| `datasource` | Testing environment (`"live"`, `"draft"`, or custom) |
| `input` | Test data (unit tests only) |
| `tags` | Test categorization (workflow tests) |
| `description` | Test purpose documentation |

Expectations can be placed anywhere in the `stack` for workflow tests. For unit tests, expectations follow the input configuration.

---

## Real-World Function Patterns

### Pattern: Phone Number Formatter

```
function utilities/format_phone {
  description = "Normalize phone numbers to E.164 format"

  input {
    text phone filters=trim
    text country_code?="1"
  }

  stack {
    // Strip all non-numeric characters
    var $clean {
      value = $input.phone|regex_replace:"[^0-9]":""
    }

    // Handle different formats
    conditional {
      if (`$clean|strlen == 10`) {
        // US number without country code
        var.update $clean { value = $input.country_code|concat:$clean }
      }
      elseif (`$clean|starts_with:"1" && $clean|strlen == 11`) {
        // Already has US country code
      }
      else {
        precondition {
          conditions = `$clean|strlen >= 10 && $clean|strlen <= 15`
          type = "badrequest"
          message = "Invalid phone number length"
        }
      }
    }

    var $formatted {
      value = "+"|concat:$clean
    }
  }

  response = $formatted

  tags = ["utilities"]
}
```

### Pattern: Paginated API with External Pagination

```
function data/paginated_search {
  description = "Search records with external pagination and sorting"

  input {
    text table_name
    text search?
    int page?
    int per_page?
    text sort_field?
    text sort_dir?
  }

  stack {
    var $page { value = $input.page|coalesce:1 }
    var $per_page { value = $input.per_page|coalesce:25|min:100 }
    var $sort_field { value = $input.sort_field|coalesce:"created_at" }
    var $sort_dir { value = $input.sort_dir|coalesce:"desc" }

    db.query $input.table_name {
      where = $db.$input.table_name.name|INCLUDES:$input.search
      sort = {$input.table_name.$sort_field: $sort_dir}
      return = {type: "list", paging: {page: $page, per_page: $per_page, totals: true}}
    } as $results
  }

  response = $results

  tags = ["data", "utilities"]
}
```

### Pattern: Retry with Exponential Backoff

```
function utilities/retry_api_call {
  description = "Call an external API with retry logic"

  input {
    text url
    text method?="GET"
    json params?
    int max_retries?=3
  }

  stack {
    var $retries { value = 0 }
    var $success { value = false }
    var $response { value = "{}"|json_decode }
    var $last_error { value = "" }

    while (`$retries < $input.max_retries && $success == false`) {
      each {
        try_catch {
          try {
            api.request {
              url = $input.url
              method = $input.method
              params = $input.params
            } as $api_response

            conditional {
              if (`$api_response.status >= 200 && $api_response.status < 300`) {
                var.update $response { value = $api_response }
                var.update $success { value = true }
              }
              else {
                var.update $last_error { value = "HTTP "|concat:$api_response.status|to_text }
              }
            }
          }
          catch ($error) {
            var.update $last_error { value = $error|to_text }
          }
        }

        conditional {
          if (`$success == false`) {
            math.add $retries { value = 1 }
            // Exponential backoff: 1s, 2s, 4s
            var $wait_time { value = 1 }
            math.mul $wait_time { value = $retries }
            sleep { seconds = $wait_time }
          }
        }
      }
    }

    precondition {
      conditions = `$success == true`
      type = "badrequest"
      message = "API call failed after retries: "|concat:$last_error
    }
  }

  response = $response

  tags = ["utilities", "api"]
}
```

### Pattern: Webhook Signature Verification

```
function security/verify_webhook {
  description = "Verify webhook HMAC signature"

  input {
    text payload
    text signature
    text secret_env_key?="WEBHOOK_SECRET"
  }

  stack {
    // Compute expected signature
    var $expected {
      value = $input.payload|hmac_sha256:$env.$input.secret_env_key:true
    }

    // Constant-time comparison
    precondition {
      conditions = `$expected == $input.signature`
      type = "unauthorized"
      message = "Invalid webhook signature"
    }
  }

  response = {verified: true}

  tags = ["security", "webhooks"]
}
```

---

## Common Mistakes

1. **Forgetting `json_decode` for complex values.** This is the #1 XanoScript mistake.
   ```
   // WRONG
   var items { value = "[1,2,3]" }

   // RIGHT
   var items { value = "[1,2,3]"|json_decode }
   ```

2. **Missing `$` when referencing variables.**
   ```
   // WRONG
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

4. **Forgetting `break` in switch cases.** Without `break`, execution falls through.

5. **Not capturing results with `as`.** Every function that produces output needs `as $variable`.

6. **Using `var` when you mean `var.update`.** `var` creates a new variable. `var.update $existing` modifies an existing one.

7. **Returning sensitive data.** Never include password hashes, internal IDs, or tokens in API responses unless explicitly needed. Use `|unpick:["password"]` to strip sensitive fields.

8. **Not wrapping `function.run` in `try_catch`.** Functions with preconditions or input validation can throw. Handle these gracefully.

9. **Building monolithic stacks.** Extract reusable logic into custom functions. If you're copy-pasting logic between APIs, it belongs in a function.

10. **Skipping `precondition` checks after `db.get`.** If `db.get` returns null, accessing its properties crashes. Always validate existence first.

---

## Debugging

1. **Use `debug.log` liberally** during development:
   ```
   debug.log { value = $user }
   debug.log { value = $items|count }
   debug.log { value = "checkpoint: past validation" }
   ```

2. **Use `stop_and_debug`** to halt execution and inspect state:
   ```
   stop_and_debug { value = $suspiciousVariable }
   ```

3. **Use `precondition` to surface specific errors:**
   ```
   precondition {
     conditions = `$response.status|equals:200`
     type = "badrequest"
     message = "External API returned non-200"
     payload = {status: $response.status, body: $response.body}
   }
   ```

4. **Wrap risky operations in `try_catch`:**
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

5. **Check your datasource.** If data looks wrong, confirm you're querying the right one (`live` vs `draft`). Use `util.set_datasource` to switch.

6. **Inspect variable types:**
   ```
   debug.log { value = $value|is_array }
   debug.log { value = $value|is_object }
   debug.log { value = $value|is_null }
   ```
