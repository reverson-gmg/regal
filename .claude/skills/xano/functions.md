# XanoScript Built-in Functions Reference

All functions use `namespace.function` syntax. Results are captured with `as $variable`.

---

## Database Operations

### Query Records

```
db.query <table> {
  where = <condition>
  join = {<alias>: {table: "<table>", where: <condition>}}
  sort = {<table>.<field>: "asc"|"desc"}
  eval = {<custom_field>: <expression>}
  output = ["field1", "field2"]
  return = {
    type: "list"|"single"|"count"|"exists"|"stream",
    paging: {page: 1, per_page: 25, offset: 0, totals: true, metadata: true}
  }
} as $results
```

**Where conditions:** `$db.<table>.<field> == <value>`, combined with `&&` and `||`.

**Return types:**
- `list` — Array of records (supports pagination)
- `single` — First matching record
- `count` — Number of matches
- `exists` — Boolean
- `stream` — Iterator for large datasets

**Example with join and pagination:**
```
db.query user {
  where = $db.user.status == "active"
  join = {orders: {table: "order", where: $db.user.id == $db.order.user_id}}
  sort = {user.name: "asc"}
  return = {type: "list", paging: {page: 1, per_page: 25}}
} as $users
```

### Get Single Record

```
db.get <table> {
  field_name = "<field>"
  field_value = <value>
  output = ["field1", "field2"]
} as $record
```

### Check Record Exists

```
db.has <table> {
  field_name = "<field>"
  field_value = <value>
} as $exists
```

### Create Record

```
db.add <table> {
  data = {
    name: $input.name,
    email: $input.email,
    created_at: "now"
  }
} as $newRecord
```

### Update Record

```
db.edit <table> {
  field_name = "id"
  field_value = $input.id
  data = {
    name: $input.name,
    updated_at: "now"
  }
} as $updated
```

### Upsert (Add or Edit)

```
db.add_or_edit <table> {
  field_name = "email"
  field_value = $input.email
  data = {
    name: $input.name,
    email: $input.email
  }
} as $result
```

### Patch Record

```
db.patch <table> {
  field_name = "id"
  field_value = $input.id
  data = {}|set:"status":"active"
} as $patched
```

### Delete Record

```
db.del <table> {
  field_name = "id"
  field_value = $input.id
}
```

### Bulk Operations

```
// Bulk insert
db.bulk.add <table> {
  items = $input.items
  allow_id_field = false
} as $results

// Bulk update
db.bulk.update <table> {
  items = $input.items
} as $results

// Bulk patch
db.bulk.patch <table> {
  items = [{}|set:"id":1|set:"status":"active"]
} as $results

// Bulk delete
db.bulk.delete <table> {
  search = $db.<table>.status == "inactive"
} as $results
```

### Direct SQL Query

```
// Template engine parser
db.direct_query <table> {
  query = "SELECT * FROM users WHERE id = {{ $input.id|sql_esc }}"
  parser = "template_engine"
} as $results

// Prepared statement (default)
db.direct_query <table> {
  query = "SELECT * FROM users WHERE id = ?"
  arg = [$input.id]
} as $results
```

### Transactions

```
db.transaction <table> {
  stack {
    db.add <table> { data = {...} } as $record1
    db.add <related_table> { data = {...} } as $record2
  }
}
```

### Other Database Operations

```
// Truncate table (reset = true resets auto-increment)
db.truncate <table> {
  reset = true
}

// Get table schema
db.schema <table> {
  path = "optional.field.path"
} as $schema

// External databases
db.external.postgres {
  connection_string = "host=... user=... dbname=..."
  query = "SELECT * FROM users"
} as $results
// Also: db.external.mysql, db.external.mssql, db.external.oracle
```

---

## Variable Operations

```
// Create variable
var myVar {
  value = "Hello"
}

// Update variable
var.update $myVar {
  value = "World"
}
```

---

## Array Operations (Functions)

