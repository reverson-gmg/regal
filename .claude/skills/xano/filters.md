# XanoScript Filter Reference

Filters transform data inline using pipe syntax. They are the primary mechanism for data transformation in XanoScript — use them to reshape, validate, convert, and compute values without creating intermediate variables.

## Syntax

```
// Basic filter
"hello"|capitalize                              // "Hello"

// Filter with parameters (colon-separated)
"hello"|concat:" world"                         // "hello world"

// Chaining multiple filters (left to right)
"  hello  "|trim|capitalize                     // "Hello"

// Nesting filters (apply filter to a parameter, not the result)
"hello"|concat:"world"|capitalize:", "          // "hello, World"
// Here capitalize applies to "world" inside concat, not to the full result

// Filters on variables
$user.name|trim|to_upper
$items|count
$price|round:2
```

**Critical rule:** Filters execute left-to-right. Each filter receives the output of the previous one. Nesting (applying a filter to a parameter) uses the pattern `|filter:param|nested_filter`.

---

## Array Filters

### Modification

| Filter | Syntax | Result |
|--------|--------|--------|
| `push` | `$arr\|push:item` | Append item to end |
| `unshift` | `$arr\|unshift:item` | Add item to beginning |
| `pop` | `$arr\|pop` | Remove and return last element |
| `shift` | `$arr\|shift` | Remove first, return remaining |
| `append` | `$arr\|append:item:key` | Add item to end (or key-value to object) |
| `prepend` | `$arr\|prepend:item:key` | Add item to beginning (or key-value to object) |

### Filtering

| Filter | Syntax | Result |
|--------|--------|--------|
| `filter` | `$arr\|filter:"x > 2"` | Elements matching condition |
| `filter_empty` | `$arr\|filter_empty` | Remove empty/falsy values |
| `filter_null` | `$arr\|filter_null` | Remove null values |
| `filter_empty_text` | `$arr\|filter_empty_text` | Remove empty strings |
| `filter_empty_array` | `$arr\|filter_empty_array` | Remove empty arrays |
| `filter_empty_object` | `$arr\|filter_empty_object` | Remove empty objects |
| `filter_false` | `$arr\|filter_false` | Remove false booleans |
| `filter_zero` | `$arr\|filter_zero` | Remove zero values |

**Filter conditions** use `x` to reference the current element:
```
"[1,2,3,4,5]"|json_decode|filter:"x > 2"                     // [3, 4, 5]
$users|filter:"x.age > 25"                                    // users older than 25
$orders|filter:"x.status == 'active' && x.total > 100"        // active high-value orders
```

### Search & Selection

| Filter | Syntax | Result |
|--------|--------|--------|
| `find` | `$arr\|find:"x > 1"` | First matching element |
| `findIndex` | `$arr\|findIndex:"x > 1"` | Index of first match |
| `first` | `$arr\|first` | First element |
| `last` | `$arr\|last` | Last element |

### Transformation

| Filter | Syntax | Result |
|--------|--------|--------|
| `map` | `$arr\|map:"x * 2"` | Transform each element |
| `reduce` | `$arr\|reduce:0:"acc + x"` | Accumulate into single value |
| `count` | `$arr\|count` | Number of elements |
| `join` | `$arr\|join:","` | Concatenate with separator |

```
"[1,2,3]"|json_decode|map:"x * 2"           // [2, 4, 6]
"[1,2,3]"|json_decode|reduce:0:"acc + x"    // 6
"[1,2,3]"|json_decode|join:", "              // "1, 2, 3"
$users|map:"x.name"                          // ["Alice", "Bob", "Carol"]
$prices|reduce:0:"acc + x"                  // sum of all prices
```

### Set Operations

| Filter | Syntax | Result |
|--------|--------|--------|
| `diff` | `$a\|diff:$b` | Elements in first not in second |
| `diff_assoc` | `$a\|diff_assoc:$b` | Key-value pairs not matching |
| `intersect` | `$a\|intersect:$b` | Common elements |
| `intersect_assoc` | `$a\|intersect_assoc:$b` | Matching key-value pairs |
| `merge` | `$a\|merge:$b` | Combine arrays or objects |
| `merge_recursive` | `$a\|merge_recursive:$b` | Deep merge nested structures |

### Structural

