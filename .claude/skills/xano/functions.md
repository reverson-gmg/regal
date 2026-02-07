# XanoScript Built-in Functions Reference

All functions use `namespace.function` syntax. Results are captured with `as $variable`.

---

## Database Operations

### db.query — Query Records

The most powerful database function. Retrieves records with filtering, joins, sorting, computed fields, and pagination.

```
db.query <table> {
  where = <condition>
  join = {<alias>: {table: "<table>", type: "inner|left|right", where: <condition>}}
  addon = {<alias>: {name: "<addon_name>", input: {<inputs>}}}
  eval = {<custom_field>: <expression>}
  sort = {<table>.<field>: "asc"|"desc"}
  output = ["field1", "field2"]
  return = {
    type: "list"|"single"|"count"|"exists"|"stream"|"aggregate",
    paging: {page: 1, per_page: 25, offset: 0, totals: true, metadata: true}
  }
} as $results
```

#### Where Conditions

Where clauses use `$db.<table>.<field>` syntax with operators:

```
// Equality
where = $db.user.id == $input.user_id
where = $db.user.status != "banned"

// Strict type matching
where = $db.user.id === 1          // exact value AND type match
where = $db.user.id !== "1"        // not equal value or type

// Comparison
where = $db.order.total > 100
where = $db.user.age >= 18
where = $db.product.stock < 10
where = $db.event.date <= "now"

// Text matching (case-insensitive)
where = $db.user.name|LIKE:"john%"              // starts with "john"
where = $db.user.email|NOT LIKE:"%spam%"        // does not contain "spam"
where = $db.product.name|INCLUDES:$input.search  // partial match, case-insensitive
where = $db.user.bio|DOES NOT INCLUDE:"banned"

// Array/collection operators
where = $db.user.role|IN:["admin","editor"]       // value in array
where = $db.user.status|NOT IN:["banned","suspended"]
where = $db.post.tags|OVERLAPS:$input.tags        // any values overlap
where = $db.post.tags|DOES NOT OVERLAP:["spam"]

// JSON/array schema matching
where = $db.user.metadata|CONTAINS:$search_obj    // exact schema match in JSON
where = $db.user.metadata|DOES NOT CONTAIN:$excluded

// Regular expressions
where = $db.user.email|REGEX MATCHES:"^[a-z]+@"
where = $db.user.name|REGEX DOES NOT MATCH:"[0-9]"

// Compound conditions
where = $db.user.role == "admin" && $db.user.active == true
where = $db.user.status == "active" || $db.user.role == "admin"
where = ($db.order.total > 100 || $db.order.priority == true) && $db.order.status == "pending"
```

#### Join Types

Joins connect records across tables in a single query:

```
db.query order {
  // Inner join: only records with matches in both tables
  join = {
    customer: {
      table: "user",
      type: "inner",
      where: $db.order.user_id == $db.user.id
    }
  }
  return = {type: "list"}
} as $orders

db.query user {
  // Left join: all users, even without orders
  join = {
    orders: {
      table: "order",
      type: "left",
      where: $db.user.id == $db.order.user_id
    }
  }
  return = {type: "list"}
} as $users

db.query order {
  // Right join: all orders, even without matching customers
  join = {
    customer: {
      table: "user",
      type: "right",
      where: $db.order.user_id == $db.user.id
    }
  }
  return = {type: "list"}
} as $orders
```

#### Eval (Computed Fields)

Add fields from joined tables or compute derived values:

```
db.query sale {
  join = {
    product: {
      table: "product",
      where: $db.sale.product_id == $db.product.id
    }
  }
  eval = {
    product_name: $db.product.name,
    line_total: `$db.sale.quantity * $db.product.price`
  }
  return = {type: "list"}
} as $sales
```

#### Addons

Enrich query results with related data via table reference fields:

```
db.query user {
  addon = {
    recent_posts: {
      name: "user_posts",
      input: {limit: 5}
    }
  }
  return = {type: "list"}
} as $users
```

Empty addons (no matching data) are omitted from the response.

#### Return Types

| Type | Result | Use Case |
|------|--------|----------|
| `list` | Array of records | Paginated listings |
| `single` | First matching record | Lookup by criteria |
| `count` | Number of matches | Totals, analytics |
| `exists` | Boolean | Existence checks |
| `stream` | Iterator | Large datasets, memory-efficient |
| `aggregate` | Aggregation result | SUM, AVG, etc. |

