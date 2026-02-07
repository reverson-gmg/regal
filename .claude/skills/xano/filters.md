# XanoScript Filter Reference

Filters transform data using pipe syntax. They can be chained and nested.

## Syntax

```
// Basic filter
"hello"|capitalize

// Filter with parameters (colon-separated)
"hello"|concat:" world"

// Chaining multiple filters
"hello"|concat:" world"|to_upper

// Nesting filters
"hello"|concat:" world"|capitalize
```

---

## Array Filters

### Basic Operations

| Filter | Syntax | Description |
|--------|--------|-------------|
| `append` | `value\|append:item:key` | Add item to end of array, or key-value to object |
| `prepend` | `value\|prepend:item:key` | Add item to start of array, or key-value to object |
| `push` | `value\|push:item` | Append single item to array |
| `pop` | `value\|pop` | Remove and return last element |
| `shift` | `value\|shift` | Remove first element, return remaining array |
| `unshift` | `value\|unshift:item` | Add item to beginning of array |

### Filtering

| Filter | Syntax | Description |
|--------|--------|-------------|
| `filter` | `value\|filter:"x > 2":timeout` | Return elements matching condition |
| `filter_empty` | `value\|filter_empty` | Remove empty/falsy values |
| `filter_empty_array` | `value\|filter_empty_array` | Remove empty arrays |
| `filter_empty_object` | `value\|filter_empty_object` | Remove empty objects |
| `filter_empty_text` | `value\|filter_empty_text` | Remove empty strings |
| `filter_false` | `value\|filter_false` | Remove false booleans |
| `filter_null` | `value\|filter_null` | Remove null values |
| `filter_zero` | `value\|filter_zero` | Remove zero values |

**Filter conditions** use `x` to reference the current element:
```
[1,2,3,4]|filter:"x > 2"                   // [3,4]
[{"age":20},{"age":30}]|filter:"x.age > 25" // [{"age":30}]
```

### Search & Selection

| Filter | Syntax | Description |
|--------|--------|-------------|
| `find` | `value\|find:"x > 1":timeout` | First matching element |
| `findIndex` | `value\|findIndex:"x > 1":timeout` | Index of first match |
| `first` | `value\|first` | First element |
| `last` | `value\|last` | Last element |

### Aggregation & Transformation

| Filter | Syntax | Description |
|--------|--------|-------------|
| `map` | `value\|map:"x * 2":timeout` | Transform each element |
| `reduce` | `value\|reduce:initial:"acc + x":timeout` | Accumulate into single value |
| `count` | `value\|count` | Number of elements |
| `join` | `value\|join:","` | Concatenate with separator |

**Examples:**
```
[1,2,3]|map:"x * 2"           // [2,4,6]
[1,2,3]|reduce:0:"acc + x"    // 6
[1,2,3]|join:","               // "1,2,3"
```

### Set Operations

| Filter | Syntax | Description |
|--------|--------|-------------|
| `diff` | `value\|diff:array` | Elements in first not in second |
| `diff_assoc` | `value\|diff_assoc:object` | Key-value pairs not matching |
| `intersect` | `value\|intersect:array` | Common elements |
| `intersect_assoc` | `value\|intersect_assoc:object` | Matching key-value pairs |
| `merge` | `value\|merge:array` | Combine arrays or objects |
| `merge_recursive` | `value\|merge_recursive:object` | Deep merge nested structures |

### Structural Operations

| Filter | Syntax | Description |
|--------|--------|-------------|
| `flatten` | `value\|flatten` | Flatten nested arrays |
| `reverse` | `value\|reverse` | Reverse element order |
| `shuffle` | `value\|shuffle` | Randomize order |
| `slice` | `value\|slice:offset:length` | Extract subsequence |
| `unique` | `value\|unique:key` | Remove duplicates (optional key for objects) |
| `sort` | `value\|sort` | Sort elements |

### Key-Value Operations

| Filter | Syntax | Description |
|--------|--------|-------------|
| `keys` | `value\|keys` | Extract all keys |
| `values` | `value\|values` | Extract all values |
| `entries` | `value\|entries` | Convert to key-value pairs |
| `pick` | `value\|pick:["a","b"]` | Select specific keys |
| `unpick` | `value\|unpick:["a","b"]` | Exclude specific keys |
| `index_by` | `value\|index_by:"id"` | Create object indexed by property |
| `remove` | `value\|remove:item:key:strict` | Remove matching elements or keys |