| Filter | Syntax | Result |
|--------|--------|--------|
| `flatten` | `$arr\|flatten` | Flatten nested arrays one level |
| `reverse` | `$arr\|reverse` | Reverse element order |
| `shuffle` | `$arr\|shuffle` | Randomize order |
| `slice` | `$arr\|slice:offset:length` | Extract subsequence |
| `unique` | `$arr\|unique:key` | Remove duplicates (optional key for objects) |
| `sort` | `$arr\|sort` | Sort elements ascending |

### Key-Value

| Filter | Syntax | Result |
|--------|--------|--------|
| `keys` | `$obj\|keys` | Extract all keys as array |
| `values` | `$obj\|values` | Extract all values as array |
| `entries` | `$obj\|entries` | Convert to `[{key, value}]` pairs |
| `pick` | `$obj\|pick:["a","b"]` | Keep only specified keys |
| `unpick` | `$obj\|unpick:["a","b"]` | Remove specified keys |
| `index_by` | `$arr\|index_by:"id"` | Create object indexed by property |
| `remove` | `$arr\|remove:item:key:strict` | Remove matching elements |

### Logical

| Filter | Syntax | Result |
|--------|--------|--------|
| `every` | `$arr\|every:"x > 0"` | True if all elements match |
| `some` | `$arr\|some:"x > 0"` | True if any element matches |

### Utility

| Filter | Syntax | Result |
|--------|--------|--------|
| `range` | `null\|range:1:5` | Generate `[1, 2, 3, 4, 5]` |
| `safe_array` | `$val\|safe_array` | Convert null/non-array to empty array |

---

## Comparison Filters

### Equality & Logic

| Filter | Syntax | Result |
|--------|--------|--------|
| `equals` | `$a\|equals:$b` | Strict equality (boolean) |
| `not_equals` / `ne` | `$a\|not_equals:$b` | Not equal (boolean) |
| `and` | `$a\|and:$b` | Both truthy |
| `or` | `$a\|or:$b` | At least one truthy |
| `not` | `$val\|not` | Negate boolean |
| `ternary` | `$cond\|ternary:"yes":"no"` | Conditional value |
| `coalesce` | `$val\|coalesce:"default"` | Return default if null/empty |

### Numeric

| Filter | Syntax | Result |
|--------|--------|--------|
| `greater_than` | `$val\|greater_than:10` | True if > 10 |
| `greater_than_or_equal` | `$val\|greater_than_or_equal:10` | True if >= 10 |
| `less_than` | `$val\|less_than:10` | True if < 10 |
| `less_than_or_equal` | `$val\|less_than_or_equal:10` | True if <= 10 |
| `even` | `$val\|even` | Is even number |
| `odd` | `$val\|odd` | Is odd number |

### Membership

| Filter | Syntax | Result |
|--------|--------|--------|
| `in` | `$val\|in:["a","b"]` | Value exists in array |
| `not_in` | `$val\|not_in:["a","b"]` | Value not in array |

### Type Checking

| Filter | Syntax | Result |
|--------|--------|--------|
| `is_array` | `$val\|is_array` | Is array |
| `is_bool` | `$val\|is_bool` | Is boolean |
| `is_decimal` | `$val\|is_decimal` | Is floating-point |
| `is_int` | `$val\|is_int` | Is integer |
| `is_object` | `$val\|is_object` | Is object |
| `is_text` | `$val\|is_text` | Is string |
| `is_empty` | `$val\|is_empty` | Is empty (empty string, zero, empty array) |
| `is_not_empty` | `$val\|is_not_empty` | Is not empty |
| `is_null` | `$val\|is_null` | Is null |
| `is_not_null` | `$val\|is_not_null` | Is not null |

---

## Manipulation Filters

| Filter | Syntax | Result |
|--------|--------|--------|
| `get` | `$obj\|get:"key":"default"` | Get property with fallback |
| `has` | `$obj\|has:"key"` | Check if key exists (boolean) |
| `set` | `$obj\|set:"key":value` | Set/update property |
| `set_conditional` | `$obj\|set_conditional:"key":value:condition` | Set only if condition true |
| `set_ifnotempty` | `$obj\|set_ifnotempty:"key":value` | Set only if value non-empty |
| `set_ifnotnull` | `$obj\|set_ifnotnull:"key":value` | Set only if value not null |
| `unset` | `$obj\|unset:"key"` | Remove property |
| `fill` | `$val\|fill:start:length` | Create filled array |
| `fill_keys` | `$val\|fill_keys:["a","b"]` | Create object with keys all set to value |
| `first_notempty` | `$val\|first_notempty:default` | Value or default if empty |
| `first_notnull` | `$val\|first_notnull:default` | Value or default if null |
| `transform` | `$val\|transform:"$$+3"` | Apply expression (`$$` = current) |