```
// Paginated list
db.query product {
  where = $db.product.active == true
  sort = {product.created_at: "desc"}
  return = {type: "list", paging: {page: $input.page, per_page: 25, totals: true}}
} as $products

// Count
db.query order {
  where = $db.order.status == "pending"
  return = {type: "count"}
} as $pendingCount

// Exists
db.query user {
  where = $db.user.email == $input.email
  return = {type: "exists"}
} as $emailTaken

// Stream (for large datasets)
db.query log {
  where = $db.log.created_at > $cutoff
  return = {type: "stream"}
} as $logStream
```

#### Pagination Metadata

When paging is enabled, the response includes metadata:
- `itemsReceived` — number of records in this page
- `curPage` — current page number
- `nextPage` — next page (null if last)
- `prevPage` — previous page (null if first)
- `offset` — record offset
- `perPage` — records per page
- `totalItems` — total records (when `totals: true`)
- `totalPages` — total pages (when `totals: true`)

---

### db.get — Single Record Lookup

```
db.get <table> {
  field_name = "<field>"
  field_value = <value>
  output = ["field1", "field2"]
} as $record
```

Returns `null` if not found. **Always validate with `precondition`:**

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

### db.has — Existence Check

```
db.has <table> {
  field_name = "<field>"
  field_value = <value>
} as $exists    // boolean
```

### db.add — Create Record

```
db.add <table> {
  data = {
    name: $input.name,
    email: $input.email,
    created_at: "now"
  }
} as $newRecord
```

Use `"now"` for current timestamp in `created_at` fields.

### db.edit — Update Record

Updates specified fields; other fields remain unchanged:

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

### db.patch — Targeted Field Update

Similar to `db.edit` but uses `|set:` operator syntax for explicit field targeting. Useful when building the update data dynamically:

```
db.patch <table> {
  field_name = "id"
  field_value = $input.id
  data = "{}"|json_decode|set:"status":"active"|set:"updated_at":"now"
} as $patched
```

**Key difference from `db.edit`:** `db.patch` data is built using `|set:` chains, making it ideal for conditional field updates:

```
var $update_data {
  value = "{}"|json_decode
}

conditional {
  if (`$input.name|is_not_null`) {
    var.update $update_data { value = $update_data|set:"name":$input.name }
  }
  if (`$input.email|is_not_null`) {
    var.update $update_data { value = $update_data|set:"email":$input.email }
  }
}

db.patch user {
  field_name = "id"
  field_value = $input.user_id
  data = $update_data
} as $patched
```

### db.del — Delete Record

```
db.del <table> {
  field_name = "id"
  field_value = $input.id
}
```

### db.add_or_edit — Upsert

Creates or updates based on lookup field:

```
db.add_or_edit <table> {
  field_name = "email"
  field_value = $input.email
  data = {
    name: $input.name,
    email: $input.email,
    updated_at: "now"
  }
} as $result
```

---

### Bulk Operations

```
// Bulk insert
db.bulk.add <table> {
  items = $input.items
  allow_id_field = false
} as $results

// Bulk update
db.bulk.update <table> {
  items = [{id: 1, status: "active"}, {id: 2, status: "inactive"}]
} as $results

// Bulk patch
db.bulk.patch <table> {
  items = [
    "{}"|json_decode|set:"id":1|set:"role":"admin",
    "{}"|json_decode|set:"id":2|set:"role":"editor"
  ]
} as $results

// Bulk delete by search
db.bulk.delete <table> {
  search = $db.<table>.status == "inactive"
} as $results
```

### Direct SQL Query

For operations not possible with the query builder:

```
// Prepared statement (default, safe from injection)
db.direct_query {
  sql = "SELECT * FROM users WHERE id = ?"
  arg = [$input.id]
  response_type = "list"
} as $results

// Template engine parser (use sql_esc for safety)
db.direct_query {
  sql = "SELECT * FROM users WHERE id = {{ $input.id|sql_esc }}"
  parser = "template_engine"
  response_type = "single"
} as $user
```

### Transactions

Wrap multiple operations in an atomic transaction:

```
db.transaction {
  stack {
    db.add order {
      data = {user_id: $auth.id, total: $total, created_at: "now"}
    } as $order

    db.edit product {
      field_name = "id"
      field_value = $input.product_id
      data = {stock: `$product.stock - $input.quantity`}
    }

    db.add order_item {
      data = {order_id: $order.id, product_id: $input.product_id, quantity: $input.quantity}
    }
  }
}
```

