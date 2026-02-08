# Promax DEX WebSocket Event Schema

This documents the wire format of every event pushed by the Promax Data Exchange (DEX) WebSocket API (`GET /v1/ws?token={token}`). If you are building an integration that consumes these events, this is the only file you need to read.

## Connection

| Parameter | Value |
|-----------|-------|
| Endpoint | `wss://dex.promaxapi.com/v1/ws?token={token}` |
| Auth | OAuth 2.0 ID token in the query string. Tokens expire after 1 hour. |
| Rate limit | 30 connections/hour/vendor. |
| Modes | **Interactive** (default): client polls, 1 msg/sec limit. **Stream** (`&stream=true`): server pushes continuously. |

Interactive mode exists so slow consumers don't drown. Stream mode exists so fast consumers don't poll. Pick one. If you're reading this, you probably want stream mode.

---

## Envelope: `WSResponse`

Every message on the wire is a JSON object with this shape:

```
{
  "dealer_id":    int64,   // required — the dealership
  "customer_id":  int64?,  // nullable — absent on some notification events
  "timestamp":    int64,   // required — milliseconds since epoch, event generation time
  ...event payload         // exactly ONE of the event fields below will be present
}
```

The envelope is a tagged union. Exactly one of the following keys will be non-null per message. The presence of the key *is* the discriminator — there is no separate `type` field.

| Key | Type | What happened |
|-----|------|---------------|
| `customer` | `WSCustomer` | Customer profile created or updated |
| `customer_status` | `WSCustomerStatus` | Lead status or service status changed |
| `sales_appointment` | `WSSalesAppointment` | Sales appointment lifecycle event |
| `service_appointment` | `WSServiceAppointment` | Service appointment lifecycle event |
| `communications` | `WSCommunicationsNote` | Phone call, text, email, note, or lead note |
| `showroom_visit` | `WSShowroomVisit` | Physical showroom visit event |
| `notifications` | `WSNotification[]` | System-level event (merge, transfer, delete, etc.) |

That's it. Seven event categories. Everything the CRM does maps to one of these.

---

## 1. `customer` — Customer Profile

Fired when a customer record is created or any profile field changes. This is the largest payload. Most fields are nullable because Promax only sends what changed — a null field means "not included in this update", not "was cleared".

```jsonc
{
  "dealer_id": 8848,
  "customer_id": 158198223,
  "timestamp": 1770497614798,
  "customer": {
    "account_type": "Person",        // required: "Person" | "Company"
    "customer_id": 158198223,        // int64, nullable
    "ad_source": "Internet",         // nullable
    "lead_source": "CarGurus",       // nullable
    "lead_source_id": 42,            // int32, nullable
    "lead_type": "Internet",         // nullable
    "lead_status": "Contacted",      // nullable
    "block_email": false,            // nullable — customer opted out of email
    "block_letters": false,          // nullable — customer opted out of mail
    "block_text": false,             // nullable — customer opted out of SMS
    "cash_down": "500.00",           // nullable, string (not a number — treat accordingly)

    "person": { ... },               // present when account_type = "Person"
    "company": { ... },              // present when account_type = "Company"
    "dealer_parties": [ ... ],       // assigned salespeople
    "desired_vehicle": [ ... ],      // what they want
    "trade_vehicle": [ ... ]         // what they're trading in
  }
}
```

### `person` (WSLeadPerson)

Only present when `account_type` is `"Person"`. Null otherwise.

| Field | Type | Notes |
|-------|------|-------|
| `first_name` | string? | |
| `last_name` | string? | |
| `middle_name` | string? | |
| `address` | `WSLeadPersonAddress[]?` | Up to 4 addresses |
| `communications` | `WSLeadCommunication[]?` | Phone numbers and emails |

#### `address[]`

```jsonc
{
  "address_type": "Current",  // required enum: "Current" | "Previous1" | "Previous2" | "Previous3"
  "line_one": "123 Main St",  // nullable
  "line_two": "Apt 4B",       // nullable
  "city": "Dallas",           // nullable
  "state": "TX",              // nullable
  "zip_code": "75201",        // nullable
  "duration": 24,             // int32, nullable — months at this address
  "monthly_payment": 1200.00  // float, nullable — rent/mortgage
}
```

`address_type` is `required` — it's how you distinguish which address slot is which. Everything else is nullable.

#### `communications[]`

```jsonc
{
  "communication_type": "CellPhone",  // enum, see below
  "complete_number": "2145551234",    // nullable — for phone types
  "email_address": "j@example.com",   // nullable — for email types
  "extension_number": 100             // int32, nullable — for work phones
}
```