### Logical Operations

| Filter | Syntax | Description |
|--------|--------|-------------|
| `every` | `value\|every:"x % 2 == 0":timeout` | True if all elements match |
| `some` | `value\|some:"x > 2":timeout` | True if any element matches |

### Utility

| Filter | Syntax | Description |
|--------|--------|-------------|
| `range` | `null\|range:1:5` | Generate sequential array `[1,2,3,4,5]` |
| `safe_array` | `value\|safe_array` | Convert null to empty array |

---

## Comparison Filters

### Equality

| Filter | Syntax | Description |
|--------|--------|-------------|
| `equals` | `value\|equals:compare` | Strict equality |
| `not_equals` / `ne` | `value\|not_equals:compare` | Not equal |

### Logical

| Filter | Syntax | Description |
|--------|--------|-------------|
| `and` | `value\|and:other` | Both truthy |
| `or` | `value\|or:other` | At least one truthy |
| `not` | `value\|not` | Negate boolean |
| `ternary` | `condition\|ternary:"yes":"no"` | Conditional value selection |
| `coalesce` | `value\|coalesce:default` | Return default if null/empty |

### Numeric Comparison

| Filter | Syntax | Description |
|--------|--------|-------------|
| `greater_than` | `value\|greater_than:n` | Strict greater than |
| `greater_than_or_equal` | `value\|greater_than_or_equal:n` | Greater than or equal |
| `less_than` | `value\|less_than:n` | Strict less than |
| `less_than_or_equal` | `value\|less_than_or_equal:n` | Less than or equal |
| `even` | `value\|even` | Is even number |
| `odd` | `value\|odd` | Is odd number |

### Membership

| Filter | Syntax | Description |
|--------|--------|-------------|
| `in` | `value\|in:["a","b"]` | Value in array |
| `not_in` | `value\|not_in:["a","b"]` | Value not in array |

### Type Checking

| Filter | Syntax | Description |
|--------|--------|-------------|
| `is_array` | `value\|is_array` | Is array |
| `is_bool` | `value\|is_bool` | Is boolean |
| `is_decimal` | `value\|is_decimal` | Is floating-point |
| `is_int` | `value\|is_int` | Is integer |
| `is_object` | `value\|is_object` | Is object |
| `is_text` | `value\|is_text` | Is string |
| `is_empty` | `value\|is_empty` | Is empty (empty string, zero, empty array) |
| `is_not_empty` | `value\|is_not_empty` | Is not empty |
| `is_null` | `value\|is_null` | Is null |
| `is_not_null` | `value\|is_not_null` | Is not null |

### Bitwise

| Filter | Syntax | Description |
|--------|--------|-------------|
| `bitwise_not` | `value\|bitwise_not` | Bitwise NOT |

---

## Manipulation Filters

| Filter | Syntax | Description |
|--------|--------|-------------|
| `get` | `value\|get:"key":"default"` | Get object property with fallback |
| `has` | `value\|has:"key"` | Check if object has key (boolean) |
| `set` | `value\|set:"key":new_value` | Set/update object property |
| `set_conditional` | `value\|set_conditional:"key":value:condition` | Set only if condition is true |
| `set_ifnotempty` | `value\|set_ifnotempty:"key":value` | Set only if value is non-empty |
| `set_ifnotnull` | `value\|set_ifnotnull:"key":value` | Set only if value is not null |
| `unset` | `value\|unset:"key"` | Remove object property |
| `fill` | `value\|fill:start:length` | Create array filled with value |
| `fill_keys` | `value\|fill_keys:["a","b"]` | Create object with keys all set to value |
| `first_notempty` | `value\|first_notempty:default` | Return value or default if empty |
| `first_notnull` | `value\|first_notnull:default` | Return value or default if null |
| `transform` | `value\|transform:"$$+3"` | Apply custom expression (`$$` = current value) |

---

## Math Filters

### Arithmetic

| Filter | Syntax | Description |
|--------|--------|-------------|
| `add` | `value\|add:n` | Addition |
| `subtract` | `value\|subtract:n` | Subtraction |
| `multiply` | `value\|multiply:n` | Multiplication |
| `divide` | `value\|divide:n` | Division |
| `modulus` | `value\|modulus:n` | Remainder |

### Rounding