If any operation fails, all changes are rolled back.

### Other Database Operations

```
// Truncate table (reset = true resets auto-increment)
db.truncate <table> { reset = true }

// Get table schema
db.schema <table> { path = "" } as $schema

// External databases
db.external.postgres.direct_query {
  sql = "SELECT * FROM users WHERE id = 1"
  response_type = "list"
  connection_string = "postgres://user:pass@host:5432/db"
} as $results
// Also: db.external.mysql, db.external.mssql, db.external.oracle
```

---

## Variable Operations

```
// Create variable
var myVar { value = "Hello" }

// Update variable ($ prefix required)
var.update $myVar { value = "World" }

// CRITICAL: arrays and objects require json_decode
var items { value = "[1, 2, 3]"|json_decode }
var config { value = '{"key": "value"}'|json_decode }
```

---

## Array Operations (Functions)

Array functions in the stack use `$this` to reference the current element (unlike filter conditions which use `x`).

```
// Add to end
array.push $myArray { value = "new item" }

// Add to beginning
array.unshift $myArray { value = "first item" }

// Remove from end
array.pop $myArray as $removed

// Remove from beginning
array.shift $myArray as $removed

// Merge arrays
array.merge $myArray { value = $otherArray }

// Set operations
array.union $arrayA $arrayB as $result
array.intersect $arrayA $arrayB as $result
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
array.map ($myArray) as $mapped { value = $this * 2 }

// Partition by condition
array.partition ($myArray) if (`$this > 0`) as $partitioned

// Group by key
array.group_by ($myArray) as $grouped { key = $this.category }
```

---

## Text Operations (Functions)

```
text.append $myText { value = " appended" }
text.prepend $myText { value = "prepended " }
text.trim $myText { value = " " }
text.ltrim $myText { value = " " }
text.rtrim $myText { value = " " }

// Boolean returns
text.starts_with $myText { value = "Hello" } as $result
text.istarts_with $myText { value = "hello" } as $result  // case-insensitive
text.ends_with $myText { value = "world" } as $result
text.iends_with $myText { value = "WORLD" } as $result
text.contains $myText { value = "search" } as $found
text.icontains $myText { value = "SEARCH" } as $found
```

---

## Math Operations (Functions)

All math functions modify the variable in place:

```
math.add $myVar { value = 5 }
math.sub $myVar { value = 3 }
math.mul $myVar { value = 2 }
math.div $myVar { value = 4 }
math.mod $myVar { value = 3 }

// Bitwise
math.bitwise.and $myVar { value = 5 }
math.bitwise.or $myVar { value = 3 }
math.bitwise.xor $myVar { value = 7 }
```

---

## Object Operations

```
object.keys { value = $myObject } as $keys
object.values { value = $myObject } as $values
object.entries { value = $myObject } as $entries
```

---

## Security Functions

### Authentication

```
// Create auth token
security.create_auth_token {
  table = "user"
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
security.create_uuid as $uuid
security.random_number { min = 0, max = 100 } as $random
security.random_bytes { length = 16 } as $bytes

security.create_password {
  character_count = 12
  require_lowercase = true
  require_uppercase = true
  require_digit = true
  require_symbol = true
  symbol_whitelist = "$#%&"
} as $password
```

### Encryption

```
// Create secret key
security.create_secret_key { bits = 2048, format = "object" } as $key

// RSA key pair
security.create_rsa_key { bits = 2048, format = "object" } as $keyPair

// Elliptic curve key
security.create_curve_key { curve = "P-256", format = "object" } as $ecKey

// Encrypt / decrypt
security.encrypt {
  data = $sensitive
  algorithm = "aes-256-cbc"
  key = $env.ENCRYPTION_KEY
  iv = $env.ENCRYPTION_IV
} as $encrypted

security.decrypt {
  data = $encrypted
  algorithm = "aes-256-cbc"
  key = $env.ENCRYPTION_KEY
  iv = $env.ENCRYPTION_IV
} as $decrypted
```

### JWT (JWS/JWE)