`communication_type` enum values:
- `HomePhone`, `CellPhone`, `WorkPhone` — use `complete_number`
- `PrimaryEmail`, `SecondaryEmail` — use `email_address`

The schema overloads a single array for both phones and emails. The `communication_type` tells you which field to read. `complete_number` is meaningless on email entries; `email_address` is meaningless on phone entries.

### `company` (WSLeadCompany)

Only present when `account_type` is `"Company"`. Same idea, different fields.

| Field | Type |
|-------|------|
| `company_name` | string? |
| `business_phone` | string? |
| `tax_id` | string? |
| `monthly_income` | float? |
| `months_in_business` | int32? |
| `phone_extension` | int32? |
| `address` | `WSLeadCompanyAddress[]?` |

Company addresses have the same shape as person addresses minus `address_type`, `duration`, and `monthly_payment`.

### `dealer_parties[]`

The salespeople assigned to this customer.

```jsonc
{
  "employee_id": 9057085,       // int64, nullable
  "first_name": "Joanna",       // nullable
  "last_name": "Bahena",        // nullable
  "party_type": "Salesperson 1" // nullable
}
```

### `desired_vehicle[]`

What the customer wants to buy.

| Field | Type | Notes |
|-------|------|-------|
| `make` | string? | e.g. "Toyota" |
| `model_name` | string? | e.g. "Camry" |
| `model_year` | int64? | e.g. 2026 |
| `style` | string? | e.g. "SE Sedan" |
| `vin` | string? | |
| `stock_number` | string? | dealer's internal stock ID |
| `stock_type` | string? | "New", "Used", etc. |
| `mileage` | int64? | |

### `trade_vehicle[]`

What the customer is trading in. Up to 2 trade-ins.

| Field | Type | Notes |
|-------|------|-------|
| `make` | string? | |
| `model_name` | string? | |
| `model_year` | int32? | |
| `style` | string? | |
| `vin` | string? | |
| `mileage` | int32? | |
| `exterior_color` | string? | |
| `interior_color` | string? | |
| `payment` | float? | current monthly payment |
| `payoff` | float? | remaining loan balance |
| `allowance` | float? | trade-in value offered |
| `acv` | int32? | actual cash value |
| `trade_vehicle` | int32? | `1` or `2` — which trade slot |
| `lienholder_info` | `WSLeadLienholderInfo[]?` | who holds the loan |

#### `lienholder_info[]`

```jsonc
{
  "lienholder_name": "Chase Auto",    // nullable
  "lienholder_phone": "8005551234",   // nullable
  "lienholder_contact": "John Smith", // nullable
  "address": [{
    "line_one": "PO Box 15298",
    "city": "Wilmington",
    "state": "DE",
    "zip_code": "19850"
  }]
}
```

---

## 2. `customer_status` — Status Change

Fired when a customer's lead status, service status, or overall customer status changes. Lean payload.

```jsonc
{
  "dealer_id": 8848,
  "customer_id": 158198223,
  "timestamp": 1770497614798,
  "customer_status": {
    "customer_id": 158198223,          // int64, nullable
    "lead_status": "Contacted",        // nullable
    "lead_status_id": 3,               // int32, nullable
    "service_status": null,            // nullable
    "service_status_id": null,         // int32, nullable
    "customer_status": "Rw-Need $ / Co-X", // nullable
    "customer_status_id": 62127        // int32, nullable
  }
}
```

The string and integer ID fields for each status are independently nullable. You may get one without the other. Always key off the ID when you need deterministic matching — the string is a display label that dealers can customize.

---

## 3. `sales_appointment` — Sales Appointment Lifecycle

This is the most complex event because it encodes a state machine. An appointment moves through statuses and the `appointment_status` field is itself a discriminated union.

```jsonc
{
  "dealer_id": 8848,
  "customer_id": 158198223,
  "timestamp": 1770496261116,
  "sales_appointment": {
    "appointment": {
      "appointment_id": 3269203977,         // int64, nullable
      "date_time": "2026-02-09T22:30:00Z",  // ISO 8601, nullable
      "comments": "between 4:30-5:00pm",    // nullable
      "set_via": "Phone",                   // enum, nullable (see below)
      "status": "Current",                  // enum, nullable (see below)
      "appointment_status": { ... },        // discriminated, required
      "confirmed_status": { ... }           // nullable
    },
    "dealer_parties": {                     // nullable
      "employee_id": 9057085,               // int64, nullable
      "first_name": "Joanna",               // nullable
      "last_name": "Bahena"                 // nullable
    }
  }
}
```