```
// Add to end
array.push $myArray {
  value = "new item"
}

// Add to beginning
array.unshift $myArray {
  value = "first item"
}

// Remove from end
array.pop $myArray as $removed

// Remove from beginning
array.shift $myArray as $removed

// Merge arrays
array.merge $myArray {
  value = $otherArray
}

// Union (unique merge)
array.union $arrayA $arrayB as $result

// Intersection
array.intersect $arrayA $arrayB as $result

// Difference
array.diff $arrayA $arrayB as $result

// Find first match
array.find ($myArray) if (`$this == 1`) as $found

// Find first index
array.find_index ($myArray) if (`$this > 5`) as $index

// Check if any match
array.has ($myArray) if (`$this == "admin"`) as $hasAdmin

// Check if all match
array.every ($myArray) if (`$this > 0`) as $allPositive

// Filter matching elements
array.filter ($myArray) if (`$this.status == "active"`) as $active

// Count matches
array.filter_count ($myArray) if (`$this > 10`) as $count

// Map/transform elements
array.map ($myArray) as $mapped {
  value = $this * 2
}

// Partition by condition
array.partition ($myArray) if (`$this > 0`) as $partitioned

// Group by key
array.group_by ($myArray) as $grouped {
  key = $this.category
}
```

**`$this`** references the current element in array operations.

---

## Text Operations (Functions)

```
// Append text
text.append $myText {
  value = " appended"
}

// Prepend text
text.prepend $myText {
  value = "prepended "
}

// Trim text
text.trim $myText {
  value = " "
}

// Left/right trim
text.ltrim $myText { value = " " }
text.rtrim $myText { value = " " }

// Starts with (case-sensitive, returns boolean)
text.starts_with $myText { value = "Hello" } as $result
text.istarts_with $myText { value = "hello" } as $result  // case-insensitive

// Ends with
text.ends_with $myText { value = "world" } as $result
text.iends_with $myText { value = "WORLD" } as $result    // case-insensitive

// Contains
text.contains $myText { value = "search" } as $found
text.icontains $myText { value = "SEARCH" } as $found     // case-insensitive
```

---

## Math Operations (Functions)

All math functions modify the variable in place:

```
math.add $myVar { value = 5 }       // Add
math.sub $myVar { value = 3 }       // Subtract
math.mul $myVar { value = 2 }       // Multiply
math.div $myVar { value = 4 }       // Divide
math.mod $myVar { value = 3 }       // Modulus

// Bitwise
math.bitwise.and $myVar { value = 5 }
math.bitwise.or $myVar { value = 3 }
math.bitwise.xor $myVar { value = 7 }
```

---

## Object Operations

```
// Get keys
object.keys { value = $myObject } as $keys

// Get values
object.values { value = $myObject } as $values

// Get entries (key-value pairs)
object.entries { value = $myObject } as $entries
```

---

## Security Functions

### Authentication

```
// Create auth token
security.create_auth_token {
  table = "users"
  id = $user.id
  extras = {"role": "admin"}
  expiration = 86400
} as $authToken

// Check password
security.check_password {
  text_password = $input.password
  hash_password = $user.password
} as $isValid
```

### Generators

```
// Generate UUID
security.create_uuid as $uuid

// Generate password
security.create_password {
  character_count = 12
  require_lowercase = true
  require_uppercase = true
  require_digit = true
  require_symbol = true
  symbol_whitelist = "$#%&"
} as $password

// Random number
security.random_number {
  min = 0
  max = 100
} as $random

// Random bytes
security.random_bytes {
  length = 16
} as $bytes
```

### Encryption

```
// Create secret key
security.create_secret_key {
  bits = 2048
  format = "object"
} as $key

// Create RSA key pair
security.create_rsa_key {
  bits = 2048
  format = "object"
} as $keyPair

// Create elliptic curve key
security.create_curve_key {
  curve = "P-256"
  format = "object"
} as $ecKey

// Encrypt data
security.encrypt {
  data = $sensitive
  algorithm = "aes-256-cbc"
  key = "encryption_key"
  iv = "init_vector"
} as $encrypted

// Decrypt data
security.decrypt {
  data = $encrypted
  algorithm = "aes-256-cbc"
  key = "encryption_key"
  iv = "init_vector"
} as $decrypted
```