```
// Sign JWS token
security.jws_encode {
  headers = {"alg": "HS256"}
  claims = {"user_id": $user.id, "role": $user.role}
  key = $env.JWT_SECRET
  signature_algorithm = "HS256"
  ttl = 3600
} as $token

// Verify JWS token
security.jws_decode {
  token = $input.token
  key = $env.JWT_SECRET
  signature_algorithm = "HS256"
  timeDrift = 0
} as $payload

// Encrypt JWE token
security.jwe_encode {
  headers = {"alg": "A256KW"}
  claims = {"data": "secret"}
  key = $env.JWE_KEY
  key_algorithm = "A256KW"
  content_algorithm = "A256GCM"
  ttl = 0
} as $jweToken

// Decrypt JWE token
security.jwe_decode {
  token = $jweToken
  key = $env.JWE_KEY
  key_algorithm = "A256KW"
  content_algorithm = "A256GCM"
  timeDrift = 0
} as $decoded
```

---

## Utility Functions

### Control Flow

```
// Return value (terminates execution immediately)
return { value = $result }

// Debug log
debug.log { value = $someVariable }

// Precondition (validate, throw typed error if fails)
precondition {
  conditions = `$user|is_not_null`
  type = "notfound"               // notfound | accessdenied | unauthorized | badrequest
  message = "User not found"
  payload = {}                    // optional additional data
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

// Throw error explicitly
throw {
  type = "badrequest"
  message = "Invalid input"
}

// Stop and debug (development only — halts execution, returns value)
stop_and_debug { value = $suspiciousVariable }
```

### Execution

```
// Post process (runs AFTER response is sent to client)
post_process {
  stack {
    // logging, cleanup, side effects
  }
}

// Group (organize sequential operations)
group {
  stack {
    // operations
  }
}

// Sleep
sleep { seconds = 1.5 }

// Async await (concurrent operations)
async_await {
  timeout = 30
  stack {
    // concurrent operations
  }
} as $results
```

### Data Access

```
util.get_all_variables as $allVars
util.get_all_inputs as $allInputs
util.get_all_raw_input { encoding = "json" } as $rawInput    // json | raw | text
util.get_env_vars as $envVars

// Set HTTP response header
util.set_http_header {
  key = "X-Custom-Header"
  value = "my-value"
  duplicate = "replace"    // replace | append
}

// IP geolocation
util.ip_lookup { ip = $request_ip } as $geoInfo

// Distance between coordinates
util.calculate_distance {
  lat1 = 40.7128, lon1 = -74.0060
  lat2 = 34.0522, lon2 = -118.2437
} as $distance

// Switch datasource
util.set_datasource { datasource = "production" }
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
stream.from_jsonl { source = $fileOrInput } as $jsonlStream
```

---

## API & Lambda Functions

### External API Request

```
api.request {
  url = "https://api.example.com/users"
  method = "GET"                    // GET | POST | PUT | DELETE | PATCH
  params = "{}"|json_decode|set:"page":1
  headers = "[]"|json_decode|push:"Authorization: Bearer "|concat:$env.API_KEY
  timeout = 30
  follow_location = true
  verify_host = true
  verify_peer = true
} as $response
// $response.status, $response.headers, $response.body
```

**Always wrap in `try_catch` for production code:**

```
try_catch {
  try {
    api.request {
      url = "https://api.stripe.com/v1/charges"
      method = "POST"
      headers = "[]"|json_decode|push:"Authorization: Bearer "|concat:$env.STRIPE_KEY
      params = {amount: $total, currency: "usd"}
    } as $charge
  }
  catch ($error) {
    debug.log { value = $error }
    precondition {
      conditions = `false`
      type = "badrequest"
      message = "Payment processing failed"
    }
  }
}
```

### Lambda (Inline JavaScript)

Use only for NPM dependencies, cryptography, or logic impossible with native functions:

```
api.lambda {
  code = "return input.a + input.b;"
  timeout = 10
} as $result
```

### Streaming API

```
// Stream request (SSE, etc.)
stream.from_request {
  as = "events"
  url = "https://api.service.com/stream"
  method = "GET"
  timeout = 30
} as $stream

// Stream response (send chunks to client)
api.stream { value = $chunk }
```

### Realtime Events

```
api.realtime_event {
  channel = "user:"|concat:$user.id|to_text
  data = {type: "notification", message: "New message"}
  auth_table = "user"
  auth_id = $user.id
}
```

---

## Redis Caching