---

## Math Filters

### Arithmetic

| Filter | Syntax | Result |
|--------|--------|--------|
| `add` | `$val\|add:5` | Addition |
| `subtract` | `$val\|subtract:3` | Subtraction |
| `multiply` | `$val\|multiply:2` | Multiplication |
| `divide` | `$val\|divide:4` | Division |
| `modulus` | `$val\|modulus:3` | Remainder |

### Rounding

| Filter | Syntax | Result |
|--------|--------|--------|
| `abs` | `$val\|abs` | Absolute value |
| `round` | `$val\|round:2` | Round to decimal places |
| `ceil` | `$val\|ceil` | Round up |
| `floor` | `$val\|floor` | Round down |

### Powers & Logarithms

| Filter | Syntax | Result |
|--------|--------|--------|
| `pow` | `$val\|pow:2` | Raise to power |
| `sqrt` | `$val\|sqrt` | Square root |
| `exp` | `$val\|exp` | e^value |
| `ln` | `$val\|ln` | Natural log |
| `log` | `$val\|log:10` | Log with custom base |
| `log10` | `$val\|log10` | Base-10 log |

### Trigonometry

`sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `asinh`, `acosh`, `atanh`, `deg2rad`, `rad2deg`

### Bitwise

| Filter | Syntax | Result |
|--------|--------|--------|
| `bitwise_and` | `$val\|bitwise_and:n` | Bitwise AND |
| `bitwise_or` | `$val\|bitwise_or:n` | Bitwise OR |
| `bitwise_xor` | `$val\|bitwise_xor:n` | Bitwise XOR |
| `bitwise_not` | `$val\|bitwise_not` | Bitwise NOT |

### Array Aggregation

| Filter | Syntax | Result |
|--------|--------|--------|
| `sum` | `$arr\|sum` | Sum all elements |
| `avg` | `$arr\|avg` | Average |
| `product` | `$arr\|product` | Product of all elements |
| `array_max` | `$arr\|array_max` | Maximum value |
| `array_min` | `$arr\|array_min` | Minimum value |
| `max` | `$val\|max:10` | Larger of two values |
| `min` | `$val\|min:0` | Smaller of two values |

### Formatting

| Filter | Syntax | Result |
|--------|--------|--------|
| `number_format` | `$val\|number_format:2:".":","` | Format with separators |

---

## Security Filters

### Hashing

| Filter | Syntax |
|--------|--------|
| `md5` | `$val\|md5:hex` |
| `sha1` | `$val\|sha1:hex` |
| `sha256` | `$val\|sha256:hex` |
| `sha384` | `$val\|sha384:hex` |
| `sha512` | `$val\|sha512:hex` |

### HMAC

| Filter | Syntax |
|--------|--------|
| `hmac_sha1` | `$val\|hmac_sha1:"secret":hex` |
| `hmac_sha256` | `$val\|hmac_sha256:"secret":hex` |
| `hmac_sha384` | `$val\|hmac_sha384:"secret":hex` |
| `hmac_sha512` | `$val\|hmac_sha512:"secret":hex` |

### Encryption

| Filter | Syntax |
|--------|--------|
| `encrypt` | `$val\|encrypt:"aes-256-cbc":"key":"iv"` |
| `decrypt` | `$val\|decrypt:"aes-256-cbc":"key":"iv"` |

### Tokens

| Filter | Syntax |
|--------|--------|
| `jws_encode` | `$val\|jws_encode:key:header:algo:max_age` |
| `jws_decode` | `$val\|jws_decode:key:header:algo:max_age` |
| `jwe_encode` | `$val\|jwe_encode:key:header:key_algo:enc_algo:max_age` |
| `jwe_decode` | `$val\|jwe_decode:key:header:key_algo:enc_algo:max_age` |

### ID Generation

| Filter | Syntax |
|--------|--------|
| `create_uid` | `$val\|create_uid` |
| `uuid` | `$val\|uuid` |
| `secureid_encode` | `$val\|secureid_encode:algorithm` |
| `secureid_decode` | `$val\|secureid_decode:key` |

---

## Text Filters

### Case & Formatting

| Filter | Syntax | Result |
|--------|--------|--------|
| `capitalize` | `$val\|capitalize` | Capitalize first letter of each word |
| `to_lower` | `$val\|to_lower` | Lowercase |
| `to_upper` | `$val\|to_upper` | Uppercase |
| `strip_accents` | `$val\|strip_accents` | Remove accent marks |

### Trimming

| Filter | Syntax | Result |
|--------|--------|--------|
| `trim` | `$val\|trim:chars` | Trim both ends |
| `ltrim` | `$val\|ltrim:chars` | Trim left |
| `rtrim` | `$val\|rtrim:chars` | Trim right |

### Search & Match

| Filter | Syntax | Result |
|--------|--------|--------|
| `contains` | `$val\|contains:"search"` | Case-sensitive substring |
| `icontains` | `$val\|icontains:"search"` | Case-insensitive substring |
| `starts_with` | `$val\|starts_with:"prefix"` | Starts with (case-sensitive) |
| `istarts_with` | `$val\|istarts_with:"prefix"` | Starts with (case-insensitive) |
| `ends_with` | `$val\|ends_with:"suffix"` | Ends with (case-sensitive) |
| `iends_with` | `$val\|iends_with:"suffix"` | Ends with (case-insensitive) |
| `index` | `$val\|index:"search"` | Position (false if not found) |
| `iindex` | `$val\|iindex:"search"` | Case-insensitive position |

### Manipulation

| Filter | Syntax | Result |
|--------|--------|--------|
| `concat` | `$val\|concat:" world"` | Append string |
| `replace` | `$val\|replace:"old":"new"` | Replace all occurrences |
| `substr` | `$val\|substr:0:5` | Extract substring |
| `strlen` | `$val\|strlen` | String length |
| `split` | `$val\|split:","` | Split into array |
| `addslashes` | `$val\|addslashes` | Escape quotes |

### HTML & Encoding

| Filter | Syntax |
|--------|--------|
| `escape` / `text_escape` | `$val\|escape` |
| `text_unescape` | `$val\|text_unescape` |
| `strip_tags` | `$val\|strip_tags:allowlist` |

### Character Encoding

| Filter | Syntax |
|--------|--------|
| `detect_encoding` | `$val\|detect_encoding` |
| `convert_encoding` | `$val\|convert_encoding:"from":"to"` |
| `from_utf8` | `$val\|from_utf8` |
| `to_utf8` | `$val\|to_utf8` |

### Regular Expressions

| Filter | Syntax | Result |
|--------|--------|--------|
| `regex_test` | `$val\|regex_test:"pattern"` | Boolean match |
| `regex_match` | `$val\|regex_match:"pattern"` | First match |
| `regex_match_all` | `$val\|regex_match_all:"pattern"` | All matches |
| `regex_quote` | `$val\|regex_quote` | Escape regex chars |
| `regex_replace` | `$val\|regex_replace:"pattern":"replacement"` | Replace matches |
| `regex_get_first_match` | `$val\|regex_get_first_match:"pattern"` | First matching substring |
| `regex_get_all_matches` | `$val\|regex_get_all_matches:"pattern"` | All matching substrings |

### URL Handling

| Filter | Syntax | Result |
|--------|--------|--------|
| `url_parse` | `$val\|url_parse` | Parse URL into components |
| `url_getarg` | `$val\|url_getarg:"param"` | Get query parameter |
| `url_hasarg` | `$val\|url_hasarg:"param"` | Check parameter exists |
| `url_addarg` | `$val\|url_addarg:"param":"value"` | Add/update parameter |
| `url_delarg` | `$val\|url_delarg:"param"` | Remove parameter |

### Data Parsing

| Filter | Syntax |
|--------|--------|
| `querystring_parse` | `$val\|querystring_parse` |
| `sprintf` | `$val\|sprintf:args` |
| `sql_alias` | `$val\|sql_alias` |
| `sql_esc` | `$val\|sql_esc` |

---

## Timestamp Filters

| Filter | Syntax | Result |
|--------|--------|--------|
| `format_timestamp` | `$val\|format_timestamp:"Y-m-d H:i:s":"UTC"` | Timestamp to formatted string |
| `parse_timestamp` | `$val\|parse_timestamp:"Y-m-d":"UTC"` | String to timestamp (ms) |
| `add_ms_to_timestamp` | `$val\|add_ms_to_timestamp:500` | Add milliseconds |
| `add_secs_to_timestamp` | `$val\|add_secs_to_timestamp:3600` | Add seconds |
| `transform_timestamp` | `$val\|transform_timestamp:"last Monday":"UTC"` | Relative expression |

**Common format tokens:** `Y` (4-digit year), `m` (month 01-12), `d` (day 01-31), `H` (hour 00-23), `i` (minute 00-59), `s` (second 00-59), `U` (Unix timestamp).

---

## Transform Filters

### Encoding/Decoding

| Filter | Syntax |
|--------|--------|
| `base64_encode` / `base64_decode` | `$val\|base64_encode` |
| `base64_encode_urlsafe` / `base64_decode_urlsafe` | `$val\|base64_encode_urlsafe` |
| `url_encode` / `url_decode` | `$val\|url_encode` |
| `url_encode_rfc3986` / `url_decode_rfc3986` | `$val\|url_encode_rfc3986` |
| `json_encode` | `$val\|json_encode` |
| `json_decode` | `$val\|json_decode` |
| `xml_decode` | `$val\|xml_decode` |
| `yaml_encode` / `yaml_decode` | `$val\|yaml_encode` |

### CSV

| Filter | Syntax |
|--------|--------|
| `csv_decode` | `$val\|csv_decode:","` |
| `csv_encode` | `$val\|csv_encode:","` |
| `csv_parse` | `$val\|csv_parse:","` |
| `csv_create` | `$val\|csv_create:","` |

### Number Base Conversion

`bindec`, `decbin`, `hexdec`, `dechex`, `octdec`, `decoct`, `hex2bin`, `bin2hex`, `base_convert`

### Type Conversion

| Filter | Syntax | Result |
|--------|--------|--------|
| `to_bool` | `$val\|to_bool` | Convert to boolean |
| `to_int` | `$val\|to_int` | Extract integer |
| `to_decimal` | `$val\|to_decimal` | Extract decimal |
| `to_text` | `$val\|to_text` | Convert to string |
| `to_expr` | `$val\|to_expr` | Evaluate math expression |

### Timestamp Conversion

| Filter | Syntax |
|--------|--------|
| `to_timestamp` | `$val\|to_timestamp:tz` |
| `to_seconds` / `to_ms` | `$val\|to_seconds:tz` |
| `to_minutes` / `to_hours` / `to_days` | `$val\|to_minutes:tz` |

### Object Creation

| Filter | Syntax | Result |
|--------|--------|--------|
| `create_object` | `$keys\|create_object:$values` | Build object from parallel arrays |
| `create_object_from_entries` | `$entries\|create_object_from_entries` | Build from entries |

### Functional

| Filter | Syntax | Result |
|--------|--------|--------|
| `lambda` | `$arr\|lambda:"$$*2"` | Apply expression to each element |

---

## Real-World Filter Patterns

### Build an API response object safely

```
var $response_obj {
  value = "{}"|json_decode
    |set:"id":$user.id
    |set:"name":$user.name
    |set:"email":$user.email
    |set_ifnotnull:"avatar":$user.avatar
    |set_ifnotnull:"phone":$user.phone
    |set:"role":$user.role
}
```

### Strip sensitive fields from a database record

```
response = $user|unpick:["password","internal_notes","api_key"]
```

### Extract a column from an array of objects

```
// Get all user emails from a list of user objects
$users|map:"x.email"                            // ["alice@co.com", "bob@co.com"]