| Filter | Syntax | Description |
|--------|--------|-------------|
| `abs` | `value\|abs` | Absolute value |
| `round` | `value\|round:precision` | Round to decimal places |
| `ceil` | `value\|ceil` | Round up |
| `floor` | `value\|floor` | Round down |

### Powers & Logarithms

| Filter | Syntax | Description |
|--------|--------|-------------|
| `pow` | `value\|pow:exponent` | Raise to power |
| `sqrt` | `value\|sqrt` | Square root |
| `exp` | `value\|exp` | e^value |
| `ln` | `value\|ln` | Natural logarithm |
| `log` | `value\|log:base` | Logarithm with custom base |
| `log10` | `value\|log10` | Base-10 logarithm |

### Trigonometry

| Filter | Syntax | Description |
|--------|--------|-------------|
| `sin` | `value\|sin` | Sine |
| `cos` | `value\|cos` | Cosine |
| `tan` | `value\|tan` | Tangent |
| `asin` | `value\|asin` | Arcsine |
| `acos` | `value\|acos` | Arccosine |
| `atan` | `value\|atan` | Arctangent |
| `asinh` | `value\|asinh` | Inverse hyperbolic sine |
| `acosh` | `value\|acosh` | Inverse hyperbolic cosine |
| `atanh` | `value\|atanh` | Inverse hyperbolic tangent |
| `deg2rad` | `value\|deg2rad` | Degrees to radians |
| `rad2deg` | `value\|rad2deg` | Radians to degrees |

### Bitwise

| Filter | Syntax | Description |
|--------|--------|-------------|
| `bitwise_and` | `value\|bitwise_and:n` | Bitwise AND |
| `bitwise_or` | `value\|bitwise_or:n` | Bitwise OR |
| `bitwise_xor` | `value\|bitwise_xor:n` | Bitwise XOR |

### Array Aggregation

| Filter | Syntax | Description |
|--------|--------|-------------|
| `sum` | `value\|sum` | Sum all elements |
| `avg` | `value\|avg` | Average of elements |
| `product` | `value\|product` | Product of all elements |
| `array_max` | `value\|array_max` | Maximum value |
| `array_min` | `value\|array_min` | Minimum value |
| `max` | `value\|max:n` | Larger of two values |
| `min` | `value\|min:n` | Smaller of two values |

### Formatting

| Filter | Syntax | Description |
|--------|--------|-------------|
| `number_format` | `value\|number_format:decimals:".":","` | Format with separators |

---

## Security Filters

| Filter | Syntax | Description |
|--------|--------|-------------|
| `create_uid` | `value\|create_uid` | Generate unique 64-bit ID |
| `uuid` | `value\|uuid` | Generate RFC-compliant UUID |
| `encrypt` | `value\|encrypt:"aes-256-cbc":"key":"iv"` | Symmetric encryption |
| `decrypt` | `value\|decrypt:"aes-256-cbc":"key":"iv"` | Symmetric decryption |
| `md5` | `value\|md5:hex` | MD5 hash |
| `sha1` | `value\|sha1:hex` | SHA-1 hash |
| `sha256` | `value\|sha256:hex` | SHA-256 hash |
| `sha384` | `value\|sha384:hex` | SHA-384 hash |
| `sha512` | `value\|sha512:hex` | SHA-512 hash |
| `hmac_sha1` | `value\|hmac_sha1:"secret":hex` | HMAC-SHA1 |
| `hmac_sha256` | `value\|hmac_sha256:"secret":hex` | HMAC-SHA256 |
| `hmac_sha384` | `value\|hmac_sha384:"secret":hex` | HMAC-SHA384 |
| `hmac_sha512` | `value\|hmac_sha512:"secret":hex` | HMAC-SHA512 |
| `jws_encode` | `value\|jws_encode:key:header:algo:max_age` | Create JWS token |
| `jws_decode` | `value\|jws_decode:key:header:algo:max_age` | Verify JWS token |
| `jwe_encode` | `value\|jwe_encode:key:header:key_algo:enc_algo:max_age` | Create JWE token |
| `jwe_decode` | `value\|jwe_decode:key:header:key_algo:enc_algo:max_age` | Decrypt JWE token |
| `secureid_encode` | `value\|secureid_encode:algorithm` | Encode ID securely |
| `secureid_decode` | `value\|secureid_decode:key` | Decode secure ID |

---

## Text Filters