### JWT (JWS/JWE)

```
// Sign JWS token
security.jws_encode {
  headers = {"alg": "HS256"}
  claims = {"user_id": "123"}
  key = "signing_key"
  signature_algorithm = "HS256"
  ttl = 3600
} as $token

// Verify JWS token
security.jws_decode {
  token = $jws_token
  key = "signing_key"
  check_claims = {"user_id": "123"}
  signature_algorithm = "HS256"
  timeDrift = 0
} as $payload

// Encrypt JWE token
security.jwe_encode {
  headers = {"alg": "A256KW"}
  claims = {"data": "secret"}
  key = "encryption_key"
  key_algorithm = "A256KW"
  content_algorithm = "A256GCM"
  ttl = 0
} as $jweToken

// Decrypt JWE token
security.jwe_decode {
  token = $jweToken
  key = "decryption_key"
  check_claims = {"iss": "my_app"}
  key_algorithm = "A256KW"
  content_algorithm = "A256GCM"
  timeDrift = 0
} as $decoded
```

---

## Utility Functions

### Control Flow

```
// Return value (terminates execution)
return {
  value = $result
}

// Debug log (does not affect execution)
debug.log {
  value = $someVariable
}

// Precondition (validate, throw error if fails)
precondition {
  conditions = `$user|is_not_null`
  type = "notfound"         // notfound | accessdenied | unauthorized | badrequest
  message = "User not found"
  payload = {}
}

// Try/catch error handling
try_catch {
  try {
    // risky operations
  }
  catch ($error) {
    debug.log { value = $error }
  }
  finally {
    // always runs
  }
}

// Throw error
throw {
  type = "badrequest"
  message = "Invalid input"
}

// Stop and debug (development only)
stop_and_debug {
  value = $someVariable
}
```

### Execution

```
// Post process (runs after response is sent)
post_process {
  stack {
    // logging, cleanup, side effects
  }
}

// Group/stack (organize sequential operations)
group {
  stack {
    // operations
  }
}

// Sleep
sleep {
  seconds = 1.5
}

// Async await (wait for concurrent operations)
async_await {
  timeout = 30
  stack {
    // concurrent operations
  }
} as $results
```

### Data Access

```
// Get all variables
util.get_all_variables as $allVars

// Get all inputs
util.get_all_inputs as $allInputs

// Get raw input
util.get_all_raw_input {
  encoding = "json"    // json | raw | text
} as $rawInput

// Get environment variables
util.get_env_vars as $envVars

// Set HTTP response header
util.set_http_header {
  key = "X-Custom-Header"
  value = "my-value"
  duplicate = "replace"    // replace | append
}

// IP address lookup
util.ip_lookup {
  ip = $request_ip
} as $geoInfo

// Calculate distance between coordinates
util.calculate_distance {
  lat1 = 40.7128
  lon1 = -74.0060
  lat2 = 34.0522
  lon2 = -118.2437
} as $distance

// Set datasource
util.set_datasource {
  datasource = "production"    // live | test | staging | custom
}
```

### Streaming

```
// CSV stream
stream.from_csv {
  separator = ","
  enclosure = "\""
  escape = "\\"
} as $csvStream

// JSONL stream
stream.from_jsonl {
  source = $fileOrInput
} as $jsonlStream
```

---

## API & Lambda Functions

### External API Request

```
api.request {
  url = "https://api.example.com/users"
  method = "GET"                              // GET | POST | PUT | DELETE | PATCH
  params = {}|set:"page":1
  headers = []|push:"Authorization: Bearer $token"
} as $response
```

### Lambda (Inline JavaScript)

```
api.lambda {
  code = "return input.a + input.b;"
  timeout = 10
} as $result
```

