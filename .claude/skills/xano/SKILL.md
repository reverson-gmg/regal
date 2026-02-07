# Xano Skill

Xano is a no-code/low-code backend platform. XanoScript is its markup language for programmatically defining backends — databases, APIs, custom functions, background tasks, middleware, triggers, and tests. This skill covers writing **Xano functions** using **XanoScript**.

## When to Use Each Sub-File

### [language-basics.md](./language-basics.md)
Use when the task involves:
- Understanding XanoScript syntax fundamentals (primitives, inputs, stacks, responses, settings)
- Working with variables, dot notation, expressions
- Writing conditionals (`if`/`elseif`/`else`, `switch`/`case`)
- Writing loops (`foreach`, `for`, `while`, `break`, `continue`)
- Understanding field types (`int`, `text`, `bool`, `decimal`, `timestamp`, `object`, `json`, `enum`, etc.)
- Understanding input types and optional/required parameters

### [filters.md](./filters.md)
Use when the task involves:
- Applying pipe-syntax filters to transform data (`value|filter_name:param`)
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
- Database operations (`db.query`, `db.get`, `db.add`, `db.edit`, `db.del`, bulk ops, transactions, direct SQL)
- Data manipulation functions (`var`, `var.update`, array operations, text operations, math operations, object operations)
- Security functions (`security.create_auth_token`, `security.encrypt`, `security.jws_encode`, etc.)
- Utility functions (`precondition`, `try_catch`, `return`, `debug.log`, `sleep`, `api.request`, etc.)
- API and Lambda functions (`api.request`, `api.lambda`, `api.stream`, `api.realtime_event`)
- Redis caching (`redis.set`, `redis.get`, `redis.del`, `redis.incr`, rate limiting, lists)
- File storage (`storage.create_image`, `storage.create_file_resource`, `storage.delete_file`, etc.)
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

## Shared Context

### XanoScript Overview
XanoScript is a markup language combining JSON/XML/YAML structure with TypeScript flexibility. It enables programmatic backend configuration while supporting visual development. Code written in XanoScript maps 1:1 to the visual builder.

### Key Syntax Rules
- Variables are prefixed with `$` (e.g., `$user`, `$result`)
- Functions use `namespace.function` dot notation (e.g., `db.query`, `security.encrypt`)
- Function output is captured with the `as` keyword (e.g., `db.get user { ... } as $user`)
- Filters use pipe syntax: `value|filter_name:param1:param2`
- Conditions are wrapped in backticks: `` `$age >= 18` ``
- Comments use `//` notation
- Complex data (arrays/objects) uses `json_decode` filter: `"[1,2,3]"|json_decode`

### Development Tools
- **VS Code Extension**: Supports VS Code, Cursor, Windsurf for IDE development
- **Visual Builder**: XanoScript maps 1:1 to the visual builder — switch freely between code and visual
- **AI Integration**: Generate XanoScript via AI models for direct Xano import