// Get unique categories from products
$products|map:"x.category"|unique               // ["electronics", "books"]
```

### Default values for optional inputs

```
var $page {
  value = $input.page|coalesce:1
}
var $per_page {
  value = $input.per_page|coalesce:25
}
var $sort_dir {
  value = $input.sort|coalesce:"desc"
}
```

### URL manipulation for API integrations

```
var $api_url {
  value = "https://api.example.com/search"
    |url_addarg:"q":$input.query
    |url_addarg:"page":$page|to_text
    |url_addarg:"limit":"25"
}
```

### Parse and validate an email domain

```
var $domain {
  value = $input.email|split:"@"|last|to_lower
}

precondition {
  conditions = `$domain|not_in:["tempmail.com","throwaway.io"]`
  type = "badrequest"
  message = "Disposable email addresses are not allowed"
}
```

### Format currency for display

```
var $display_price {
  value = "$"|concat:$order.total|divide:100|round:2|number_format:2:".":","
}
// $1,234.56
```

### Chain timestamp operations

```
// Get timestamp for "7 days ago"
var $one_week_ago {
  value = "now"|to_timestamp:"UTC"|add_secs_to_timestamp:-604800
}

// Format for display
var $readable_date {
  value = $order.created_at|format_timestamp:"M d, Y":"UTC"
}
// "Jan 15, 2025"
```

### Clean and normalize user input

```
input {
  text name filters=trim
  email email filters=trim|lower
  text phone filters=trim
}