### Case & Formatting

| Filter | Syntax | Description |
|--------|--------|-------------|
| `capitalize` | `value\|capitalize` | Capitalize first letter of each word |
| `to_lower` | `value\|to_lower` | Lowercase |
| `to_upper` | `value\|to_upper` | Uppercase |
| `strip_accents` | `value\|strip_accents` | Remove accent marks |

### Trimming

| Filter | Syntax | Description |
|--------|--------|-------------|
| `trim` | `value\|trim:chars` | Trim both ends (default: whitespace) |
| `ltrim` | `value\|ltrim:chars` | Trim left |
| `rtrim` | `value\|rtrim:chars` | Trim right |

### Search & Matching

| Filter | Syntax | Description |
|--------|--------|-------------|
| `contains` | `value\|contains:"search"` | Case-sensitive substring search |
| `icontains` | `value\|icontains:"search"` | Case-insensitive substring search |
| `starts_with` | `value\|starts_with:"prefix"` | Starts with (case-sensitive) |
| `istarts_with` | `value\|istarts_with:"prefix"` | Starts with (case-insensitive) |
| `ends_with` | `value\|ends_with:"suffix"` | Ends with (case-sensitive) |
| `iends_with` | `value\|iends_with:"suffix"` | Ends with (case-insensitive) |
| `index` | `value\|index:"search"` | Position of substring (false if not found) |
| `iindex` | `value\|iindex:"search"` | Case-insensitive position |

### Manipulation

| Filter | Syntax | Description |
|--------|--------|-------------|
| `concat` | `value\|concat:"other"` | Join strings |
| `replace` | `value\|replace:"search":"replacement"` | Replace all occurrences |
| `substr` | `value\|substr:start:length` | Extract substring |
| `strlen` | `value\|strlen` | String length |
| `split` | `value\|split:","` | Split by delimiter into array |
| `addslashes` | `value\|addslashes` | Escape quotes with backslashes |

### HTML & Encoding

| Filter | Syntax | Description |
|--------|--------|-------------|
| `escape` | `value\|escape` | HTML entity encoding |
| `strip_tags` | `value\|strip_tags:allowlist` | Remove HTML tags |
| `text_escape` | `value\|text_escape` | HTML entity encoding |
| `text_unescape` | `value\|text_unescape` | Decode HTML entities |

### Character Encoding

| Filter | Syntax | Description |
|--------|--------|-------------|
| `detect_encoding` | `value\|detect_encoding` | Identify encoding |
| `convert_encoding` | `value\|convert_encoding:"from":"to"` | Convert between encodings |
| `from_utf8` | `value\|from_utf8` | UTF-8 to binary |
| `to_utf8` | `value\|to_utf8` | Ensure UTF-8 |

### Regular Expressions

| Filter | Syntax | Description |
|--------|--------|-------------|
| `regex_test` | `value\|regex_test:"pattern"` | Test match (boolean) |
| `regex_match` | `value\|regex_match:"pattern"` | First match |
| `regex_match_all` | `value\|regex_match_all:"pattern"` | All matches |
| `regex_quote` | `value\|regex_quote` | Escape regex chars |
| `regex_replace` | `value\|regex_replace:"pattern":"replacement"` | Replace matches |
| `regex_get_first_match` | `value\|regex_get_first_match:"pattern"` | First matching substring |
| `regex_get_all_matches` | `value\|regex_get_all_matches:"pattern"` | All matching substrings |

### URL Handling

| Filter | Syntax | Description |
|--------|--------|-------------|
| `url_parse` | `value\|url_parse` | Parse URL into components |
| `url_getarg` | `value\|url_getarg:"param"` | Get query parameter |
| `url_hasarg` | `value\|url_hasarg:"param"` | Check query parameter exists |
| `url_addarg` | `value\|url_addarg:"param":"value"` | Add/update query parameter |
| `url_delarg` | `value\|url_delarg:"param"` | Remove query parameter |

### Data Parsing

| Filter | Syntax | Description |
|--------|--------|-------------|
| `querystring_parse` | `value\|querystring_parse` | Query string to object |
| `sprintf` | `value\|sprintf:args` | Format string |
| `sql_alias` | `value\|sql_alias` | Convert to SQL-safe name |
| `sql_esc` | `value\|sql_esc` | Escape for SQL |

---

## Timestamp Filters