Use lambdas only for NPM dependencies, cryptography, or logic impossible with native functions. Prefer XanoScript for all other use cases.

### Streaming API Request

```
stream.from_request {
  as = "events"
  url = "https://api.service.com/stream"
  method = "GET"
  timeout = 30
  follow_location = true
  verify_host = true
  verify_peer = true
} as $stream
```

### Streaming API Response

```
api.stream {
  value = $chunk
}
```

### Realtime Events

```
api.realtime_event {
  channel = "user:"|add:$user.id
  data = {type: "notification", message: "Hello"}
  auth_table = "users"
  auth_id = $user.id
}
```

---

## Redis Caching

```
// Set value with TTL
redis.set {
  key = "user:"|add:$user.id
  data = $user.profile
  ttl = 3600
}

// Get value
redis.get { key = "session:"|add:$id } as $data

// Check existence
redis.has { key = "cache:"|add:$key } as $exists

// Delete
redis.del { key = "temp:"|add:$id }

// Increment
redis.incr { key = "visits:"|add:$page.id, by = 1 } as $count

// Decrement
redis.decr { key = "stock:"|add:$id, by = 1 } as $remaining

// Search keys
redis.keys { search = "user" } as $keys

// List operations
redis.push { key = "queue", value = $item } as $length
redis.unshift { key = "recent", value = $item } as $length
redis.pop { key = "stack" } as $item
redis.shift { key = "queue" } as $item
redis.remove { key = "list", value = $item, count = 0 }
redis.count { key = "queue" } as $size
redis.range { key = "posts", start = 0, stop = 9 } as $items

// Rate limiting
redis.ratelimit {
  key = "ip:"|add:$request.ip
  max = 100
  ttl = 3600
  error = "Rate limit exceeded"
} as $status
```

---

## File Storage

```
// Create image metadata
storage.create_image {
  access = "public"         // public | private
  value = $input.file
  filename = "avatar_"|add:$user.id|add:".jpg"
} as $image

// Create video / audio / attachment (same syntax)
storage.create_video { access = "private", value = $input.file, filename = "vid.mp4" } as $video
storage.create_audio { access = "public", value = $input.file, filename = "audio.mp3" } as $audio
storage.create_attachment { access = "private", value = $input.file, filename = "doc.pdf" } as $doc

// Create file from data
storage.create_file_resource {
  filename = "export.csv"
  filedata = $csvData
} as $file

// Read file contents
storage.read_file_resource {
  value = $fileRef
} as $contents

// Delete file (permanent, use with caution)
storage.delete_file {
  value = "/path/to/file"
}

// Sign private URL (temporary access)
storage.sign_private_url {
  pathname = "/private/file.pdf"
  ttl = 3600
} as $signedUrl
```

---

## AI Tools

```
// Call AI agent
ai.agent.run "Agent Name" {
  args = {prompt: "Summarize this data"}
  allow_tool_execution = true
} as $agentResult

// List MCP tools
ai.external.mcp.tool.list {
  url = "https://mcp.example.com"
  api_key = "key"
} as $tools

// Call MCP tool
ai.external.mcp.tool.run {
  url = "https://mcp.example.com"
  api_key = "key"
  tool_name = "search"
  input = {query: "example"}
} as $result

// Get MCP server details
ai.external.mcp.server_details {
  url = "https://mcp.example.com"
  api_key = "key"
} as $details

// Template engine (Twig syntax)
util.template_engine {
  template = "Hello {{ name }}{% if vip %}, VIP member{% endif %}"
  data = {name: "John", vip: true}
} as $rendered
```

---

## Actions

```
action.call "Action Name" {
  input = {param1: "value1"}
  registry = {key: "value"}
} as $actionResult
```

Actions must be pre-imported to your workspace.

---

## Custom Function Calls

```
function.run "path/function_name" {
  input = {
    param1: "value",
    param2: 42
  }
} as $result
```

Wrap in `try_catch` if the function uses preconditions or input validation that may throw errors.