### `set_via` enum

How the appointment was made: `"Phone"` | `"Text"` | `"Email"` | `"Chat"` | `"Video"`

### `status` enum

Snapshot of current state: `"Shown"` | `"Missed"` | `"Sold"` | `"Cancelled"`

### `appointment_status` — the state machine discriminator

This is an object with a `status` field that acts as the discriminator:

| `status` value | Meaning | Extra fields |
|----------------|---------|--------------|
| `"Current"` | Appointment is active/set | none |
| `"Shown"` | Customer showed up | none |
| `"Missed"` | Customer didn't show | none |
| `"Sold"` | Customer bought a vehicle | none |
| `"Unsold"` | Customer showed but didn't buy | none |
| `"Cancelled"` | Appointment was cancelled | none |
| `"Reschedule"` | Appointment was rescheduled | `details.new_appointment_id` (int64) |

Reschedule is the only variant with `details`:

```jsonc
{
  "appointment_status": {
    "status": "Reschedule",
    "details": {
      "new_appointment_id": 3269204100
    }
  }
}
```

When you see `Reschedule`, a new appointment was created. The old appointment is dead. Follow the `new_appointment_id` — you'll receive a separate event for the new one.

### `confirmed_status`

```jsonc
{
  "confirmed": true,               // boolean, nullable
  "dealer_parties": {               // nullable — who confirmed it
    "employee_id": 9057085,
    "first_name": "Joanna",
    "last_name": "Bahena"
  }
}
```

---

## 4. `service_appointment` — Service Appointment

Simpler than sales appointments. No state machine — service appointments don't track show/miss/sold lifecycle through the WebSocket.

```jsonc
{
  "dealer_id": 8848,
  "customer_id": 158198223,
  "timestamp": 1770497614798,
  "service_appointment": {
    "appointment": {
      "id": 3269203977,                     // int64, nullable
      "date_time": "2026-02-09T14:00:00Z",  // ISO 8601, nullable
      "comments": "Oil change"               // nullable
    },
    "dealer_parties": {                      // required
      "employee_id": 9057085,                // int64, required
      "first_name": "Joanna",                // nullable
      "last_name": "Bahena"                  // nullable
    }
  }
}
```

Note: the appointment ID field is `id` here, not `appointment_id` as in sales appointments. This inconsistency is in the upstream API.

---

## 5. `communications` — Messages and Notes

Covers every type of communication: phone calls, texts, emails, CRM notes, and lead source notes.

```jsonc
{
  "dealer_id": 8848,
  "customer_id": 183903211,
  "timestamp": 1770497614798,
  "communications": {
    "employee_id": 9057085,        // int32, nullable — who logged it
    "customer_id": 183903211,      // int64, nullable
    "messages": [
      {
        "date_time": "2026-02-07T20:53:00Z",  // nullable
        "type": "Phone",                       // enum, nullable (see below)
        "direction": "Incoming",               // enum, nullable (see below)
        "subject": null,                       // nullable — used for emails
        "body": "spoke with customer..."       // nullable — the content
      }
    ]
  }
}
```

### `type` enum

| Value | What it is |
|-------|------------|
| `"Phone"` | Phone call log |
| `"Text"` | SMS message |
| `"Email"` | Email — `subject` will be populated |
| `"Note"` | Internal CRM note entered by a user |
| `"Lead"` | System-generated lead source note |

### `direction` enum

`"Incoming"` | `"Outgoing"` — only meaningful for Phone, Text, and Email. Notes and Leads don't have a meaningful direction.

### Practical notes

- `messages` is an array but in practice you'll almost always see exactly one entry. The array exists because the schema allows batching; the WebSocket almost never uses it.
- `employee_id` at the top level is the person who logged the communication. For inbound messages, this is whoever the CRM auto-assigned it to, not the customer.
- `body` on a `"Phone"` type is the call disposition note, not a transcript.
- `body` on a `"Lead"` type is the raw lead XML/text that came from the lead provider.

---

## 6. `showroom_visit` — Physical Showroom Events

This is a discriminated union with three variants, selected by the presence of a specific key.

### Variant 1: `new_visit`

Customer walked in (or was logged as arriving).

```jsonc
{
  "dealer_id": 8848,
  "customer_id": 158198223,
  "timestamp": 1770497614798,
  "showroom_visit": {
    "new_visit": {
      "id": 887432,                          // int64, required — visit ID
      "date": "2026-02-07T20:53:00Z",        // ISO 8601, required
      "type": "PhoneApptShow",               // WSShowroomVisitType enum, required
      "employee_id": 9057085,                // int64, required
      "appointment": {                       // nullable — only if tied to an appointment
        "id": 3269203977,                    // int64, required
        "type": "Sales"                      // required: "Sales" | "Service"
      }
    }
  }
}
```

