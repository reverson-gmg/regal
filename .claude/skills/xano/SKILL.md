# Xano Skill

Xano is a scalable backend platform. XanoScript is its code-first language for defining every backend component — databases, APIs, custom functions, background tasks, middleware, triggers, agents, and tests. XanoScript maps 1:1 to the visual builder; anything built visually can be expressed in code and vice versa.

This skill makes you an expert at writing XanoScript.

## When to Use Each Sub-File

### [language-basics.md](./language-basics.md)
Use when the task involves:
- Understanding XanoScript syntax fundamentals (primitives, inputs, stacks, responses, settings)
- Working with variables, dot notation, expressions
- Writing conditionals (`if`/`elseif`/`else`, `switch`/`case`)
- Writing loops (`foreach`, `for`, `while`, `break`, `continue`)
- Understanding field types (`int`, `text`, `bool`, `decimal`, `timestamp`, `object`, `json`, `enum`, etc.)
- Understanding input types, optional/required parameters, input filters
- Defining database table schemas, indexes, views
- Defining addons (reusable database query components)
- Defining workspace settings
- Defining AI agents with LLM configuration and tools

### [filters.md](./filters.md)
Use when the task involves:
- Applying pipe-syntax filters to transform data inline (`value|filter_name:param`)
- Chaining or nesting multiple filters
- Array filters (`filter`, `map`, `reduce`, `sort`, `unique`, `flatten`, `merge`, etc.)
- Comparison filters (`equals`, `greater_than`, `is_null`, `in`, `ternary`, etc.)
- Manipulation filters (`get`, `set`, `unset`, `has`, `fill`, etc.)
- Math filters (`add`, `subtract`, `round`, `abs`, `sum`, `avg`, etc.)
- Security filters (`encrypt`, `decrypt`, `sha256`, `hmac_sha256`, `jws_encode`, etc.)
- Text filters (`capitalize`, `trim`, `replace`, `split`, `regex_replace`, `contains`, etc.)
- Timestamp filters (`format_timestamp`, `parse_timestamp`, `add_secs_to_timestamp`, etc.)
- Transform filters (`json_encode`, `json_decode`, `base64_encode`, `url_encode`, `to_int`, `csv_decode`, etc.)

### [functions.md](./functions.md)
Use when the task involves:
- Database operations (`db.query`, `db.get`, `db.add`, `db.edit`, `db.patch`, `db.del`, bulk ops, transactions, direct SQL)
- Data manipulation functions (`var`, `var.update`, array ops, text ops, math ops, object ops)
- Security functions (`security.create_auth_token`, `security.encrypt`, `security.jws_encode`, etc.)
- Utility functions (`precondition`, `try_catch`, `return`, `debug.log`, `sleep`, etc.)
- External API calls (`api.request`, `api.lambda`, `api.stream`, `api.realtime_event`)
- Redis caching (`redis.set`, `redis.get`, `redis.del`, `redis.incr`, rate limiting, lists)
- File storage (`storage.create_image`, `storage.create_file_resource`, `storage.delete_file`, etc.)
- Cloud services (AWS S3, Google Cloud Storage, Azure Blob, Algolia, Elasticsearch, AWS OpenSearch)
- AI tools (`ai.agent.run`, MCP tools, template engine)
- Actions (`action.call`)

### [custom-functions.md](./custom-functions.md)
Use when the task involves:
- Defining new custom functions with inputs, stacks, responses, and settings
- Defining REST APIs (`query` with HTTP verbs)
- Defining middleware (pre/post processing for APIs, functions, tasks, AI tools)
- Defining background tasks with schedules
- Defining triggers (database, workspace, realtime, MCP server)
- Writing tests (unit tests and workflow tests)
- Understanding the five-part structure (declaration, input, stack, response, settings)
- Calling custom functions from other functions or APIs (`function.run`)

## Construction Process

When building anything in XanoScript, follow this process:

1. **Clarify the goal.** What data goes in? What comes out? What side effects should occur? Get specific about the exact shapes.
2. **Choose the right primitive type.** Use the decision tree below.
3. **Design the input contract.** What fields are required vs optional? What types? What validation filters should be applied at the input boundary?
4. **Map the data flow.** Trace every variable from input through the stack to response. Identify every database read/write, every external API call, every transformation.
5. **Handle errors at every boundary.** Use `precondition` for expected failures (not found, bad input, unauthorized). Use `try_catch` for operations that can throw (external APIs, custom function calls, file operations).
6. **Write the response contract.** Return only what the consumer needs. Never leak internal variables, raw database records with sensitive fields, or debug data.
7. **Configure settings.** Authentication, caching, tags, description.

## Decision Tree: Choosing the Right Primitive

| Need | Primitive | Key Trait |
|------|-----------|-----------|
| A REST endpoint clients call | `query` (API) | Has HTTP verb, accepts requests, returns responses |
| Reusable logic shared across APIs | `function` (Custom Function) | Called with `function.run`, has inputs + response |
| Logic that runs on a schedule | `task` (Background Task) | No inputs, no response, has `schedule` |
| Pre/post processing on multiple endpoints | `middleware` | Runs before/after APIs, functions, tasks, or AI tools |
| React to database changes | `table_trigger` | Fires on insert/update/delete/truncate |
| React to workspace events | `workspace_trigger` | Fires on branch changes, deployments |
| React to realtime channel events | `realtime_trigger` | Fires on messages, user joins |
| React to MCP server connections | `mcp_server_trigger` | Fires on connection, modifies available tools |
| Reusable database query component | `addon` | Database queries only, auto-returns results |
| LLM-powered autonomous workflow | `agent` | Has LLM config, system prompt, tools |
| Validate a single function | `test` (unit) | Embedded in the primitive, simple input/expect |
| Validate a multi-step workflow | `workflow_test` | Standalone, has full stack with expects |
| Define data structure | `table` | Schema, indexes, views |

## Key Syntax Rules (Quick Reference)

- **Variables** are prefixed with `$`: `$user`, `$result`, `$input.email`
- **Functions** use dot notation: `db.query`, `security.encrypt`, `array.push`
- **Output capture** uses `as`: `db.get user { ... } as $user`
- **Filters** use pipe syntax: `$name|trim|to_upper`
- **Conditions** are wrapped in backticks: `` `$age >= 18` ``
- **Comments** use `//`
- **Complex data** needs `json_decode`: `"[1,2,3]"|json_decode`
- **String concatenation** uses `|concat:`: `"user:"|concat:$id`

## Common Anti-Patterns (Across All XanoScript)

1. **Forgetting `json_decode` for arrays/objects.** `value = [1,2,3]` does NOT create an array. You must write `value = "[1,2,3]"|json_decode`.
2. **Missing `$` prefix on variable references.** `myVar` is a literal string. `$myVar` is the variable.
3. **Forgetting backticks around conditions.** `if ($age >= 18)` is wrong. `if (\`$age >= 18\`)` is correct.
4. **Not using `as` to capture function output.** If you call `db.get user { ... }` without `as $user`, you lose the result.
5. **Returning sensitive data.** Never include password hashes, internal IDs, or tokens in API responses unless explicitly needed.
6. **Hardcoding secrets.** Use environment variables (`$env.API_KEY`) for all keys, tokens, and credentials.
7. **Skipping `precondition` checks.** Always validate that required data exists before operating on it — check for null records after `db.get`, validate ownership before `db.edit`.
8. **Ignoring error handling on external calls.** `api.request` and `function.run` can fail. Wrap them in `try_catch` when failure is possible.
9. **Building monolithic stacks.** Extract reusable logic into custom functions. If you're copy-pasting logic between APIs, it belongs in a function.
10. **Over-fetching from the database.** Use `output = ["field1", "field2"]` to limit returned columns. Use pagination for lists.

## Development Tools

- **VS Code Extension**: Supports VS Code, Cursor, Windsurf for IDE development with syntax highlighting and autocomplete
- **Visual Builder**: XanoScript maps 1:1 — switch freely between code and visual at any time
- **AI Integration**: Generate XanoScript via AI models for direct Xano import
- **Datasources**: Use `"live"`, `"draft"`, or custom datasources to separate production from development data