| Filter | Syntax | Description |
|--------|--------|-------------|
| `add_ms_to_timestamp` | `value\|add_ms_to_timestamp:ms` | Add milliseconds to timestamp |
| `add_secs_to_timestamp` | `value\|add_secs_to_timestamp:secs` | Add seconds to timestamp |
| `format_timestamp` | `value\|format_timestamp:"Y-m-d":"UTC"` | Format timestamp to string |
| `parse_timestamp` | `value\|parse_timestamp:"Y-m-d":"UTC"` | Parse string to timestamp (ms) |
| `transform_timestamp` | `value\|transform_timestamp:"expression":"tz"` | Apply relative expression (e.g., "last Monday") |

---

## Transform Filters

### Encoding/Decoding

| Filter | Syntax | Description |
|--------|--------|-------------|
| `base64_encode` | `value\|base64_encode` | Base64 encode |
| `base64_decode` | `value\|base64_decode` | Base64 decode |
| `base64_encode_urlsafe` | `value\|base64_encode_urlsafe` | URL-safe base64 encode |
| `base64_decode_urlsafe` | `value\|base64_decode_urlsafe` | URL-safe base64 decode |
| `url_encode` | `value\|url_encode` | URL encode |
| `url_decode` | `value\|url_decode` | URL decode |
| `url_encode_rfc3986` | `value\|url_encode_rfc3986` | RFC 3986 URL encode |
| `url_decode_rfc3986` | `value\|url_decode_rfc3986` | RFC 3986 URL decode |
| `json_encode` | `value\|json_encode` | Object to JSON string |
| `json_decode` | `value\|json_decode` | JSON string to object |
| `xml_decode` | `value\|xml_decode` | XML string to object |
| `yaml_encode` | `value\|yaml_encode` | Object to YAML string |
| `yaml_decode` | `value\|yaml_decode` | YAML string to object |

### CSV

| Filter | Syntax | Description |
|--------|--------|-------------|
| `csv_decode` | `value\|csv_decode:","` | CSV string to array |
| `csv_encode` | `value\|csv_encode:","` | Array to CSV string |
| `csv_parse` | `value\|csv_parse:","` | Alternative CSV parsing |
| `csv_create` | `value\|csv_create:","` | Alternative CSV creation |

### Number Base Conversion

| Filter | Syntax | Description |
|--------|--------|-------------|
| `bindec` | `value\|bindec` | Binary to decimal |
| `decbin` | `value\|decbin` | Decimal to binary |
| `hexdec` | `value\|hexdec` | Hex to decimal |
| `dechex` | `value\|dechex` | Decimal to hex |
| `octdec` | `value\|octdec` | Octal to decimal |
| `decoct` | `value\|decoct` | Decimal to octal |
| `hex2bin` | `value\|hex2bin` | Hex to binary data |
| `bin2hex` | `value\|bin2hex` | Binary data to hex |
| `base_convert` | `value\|base_convert:"from":"to"` | Arbitrary base conversion |

### Type Conversion

| Filter | Syntax | Description |
|--------|--------|-------------|
| `to_bool` | `value\|to_bool` | Convert to boolean |
| `to_int` | `value\|to_int` | Extract integer |
| `to_decimal` | `value\|to_decimal` | Extract decimal |
| `to_text` | `value\|to_text` | Convert to string |
| `to_expr` | `value\|to_expr` | Evaluate math expression |

### Timestamp Conversion

| Filter | Syntax | Description |
|--------|--------|-------------|
| `to_timestamp` | `value\|to_timestamp:tz` | Convert to ms timestamp |
| `to_seconds` | `value\|to_seconds:tz` | Convert to seconds |
| `to_ms` | `value\|to_ms:tz` | Convert to milliseconds |
| `to_minutes` | `value\|to_minutes:tz` | Convert to minutes |
| `to_hours` | `value\|to_hours:tz` | Convert to hours |
| `to_days` | `value\|to_days:tz` | Convert to days |

### Object Creation

| Filter | Syntax | Description |
|--------|--------|-------------|
| `create_object` | `keys\|create_object:values` | Build object from parallel arrays |
| `create_object_from_entries` | `entries\|create_object_from_entries` | Build object from entries |

### Functional

| Filter | Syntax | Description |
|--------|--------|-------------|
| `lambda` | `value\|lambda:"$$*2"` | Apply expression to each element (`$$` = current) |