### Variant 2: `exit_note`

Employee logged a note when the customer left (or during the visit).

```jsonc
{
  "dealer_id": 8848,
  "customer_id": 158198223,
  "timestamp": 1770497614798,
  "showroom_visit": {
    "exit_note": {
      "id": 887433,                          // int64, required — note ID
      "showroom_visit_id": 887432,           // int64, required — ties to new_visit.id
      "employee_id": 9057085,                // int64, required
      "date": "2026-02-07T21:30:00Z",        // ISO 8601, required
      "is_manager_note": false               // boolean, required
    }
  }
}
```

### Variant 3: `delete`

Visit was deleted (entry error, duplicate, etc.).

```jsonc
{
  "dealer_id": 8848,
  "customer_id": 158198223,
  "timestamp": 1770497614798,
  "showroom_visit": {
    "delete": {
      "id": 887432,              // int64, required — the visit being deleted
      "employee_id": 9057085     // int64, required — who deleted it
    }
  }
}
```

The discriminator is structural: check which key exists (`new_visit`, `exit_note`, or `delete`). Only one will be present.

---

## 7. `notifications` — System Events

Notifications are the catch-all for CRM system-level operations that don't fit the other categories. Unlike every other event, this is an **array at the top level** (though in practice it's always a single-element array).

```jsonc
{
  "dealer_id": 8848,
  "customer_id": 158198223,
  "timestamp": 1770497614798,
  "notifications": [
    {
      "code": 1002,                  // required — WSNotificationCode, see table
      "message": "Customer merged",  // nullable — human-readable description
      "updates": { ... }             // nullable — structured data for the event
    }
  ]
}
```

### Notification codes

| Code | Meaning | `updates` key | `updates` payload |
|------|---------|---------------|-------------------|
| 1000 | Generic notification | — | — |
| 1001 | Non-forwardable lead source assigned | `non_forward` | `{ "lead_source_id": int32 }` |
| 1002 | Customer records merged | `merge` | `{ "new_customer_id": int64 }` |
| 1003 | Customer transferred to another dealer | `transfer` | `{ "new_dealer_id": int64 }` |
| 1004 | Customer deleted | — | — |
| 1005 | License scanned | `lead_notification` | `{ "date_time": string, "employee_id": int64 }` |
| 1006 | Credit application pulled | `lead_notification` | `{ "date_time": string, "employee_id": int64 }` |
| 1007 | Deal created | `lead_notification` | `{ "date_time": string, "employee_id": int64 }` |
| 1008 | Deal updated | `lead_notification` | `{ "date_time": string, "employee_id": int64 }` |
| 1009 | Deal finalized | `lead_notification` | `{ "date_time": string, "employee_id": int64 }` |
| 1010 | Forms printed | `lead_notification` | `{ "date_time": string, "employee_id": int64 }` |
| 1011–1015 | Reserved CRM actions | varies | varies |

### `updates` discriminator

`updates` is itself a tagged union. The key present tells you the variant:

**`merge`** — the customer record you're tracking was merged into another. Stop tracking the old `customer_id`. Start tracking `new_customer_id`. This is the single most important notification to handle correctly. If you ignore merges, you will have orphaned records.

```jsonc
{ "merge": { "new_customer_id": 158198300 } }
```

**`transfer`** — customer moved to a different dealership. The `customer_id` remains the same, but `dealer_id` changes.

```jsonc
{ "transfer": { "new_dealer_id": 9001 } }
```

**`non_forward`** — the lead source assigned to this customer cannot be forwarded. Informational.

```jsonc
{ "non_forward": { "lead_source_id": 42 } }
```

**`lead_notification`** — generic CRM action timestamp. Used for codes 1005–1015.

```jsonc
{ "lead_notification": { "date_time": "2026-02-07T20:53:00Z", "employee_id": 9057085 } }
```

---

## Type Summary

For reference, here is every type, flattened:

```
WSResponse
  dealer_id:            int64           required
  customer_id:          int64?
  timestamp:            int64           required (ms since epoch)
  customer:             WSCustomer?
  customer_status:      WSCustomerStatus?
  sales_appointment:    WSSalesAppointment?
  service_appointment:  WSServiceAppointment?
  communications:       WSCommunicationsNote?
  showroom_visit:       WSShowroomVisit?
  notifications:        WSNotification[]?

WSCustomer
  account_type:         "Person" | "Company"    required
  customer_id:          int64?
  ad_source:            string?
  lead_source:          string?
  lead_source_id:       int32?
  lead_type:            string?
  lead_status:          string?
  block_email:          bool?
  block_letters:        bool?
  block_text:           bool?
  cash_down:            string?
  person:               WSLeadPerson?
  company:              WSLeadCompany?
  dealer_parties:       WSLeadDealerParties[]?
  desired_vehicle:      WSLeadDesiredVehicle[]?
  trade_vehicle:        WSLeadTradeVehicle[]?

WSCustomerStatus
  customer_id:          int64?
  lead_status:          string?
  lead_status_id:       int32?
  service_status:       string?
  service_status_id:    int32?
  customer_status:      string?
  customer_status_id:   int32?

WSSalesAppointment
  appointment:          WSSalesAppointmentObject    required
  dealer_parties:       WSSalesAppointmentDealerParties?

WSSalesAppointmentObject
  appointment_id:       int64?
  date_time:            string? (ISO 8601)
  comments:             string?
  set_via:              "Phone" | "Text" | "Email" | "Chat" | "Video"   nullable
  status:               "Shown" | "Missed" | "Sold" | "Cancelled"       nullable
  appointment_status:   WSSalesAppointmentStatus    required
  confirmed_status:     WSSalesAppointmentConfirmedStatus?

WSSalesAppointmentStatus
  status:               "Current" | "Shown" | "Missed" | "Sold" | "Unsold" | "Cancelled" | "Reschedule"
  details:              { new_appointment_id: int64 }?    only on "Reschedule"

WSServiceAppointment
  appointment:          WSServiceAppointmentObject  required
  dealer_parties:       WSServiceAppointmentDealerParties   required

WSServiceAppointmentObject
  id:                   int64?
  date_time:            string? (ISO 8601)
  comments:             string?

WSCommunicationsNote
  employee_id:          int32?
  customer_id:          int64?
  messages:             WSCommunicationsNoteMessage[]?

WSCommunicationsNoteMessage
  date_time:            string?
  type:                 "Note" | "Phone" | "Text" | "Email" | "Lead"    nullable
  direction:            "Incoming" | "Outgoing"     nullable
  subject:              string?
  body:                 string?

WSShowroomVisit                          (oneOf — exactly one key present)
  new_visit:            WSShowroomNewVisit?
  exit_note:            WSShowroomExitNote?
  delete:               WSShowroomDelete?

WSNotification
  code:                 int (WSNotificationCode)    required
  message:              string?
  updates:              WSNotifyUpdate?              (oneOf by key)
```

---

## Things That Will Bite You

**Timestamps are inconsistent.** The envelope `timestamp` is milliseconds-since-epoch (int64). Every other timestamp in the payload is ISO 8601 (string). Don't write a generic timestamp parser — write two, and know which one you're looking at.

**Nullable does not mean optional.** Most fields are nullable, meaning they can be explicitly `null` in the JSON. But they can also be *absent* (key not present). Your deserialization must handle both. In practice, Promax tends to omit keys rather than send nulls, but the schema permits either.

**`customer_id` appears in three places.** It's on the envelope, and it's repeated inside `customer.customer_id` and `communications.customer_id`. They should be the same value. If they ever diverge, trust the envelope.

**`employee_id` types are inconsistent.** It's `int32` in `communications.employee_id` and `int64` everywhere else. Use int64 in your data model and widen the int32 on ingestion.

**`cash_down` is a string.** Not a number. It may contain formatting. Parse it defensively.

**Sales vs. service appointment ID fields differ.** Sales uses `appointment_id`. Service uses `id`. This is not a typo in this document — it's a genuine inconsistency in the API.

**Notification code 1002 (merge) requires action.** When two customer records merge, you get a notification on the *old* customer ID with the *new* customer ID in `updates.merge.new_customer_id`. If you don't handle this, you'll accumulate ghost records that never receive updates again.

**Notification code 1003 (transfer) changes the dealer.** The customer moves to a different `dealer_id`. If you're filtering by dealer, you'll stop seeing events for this customer unless you update your tracking.

**The `messages` array is almost always length 1.** But don't hardcode `messages[0]`. The schema allows multiple entries and the API may start batching in the future.

---

## Source

Schema sourced from the [Promax DEX API Reference](https://dex.promaxapi.com/v1/redoc#tag/WebSocket/paths/~1v1~1ws?token=%7Btoken%7D/get), 200 OK response schema section.