// In stack, further normalize
var $clean_phone {
  value = $input.phone|regex_replace:"[^0-9+]":""
}
```

### Build CSV export data

```
var $csv_header {
  value = "Name,Email,Role,Created"
}

var $csv_rows {
  value = $users|map:"x.name ~ ',' ~ x.email ~ ',' ~ x.role ~ ',' ~ x.created_at"
}

var $csv_output {
  value = $csv_header|concat:$csv_rows|join:"\n":"\n"
}
```

### Compute summary statistics

```
var $stats {
  value = "{}"|json_decode
    |set:"total":$orders|count
    |set:"revenue":$orders|map:"x.amount"|sum
    |set:"avg_order":$orders|map:"x.amount"|avg|round:2
    |set:"max_order":$orders|map:"x.amount"|array_max
    |set:"min_order":$orders|map:"x.amount"|array_min
}
```

---

## Common Mistakes

1. **Forgetting `json_decode` for arrays and objects.** This is the #1 XanoScript mistake.
   ```
   // WRONG — assigns the literal string "[1,2,3]"
   var items { value = "[1,2,3]" }

   // RIGHT — creates an actual array
   var items { value = "[1,2,3]"|json_decode }

   // WRONG — assigns a string, not an object
   var config { value = '{"key": "value"}' }

   // RIGHT
   var config { value = '{"key": "value"}'|json_decode }
   ```

2. **Using `set` on a string instead of an object.** The `set` filter works on objects. If you forgot `json_decode`, you're calling `set` on a string and it silently fails.
   ```
   // WRONG — $obj is a string "{}"; set does nothing useful
   var $obj { value = "{}" }
   var.update $obj { value = $obj|set:"name":"Alice" }

   // RIGHT — decode first, then set
   var $obj { value = "{}"|json_decode|set:"name":"Alice" }
   ```

3. **Confusing `filter` condition syntax.** Filter conditions use `x` (not `$this`). `$this` is for array functions in the stack. Filters use `x`.
   ```
   // WRONG — $this is not available in filter expressions
   $items|filter:"$this.active == true"

   // RIGHT — use x
   $items|filter:"x.active == true"
   ```

4. **Losing precision with integer division.** Dividing two integers may truncate. Use `to_decimal` first if you need decimal results.
   ```
   // May lose precision
   7|divide:2                    // 3 (integer division)

   // Preserve decimals
   7|to_decimal|divide:2         // 3.5
   ```

5. **Forgetting `|to_text` when concatenating numbers with strings.** Pipe filters that expect text input may behave unexpectedly with numeric values.

6. **Not handling null values in filter chains.** If a value is null, most filters will error or produce unexpected results. Use `coalesce`, `first_notnull`, or `is_null` checks.
   ```
   // DANGEROUS — crashes if $user.middle_name is null
   $user.middle_name|to_upper

   // SAFE — provide fallback
   $user.middle_name|coalesce:""|to_upper
   ```

7. **Using `map` and `reduce` with timeout-sensitive operations.** The `filter`, `find`, `map`, `reduce`, `every`, and `some` filters accept an optional timeout parameter. For large arrays, consider adding a timeout to prevent hanging.
   ```
   $large_array|map:"x * 2":5000    // 5-second timeout
   ```