```
// Set with TTL
redis.set {
  key = "user:"|concat:$user.id|to_text
  data = $user.profile
  ttl = 3600
}

// Get
redis.get { key = "session:"|concat:$id } as $data

// Check existence
redis.has { key = "cache:"|concat:$key } as $exists

// Delete
redis.del { key = "temp:"|concat:$id }

// Increment / Decrement
redis.incr { key = "visits:"|concat:$page_id|to_text, by = 1 } as $count
redis.decr { key = "stock:"|concat:$product_id|to_text, by = 1 } as $remaining

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
  key = "ip:"|concat:$request_ip
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
  filename = "avatar_"|concat:$user.id|to_text|concat:".jpg"
} as $image

// Create other file types (same syntax)
storage.create_video { access = "private", value = $input.file, filename = "vid.mp4" } as $video
storage.create_audio { access = "public", value = $input.file, filename = "audio.mp3" } as $audio
storage.create_attachment { access = "private", value = $input.file, filename = "doc.pdf" } as $doc

// Create file from data
storage.create_file_resource {
  filename = "export.csv"
  filedata = $csvData
} as $file

// Read file contents
storage.read_file_resource { value = $fileRef } as $contents

// Delete file (permanent)
storage.delete_file { value = "/path/to/file" }

// Sign private URL (temporary access)
storage.sign_private_url {
  pathname = "/private/file.pdf"
  ttl = 3600
} as $signedUrl
```

---

## Cloud Services

### AWS S3

```
cloud.aws.s3.list_directory {
  bucket = "my-bucket"
  region = "us-east-1"
  access_key = $env.AWS_ACCESS_KEY
  secret_key = $env.AWS_SECRET_KEY
  path = "uploads/"
} as $files

cloud.aws.s3.get_object {
  bucket = "my-bucket"
  region = "us-east-1"
  access_key = $env.AWS_ACCESS_KEY
  secret_key = $env.AWS_SECRET_KEY
  path = "file.pdf"
} as $object

cloud.aws.s3.put_object {
  bucket = "my-bucket"
  region = "us-east-1"
  access_key = $env.AWS_ACCESS_KEY
  secret_key = $env.AWS_SECRET_KEY
  path = "uploads/file.pdf"
  body = $fileData
  content_type = "application/pdf"
} as $result

cloud.aws.s3.delete_object {
  bucket = "my-bucket"
  region = "us-east-1"
  access_key = $env.AWS_ACCESS_KEY
  secret_key = $env.AWS_SECRET_KEY
  path = "uploads/old-file.pdf"
}

cloud.aws.s3.create_signed_url {
  bucket = "my-bucket"
  region = "us-east-1"
  access_key = $env.AWS_ACCESS_KEY
  secret_key = $env.AWS_SECRET_KEY
  path = "private/file.pdf"
  ttl = 3600
} as $signedUrl

cloud.aws.s3.create_upload_signed_url {
  bucket = "my-bucket"
  region = "us-east-1"
  access_key = $env.AWS_ACCESS_KEY
  secret_key = $env.AWS_SECRET_KEY
  path = "uploads/new-file.pdf"
  content_type = "application/pdf"
  ttl = 3600
} as $uploadUrl
```

### Google Cloud Storage

```
cloud.google.storage.list_directory {
  service_account = $env.GCS_SERVICE_ACCOUNT
  bucket = "my-bucket"
  path = "uploads/"
} as $files

cloud.google.storage.get_object {
  service_account = $env.GCS_SERVICE_ACCOUNT
  bucket = "my-bucket"
  path = "file.pdf"
} as $object

cloud.google.storage.put_object {
  service_account = $env.GCS_SERVICE_ACCOUNT
  bucket = "my-bucket"
  path = "uploads/file.pdf"
  body = $fileData
  content_type = "application/pdf"
} as $result

cloud.google.storage.delete_object {
  service_account = $env.GCS_SERVICE_ACCOUNT
  bucket = "my-bucket"
  path = "old-file.pdf"
}

cloud.google.storage.create_signed_url {
  service_account = $env.GCS_SERVICE_ACCOUNT
  bucket = "my-bucket"
  path = "private/file.pdf"
  ttl = 3600
} as $signedUrl

cloud.google.storage.create_upload_signed_url {
  service_account = $env.GCS_SERVICE_ACCOUNT
  bucket = "my-bucket"
  path = "uploads/new-file.pdf"
  content_type = "application/pdf"
  ttl = 3600
} as $uploadUrl
```

### Azure Blob Storage

```
cloud.azure.storage.list_directory {
  account_name = $env.AZURE_ACCOUNT
  account_key = $env.AZURE_KEY
  container = "my-container"
  path = "uploads/"
} as $files

cloud.azure.storage.get_object {
  account_name = $env.AZURE_ACCOUNT
  account_key = $env.AZURE_KEY
  container = "my-container"
  path = "file.pdf"
} as $object

cloud.azure.storage.put_object {
  account_name = $env.AZURE_ACCOUNT
  account_key = $env.AZURE_KEY
  container = "my-container"
  path = "uploads/file.pdf"
  body = $fileData
  content_type = "application/pdf"
} as $result

cloud.azure.storage.delete_object {
  account_name = $env.AZURE_ACCOUNT
  account_key = $env.AZURE_KEY
  container = "my-container"
  path = "old-file.pdf"
}
```

### Elasticsearch

```
cloud.elasticsearch.request {
  auth_type = "basic"
  key_id = $env.ES_USER
  access_key = $env.ES_PASSWORD
  method = "POST"
  url = "https://my-cluster.es.amazonaws.com/my-index/_search"
  query = {
    query: {match: {title: $input.search}}
  }
} as $results
```

### AWS OpenSearch

```
cloud.aws.opensearch.request {
  region = "us-east-1"
  access_key = $env.AWS_ACCESS_KEY
  secret_key = $env.AWS_SECRET_KEY
  method = "POST"
  url = "https://my-domain.us-east-1.es.amazonaws.com/my-index/_search"
  query = {query: {match_all: {}}}
} as $results
```

### Algolia

```
cloud.algolia.request {
  application_id = $env.ALGOLIA_APP_ID
  api_key = $env.ALGOLIA_API_KEY
  url = "https://"|concat:$env.ALGOLIA_APP_ID|concat:".algolia.net/1/indexes/products/query"
  method = "POST"
  payload = {query: $input.search, hitsPerPage: 20}
} as $results
```

---

## AI Tools

```
// Call AI agent
ai.agent.run "Agent Name" {
  args = {prompt: "Summarize this data", data: $input.text}
  allow_tool_execution = true
} as $agentResult

// List MCP tools
ai.external.mcp.tool.list {
  url = "https://mcp.example.com"
  api_key = $env.MCP_KEY
} as $tools

// Call MCP tool
ai.external.mcp.tool.run {
  url = "https://mcp.example.com"
  api_key = $env.MCP_KEY
  tool_name = "search"
  input = {query: "example"}
} as $result

// Template engine (Twig syntax)
util.template_engine {
  template = "Hello {{ name }}{% if vip %}, VIP member{% endif %}"
  data = {name: "John", vip: true}
} as $rendered
```

---

## Actions & Custom Functions

```
// Call a custom function
function.run "path/function_name" {
  input = { param1: "value", param2: 42 }
} as $result

// Call an imported action
action.call "Action Name" {
  input = {param1: "value1"}
  registry = {key: "value"}
} as $actionResult
```

Wrap in `try_catch` if the function uses preconditions or input validation that may throw:

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
      message = "Invalid authentication token"
    }
  }
}
```

---

## Common Mistakes

1. **Not capturing function output with `as`.** Every function that produces a result needs `as $variable` to capture it. Without it, the result is lost.
   ```
   // WRONG — result is lost
   db.get user { field_name = "id", field_value = $input.id }

   // RIGHT
   db.get user { field_name = "id", field_value = $input.id } as $user
   ```

2. **Accessing properties on null.** If `db.get` returns null, accessing `$result.name` crashes. Always use `precondition` first.
   ```
   // WRONG — crashes if user not found
   db.get user { field_name = "id", field_value = 999 } as $user
   debug.log { value = $user.name }

   // RIGHT — validate first
   db.get user { field_name = "id", field_value = 999 } as $user
   precondition {
     conditions = `$user|is_not_null`
     type = "notfound"
     message = "User not found"
   }
   debug.log { value = $user.name }
   ```

3. **Skipping ownership validation before mutations.** Always verify the authenticated user owns the record before editing or deleting.
   ```
   db.get post { field_name = "id", field_value = $input.post_id } as $post

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
     data = {title: $input.title}
   }
   ```

4. **Using `db.edit` when you need dynamic field updates.** Use `db.patch` with `|set:` chains for conditional/dynamic updates.

5. **Not wrapping external API calls in `try_catch`.** External services can fail. Always handle failures gracefully.

6. **Hardcoding secrets.** Use `$env.API_KEY` for all keys, tokens, credentials. Never embed them in code.

7. **Over-fetching from the database.** Use `output = ["field1", "field2"]` to limit returned columns. Use pagination for lists.

8. **Forgetting `|to_text` in string concatenation for Redis/storage keys.** When concatenating numeric IDs into key strings, convert to text first.
