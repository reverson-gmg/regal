// ============================================
// HOOKDECK COMMUNICATIONS → REGAL TRANSFORMATION SCRIPT v1.0
// ============================================
// Transforms Xano communication output (stage 3) into Regal event format (stage 4).
//
// Handles four communication event types, each identified by the presence
// of a specific top-level key in the Xano payload:
//
//   promax_communication_call               → crm_call.{inbound|outbound}
//   promax_communication_call_recording_note → crm_call.{direction}.recording
//   promax_communication_text               → crm_sms.{inbound|outbound}
//   promax_communication_user_note          → crm_note
//
// Features:
//   ✅ Detects event type from top-level payload key (call, call_recording_note, text, user_note)
//   ✅ Builds Regal event name per type (crm_call.*, crm_sms.*, crm_note)
//   ✅ US timezone-aware date formatting with DST support (eastern, central, mountain, pacific, alaska, hawaii)
//   ✅ Human-readable display timestamps localized to dealer timezone
//   ✅ Dealer object mapping with computed website URL and area_code extraction
//   ✅ Person/employee enrichment (name, name_at_dealership) with null-safety
//   ✅ Phone number formatting (10-digit → (XXX) XXX-XXXX)
//   ✅ Call direction-aware time/person keys (answered_at/by for inbound, called_at/by for outbound)
//   ✅ Call notes: capitalize first letter, preserve interior casing, conditional trailing period
//   ✅ Call recording note: structured fields (talk_time, disposition, recording_link)
//   ✅ SMS body passed through unchanged
//   ✅ User note body passed through unchanged
//   ✅ Activity trait generation with direction-specific and "last" sub-objects
//   ✅ Customer object with formatted phones, Promax URL, and embedded sales_rep_1
//   ✅ Sparse field mapping: home_phone only included when non-empty
//   ✅ Defensive null/type checks throughout — no uncaught exceptions
//   ✅ Explicit $transform.fail() for missing required data
// ============================================

// ============= CONFIGURATION =============

var SCHEMA_VERSION = '1.0';
var EVENT_SOURCE = 'Promax';
var PROMAX_CUSTOMER_URL_BASE = 'https://promaxonline.com/customer/workscreen?customer=';
var DEALER_WEBSITE_BASE = 'https://www.rightway.com/d/';

// ============= COMMUNICATION TYPE KEYS =============
// Each Xano payload contains exactly one of these top-level keys,
// which determines the event type for the entire transformation.

var COMM_KEY_CALL = 'promax_communication_call';
var COMM_KEY_CALL_RECORDING = 'promax_communication_call_recording_note';
var COMM_KEY_TEXT = 'promax_communication_text';
var COMM_KEY_USER_NOTE = 'promax_communication_user_note';

// ============= TIMEZONE UTILITIES =============
// US timezone offsets in hours from UTC. Standard time (Nov–Mar) and
// DST (Mar–Nov). Hawaii does not observe DST.

var TZ_STANDARD_OFFSETS = {
  eastern: -5,
  central: -6,
  mountain: -7,
  pacific: -8,
  alaska: -9,
  hawaii: -10
};

var TZ_DST_OFFSETS = {
  eastern: -4,
  central: -5,
  mountain: -6,
  pacific: -7,
  alaska: -8,
  hawaii: -10
};

/**
 * Gets the day-of-month for the nth occurrence of a weekday in a given month.
 * Used to compute DST transition dates (2nd Sunday of March, 1st Sunday of November).
 *
 * @param {number} year     - Full year (e.g. 2026)
 * @param {number} month    - 0-indexed month (0=Jan, 2=Mar, 10=Nov)
 * @param {number} dayOfWeek - 0=Sunday through 6=Saturday
 * @param {number} n        - 1-based occurrence (1=first, 2=second)
 * @returns {number} Day of month (1-based)
 */
function getNthDayOfMonth(year, month, dayOfWeek, n) {
  var first = new Date(Date.UTC(year, month, 1));
  var firstDow = first.getUTCDay();
  return 1 + ((dayOfWeek - firstDow + 7) % 7) + (n - 1) * 7;
}

/**
 * Determines if a UTC epoch-ms timestamp falls within US Daylight Saving Time.
 *
 * DST starts: 2nd Sunday of March at 2:00 AM local standard time
 * DST ends:   1st Sunday of November at 2:00 AM local DST time
 * Hawaii never observes DST.
 *
 * @param {number} utcMs - UTC epoch milliseconds
 * @param {string} tz    - Lowercase timezone name (eastern, central, etc.)
 * @returns {boolean}
 */
function isDST(utcMs, tz) {
  if (tz === 'hawaii') return false;

  var d = new Date(utcMs);
  var year = d.getUTCFullYear();

  // DST starts: 2nd Sunday of March at 02:00 local standard → convert to UTC
  var marchSunday = getNthDayOfMonth(year, 2, 0, 2);
  var standardOffset = TZ_STANDARD_OFFSETS[tz] || 0;
  var dstStartUtc = Date.UTC(year, 2, marchSunday, 2 - standardOffset, 0, 0);

  // DST ends: 1st Sunday of November at 02:00 local DST → convert to UTC
  var novSunday = getNthDayOfMonth(year, 10, 0, 1);
  var dstOffset = TZ_DST_OFFSETS[tz] || 0;
  var dstEndUtc = Date.UTC(year, 10, novSunday, 2 - dstOffset, 0, 0);

  return utcMs >= dstStartUtc && utcMs < dstEndUtc;
}

/**
 * Returns the UTC offset in hours for a given timezone at a specific UTC time.
 * Accounts for DST transitions.
 *
 * @param {number} utcMs  - UTC epoch milliseconds
 * @param {string} tzName - Timezone name (e.g. "central", "eastern")
 * @returns {number} Offset in hours (negative for US timezones)
 */
function getTimezoneOffset(utcMs, tzName) {
  var tz = (tzName || '').toLowerCase();
  if (isDST(utcMs, tz)) {
    return TZ_DST_OFFSETS[tz] || 0;
  }
  return TZ_STANDARD_OFFSETS[tz] || 0;
}

/**
 * Returns a Date object shifted so that getUTC* methods return local time values.
 * This avoids needing Intl.DateTimeFormat which is unavailable in the V8 sandbox.
 *
 * @param {number} epochMs - UTC epoch milliseconds
 * @param {string} tzName  - Timezone name
 * @returns {Date} Shifted Date object
 */
function toLocalDate(epochMs, tzName) {
  var offset = getTimezoneOffset(epochMs, tzName);
  return new Date(epochMs + offset * 3600000);
}

// ============= DATE FORMATTING =============

var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Converts epoch-ms to ISO 8601 UTC string: "2026-02-07T20:53:00+00:00"
 * Returns null for falsy or invalid inputs.
 *
 * @param {number} epochMs - UTC epoch milliseconds
 * @returns {string|null}
 */
function toIsoUtc(epochMs) {
  if (!epochMs) return null;
  var d = new Date(epochMs);
  if (isNaN(d.getTime())) return null;
  var pad = function(n) { return String(n).padStart(2, '0'); };
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) +
    'T' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()) + '+00:00';
}

/**
 * Formats local time portion: "2:53 PM"
 *
 * @param {Date} localDate - A timezone-shifted Date (use toLocalDate())
 * @returns {string}
 */
function formatTimeOnly(localDate) {
  var hours = localDate.getUTCHours();
  var minutes = localDate.getUTCMinutes();
  var ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return hours + ':' + (minutes < 10 ? '0' + minutes : String(minutes)) + ' ' + ampm;
}

/**
 * Formats epoch-ms as dealer-local display: "Sat, Feb 7, 2026 - 2:53 PM"
 * The dash separator matches Regal's expected display format.
 *
 * @param {number} epochMs - UTC epoch milliseconds
 * @param {string} tzName  - Dealer timezone name
 * @returns {string|null}
 */
function formatDisplayDateTime(epochMs, tzName) {
  if (!epochMs) return null;
  var d = toLocalDate(epochMs, tzName);
  return DAYS[d.getUTCDay()] + ', ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() +
    ', ' + d.getUTCFullYear() + ' - ' + formatTimeOnly(d);
}

// ============= DATA FORMATTING =============

/**
 * Formats a raw 10-digit phone number to US display: (XXX) XXX-XXXX
 * Handles 11-digit numbers with leading "1" country code.
 * Returns null for empty/null input or non-standard lengths.
 *
 * @param {string|number} phone - Raw phone digits
 * @returns {string|null}
 */
function formatPhone(phone) {
  if (!phone) return null;
  var digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) {
    return '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6);
  }
  if (digits.length === 11 && digits[0] === '1') {
    return '(' + digits.slice(1, 4) + ') ' + digits.slice(4, 7) + '-' + digits.slice(7);
  }
  return null;
}

/**
 * Extracts the 3-digit area code from a formatted or raw phone number.
 * Used to derive dealer.area_code from phone_number_main.
 *
 * @param {string} phoneStr - Phone number in any format
 * @returns {string|null} 3-digit area code or null
 */
function extractAreaCode(phoneStr) {
  if (!phoneStr) return null;
  var digits = String(phoneStr).replace(/\D/g, '');
  if (digits.length >= 10) {
    var start = (digits.length === 11 && digits[0] === '1') ? 1 : 0;
    return digits.slice(start, start + 3);
  }
  return null;
}

/**
 * Checks if a value is non-null, non-empty, and usable.
 * Used to decide whether to include optional fields in sparse output.
 *
 * @param {*} v - Any value
 * @returns {boolean}
 */
function isPresent(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  return true;
}

// ============= BUILDER FUNCTIONS =============

/**
 * Builds the enriched dealer object for the Regal event.
 * Maps Xano field names to Regal field names, computes the website URL
 * from the dealer slug, and extracts the area code from the main phone.
 *
 * Field mapping:
 *   marketing_name      → name
 *   marketing_name_no_st → name_no_st
 *   phone_number_main   → phone
 *   gmg_nickname        → internal_name
 *   slug                → website (computed)
 *   phone               → area_code (extracted)
 *
 * @param {Object} dealer - promax_dealer from Xano payload
 * @returns {Object|null}
 */
function buildDealerObject(dealer) {
  if (!dealer) return null;

  var areaCode = extractAreaCode(dealer.phone_number_main);
  var obj = {
    id: dealer.id,
    address: dealer.address || '',
    address_2: dealer.address_2 || '',
    city: dealer.city || '',
    state: dealer.state || '',
    st: dealer.st || '',
    region_name: dealer.region_name || '',
    zip_code: dealer.zip_code || '',
    time_zone: dealer.time_zone || '',
    slug: dealer.slug || '',
    crm_email: dealer.crm_email || '',
    name: dealer.marketing_name || '',
    name_no_st: dealer.marketing_name_no_st || '',
    phone: dealer.phone_number_main || '',
    internal_name: dealer.gmg_nickname || '',
    website: dealer.slug ? DEALER_WEBSITE_BASE + dealer.slug + '/' : ''
  };

  if (areaCode) obj.area_code = areaCode;
  return obj;
}

/**
 * Builds an enriched person object with computed full name and
 * "name | dealership" display string. Returns null if the person
 * record is falsy or not an object (e.g. `false` for missing employees).
 *
 * @param {Object|boolean|null} person     - Employee/sales_rep record from Xano
 * @param {string}              dealerName - Dealer marketing_name for display
 * @returns {Object|null}
 */
function buildPersonObject(person, dealerName) {
  if (!person || typeof person !== 'object') return null;

  var firstName = person.first_name || '';
  var lastName = person.last_name || '';
  var name = (firstName + ' ' + lastName).trim();

  return {
    id: person.id,
    first_name: firstName,
    last_name: lastName,
    name: name,
    name_at_dealership: name + ' | ' + (dealerName || '')
  };
}

/**
 * Builds the customer object for Regal event properties.
 * Always includes: id, url, first_name, last_name, name, cell_phone, email, sales_rep_1.
 * Conditionally includes: home_phone (only when present and non-empty).
 *
 * @param {Object} customer   - promax_customer from Xano payload
 * @param {Object|null} salesRep1 - Enriched sales_rep_1 person object
 * @returns {Object}
 */
function buildCustomerObject(customer, salesRep1) {
  if (!customer) return {};

  var firstName = customer.first_name || '';
  var lastName = customer.last_name || '';
  var name = (firstName + ' ' + lastName).trim();

  var obj = {
    id: customer.id,
    url: PROMAX_CUSTOMER_URL_BASE + customer.id,
    first_name: firstName,
    last_name: lastName,
    name: name,
    cell_phone: formatPhone(customer.cell_phone)
  };

  // home_phone is sparse — only included when the source has a real value
  var homePhone = formatPhone(customer.home_phone);
  if (homePhone) {
    obj.home_phone = homePhone;
  }

  obj.email = customer.primary_email || '';
  obj.sales_rep_1 = salesRep1;

  return obj;
}

// ============= CALL NOTE FORMATTING =============

/**
 * Formats a call body/note for the Regal "notes" field.
 *
 * Rules (derived from observed Regal output):
 *   1. Trim whitespace
 *   2. Capitalize the first character (preserve interior casing)
 *   3. Append a trailing period if the text is longer than 2 characters
 *      and does not already end with sentence-ending punctuation
 *
 * Examples:
 *   "vm"                    → "Vm"          (short abbreviation, no period)
 *   "spoke with customer"   → "Spoke with customer."  (sentence, period added)
 *   "Left a voicemail."     → "Left a voicemail."     (already has period)
 *
 * @param {string} body - Raw call note body
 * @returns {string|null}
 */
function formatCallNotes(body) {
  if (!body || typeof body !== 'string') return null;
  var trimmed = body.trim();
  if (!trimmed) return null;

  // Capitalize first character, preserve the rest
  var formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

  // Add trailing period for sentence-length text that lacks terminal punctuation
  if (formatted.length > 2 && !/[.!?;:]$/.test(formatted)) {
    formatted += '.';
  }

  return formatted;
}

// ============= EVENT TYPE DETECTION =============

/**
 * Detects the communication event type from the Xano payload structure.
 * Each payload contains exactly one communication-specific top-level key.
 * Returns the type string and a reference to the communication record.
 *
 * @param {Object} body - Full request body from Xano
 * @returns {{ eventType: string, commRecord: Object, commKey: string }}
 */
function detectEventType(body) {
  if (body[COMM_KEY_CALL]) {
    return { eventType: 'call', commRecord: body[COMM_KEY_CALL], commKey: COMM_KEY_CALL };
  }
  if (body[COMM_KEY_CALL_RECORDING]) {
    return { eventType: 'call_recording_note', commRecord: body[COMM_KEY_CALL_RECORDING], commKey: COMM_KEY_CALL_RECORDING };
  }
  if (body[COMM_KEY_TEXT]) {
    return { eventType: 'text', commRecord: body[COMM_KEY_TEXT], commKey: COMM_KEY_TEXT };
  }
  if (body[COMM_KEY_USER_NOTE]) {
    return { eventType: 'user_note', commRecord: body[COMM_KEY_USER_NOTE], commKey: COMM_KEY_USER_NOTE };
  }
  return { eventType: null, commRecord: null, commKey: null };
}

// ============= ACTIVITY TRAIT BUILDERS =============
//
// Each event type produces a traits.activity object with:
//   - activity.at: the event timestamp (ISO UTC)
//   - activity.<category>.<direction_key>: direction-specific sub-object
//   - activity.<category>.last: most-recent-event sub-object
//
// The category and fields vary by event type. These builders return
// just the inner activity object; the caller wraps it in { traits: { activity } }.

/**
 * Builds activity traits for call events (inbound/outbound).
 *
 * Structure:
 *   activity.at
 *   activity.crm_call.{direction} = { at, dealer_id, disposition }
 *   activity.crm_call.last        = { at, dealer_id, type, disposition }
 *
 * @param {string} timestamp  - ISO UTC timestamp
 * @param {number} dealerId   - Dealer ID
 * @param {string} direction  - "inbound" or "outbound"
 * @param {string} disposition - Call disposition
 * @returns {Object}
 */
function buildCallActivity(timestamp, dealerId, direction, disposition) {
  var directionSpecific = {
    at: timestamp,
    dealer_id: dealerId,
    disposition: disposition
  };

  var last = {
    at: timestamp,
    dealer_id: dealerId,
    type: direction.toUpperCase(),
    disposition: disposition
  };

  var crmCall = {};
  crmCall[direction] = directionSpecific;
  crmCall.last = last;

  return {
    at: timestamp,
    crm_call: crmCall
  };
}

/**
 * Builds activity traits for call recording note events.
 *
 * Structure:
 *   activity.at
 *   activity.crm_call.{direction}_recording = { at, dealer_id, disposition, talk_time }
 *   activity.crm_call.last                  = { at, dealer_id, type, disposition }
 *
 * @param {string} timestamp   - ISO UTC timestamp
 * @param {number} dealerId    - Dealer ID
 * @param {string} direction   - "inbound" or "outbound"
 * @param {string} disposition - Call disposition
 * @param {number|null} talkTime - Talk time in seconds
 * @returns {Object}
 */
function buildCallRecordingActivity(timestamp, dealerId, direction, disposition, talkTime) {
  var recordingKey = direction + '_recording';

  var directionSpecific = {
    at: timestamp,
    dealer_id: dealerId,
    disposition: disposition
  };

  // talk_time is only included when available
  if (talkTime != null) {
    directionSpecific.talk_time = talkTime;
  }

  var last = {
    at: timestamp,
    dealer_id: dealerId,
    type: direction.toUpperCase(),
    disposition: disposition
  };

  var crmCall = {};
  crmCall[recordingKey] = directionSpecific;
  crmCall.last = last;

  return {
    at: timestamp,
    crm_call: crmCall
  };
}

/**
 * Builds activity traits for SMS/text events (inbound/outbound).
 *
 * Structure:
 *   activity.at
 *   activity.crm_sms.{direction} = { at, dealer_id }
 *   activity.crm_sms.last        = { at, dealer_id, type }
 *
 * @param {string} timestamp - ISO UTC timestamp
 * @param {number} dealerId  - Dealer ID
 * @param {string} direction - "inbound" or "outbound"
 * @returns {Object}
 */
function buildSmsActivity(timestamp, dealerId, direction) {
  var directionSpecific = {
    at: timestamp,
    dealer_id: dealerId
  };

  var last = {
    at: timestamp,
    dealer_id: dealerId,
    type: direction.toUpperCase()
  };

  var crmSms = {};
  crmSms[direction] = directionSpecific;
  crmSms.last = last;

  return {
    at: timestamp,
    crm_sms: crmSms
  };
}

/**
 * Builds activity traits for user note events.
 * Notes have no direction — only a "last" sub-object.
 *
 * Structure:
 *   activity.at
 *   activity.crm_note.last = { at, dealer_id }
 *
 * @param {string} timestamp - ISO UTC timestamp
 * @param {number} dealerId  - Dealer ID
 * @returns {Object}
 */
function buildNoteActivity(timestamp, dealerId) {
  return {
    at: timestamp,
    crm_note: {
      last: {
        at: timestamp,
        dealer_id: dealerId
      }
    }
  };
}

// ============= PROPERTIES BUILDERS =============
//
// Each event type produces a properties object with event-specific fields
// plus shared customer and dealer sub-objects.

/**
 * Builds properties for a call event (inbound or outbound).
 *
 * @param {Object} comm         - promax_communication_call record
 * @param {string} timestamp    - ISO UTC timestamp
 * @param {string} displayTime  - Dealer-localized display string
 * @param {string} direction    - "inbound" or "outbound"
 * @param {Object|null} person  - Enriched employee/person object
 * @param {Object} customerObj  - Enriched customer object
 * @param {Object} dealerObj    - Enriched dealer object
 * @returns {Object}
 */
function buildCallProperties(comm, timestamp, displayTime, direction, person, customerObj, dealerObj) {
  var props = {
    event_id: comm.id,
    direction: direction.toUpperCase(),
    notes: formatCallNotes(comm.body),
    disposition: comm.disposition || 'unknown'
  };

  // Outbound calls use called_at/called_by; inbound calls use answered_at/answered_by
  if (direction === 'outbound') {
    props.called_at = timestamp;
    props.called_at_display = displayTime;
    if (person) {
      props.called_by = person;
    }
  } else {
    props.answered_at = timestamp;
    props.answered_at_display = displayTime;
    if (person) {
      props.answered_by = person;
    }
  }

  props.customer = customerObj;
  props.dealer = dealerObj;

  return props;
}

/**
 * Builds properties for a call recording note event.
 *
 * @param {Object} comm         - promax_communication_call_recording_note record
 * @param {string} timestamp    - ISO UTC timestamp
 * @param {string} displayTime  - Dealer-localized display string
 * @param {string} direction    - "inbound" or "outbound"
 * @param {Object} customerObj  - Enriched customer object
 * @param {Object} dealerObj    - Enriched dealer object
 * @returns {Object}
 */
function buildCallRecordingProperties(comm, timestamp, displayTime, direction, customerObj, dealerObj) {
  var props = {
    event_id: comm.id,
    direction: direction.toUpperCase(),
    disposition: comm.disposition || 'unknown'
  };

  // talk_time: seconds of call duration — only included when available
  if (comm.talk_time != null) {
    props.talk_time = comm.talk_time;
  }

  // recording_link: URL to the call audio file
  if (comm.recording_link) {
    props.recording_link = comm.recording_link;
  }

  props.recorded_at = timestamp;
  props.recorded_at_display = displayTime;
  props.customer = customerObj;
  props.dealer = dealerObj;

  return props;
}

/**
 * Builds properties for an SMS/text event.
 *
 * Inbound texts use received_at / received_by.
 * Outbound texts use sent_at / sent_by.
 *
 * @param {Object} comm         - promax_communication_text record
 * @param {string} timestamp    - ISO UTC timestamp
 * @param {string} displayTime  - Dealer-localized display string
 * @param {string} direction    - "inbound" or "outbound"
 * @param {Object|null} person  - Enriched employee/person object
 * @param {Object} customerObj  - Enriched customer object
 * @param {Object} dealerObj    - Enriched dealer object
 * @returns {Object}
 */
function buildSmsProperties(comm, timestamp, displayTime, direction, person, customerObj, dealerObj) {
  var props = {
    event_id: comm.id,
    direction: direction.toUpperCase(),
    body: comm.body || ''
  };

  if (direction === 'inbound') {
    // Inbound: message was received by the employee
    props.received_at = timestamp;
    props.received_at_display = displayTime;
    if (person) {
      props.received_by = person;
    }
  } else {
    // Outbound: message was sent by the employee
    props.sent_at = timestamp;
    props.sent_at_display = displayTime;
    if (person) {
      props.sent_by = person;
    }
  }

  props.customer = customerObj;
  props.dealer = dealerObj;

  return props;
}

/**
 * Builds properties for a user note event.
 * User notes have no direction — they are internal CRM notes.
 *
 * @param {Object} comm         - promax_communication_user_note record
 * @param {string} timestamp    - ISO UTC timestamp
 * @param {string} displayTime  - Dealer-localized display string
 * @param {Object|null} person  - Enriched employee/person object
 * @param {Object} customerObj  - Enriched customer object
 * @param {Object} dealerObj    - Enriched dealer object
 * @returns {Object}
 */
function buildNoteProperties(comm, timestamp, displayTime, person, customerObj, dealerObj) {
  var props = {
    event_id: comm.id,
    body: comm.body || '',
    logged_at: timestamp,
    logged_at_display: displayTime
  };

  if (person) {
    props.logged_by = person;
  }

  props.customer = customerObj;
  props.dealer = dealerObj;

  return props;
}

// ============= MAIN HANDLER =============
addHandler('transform', function(request, context) {
  var startTime = Date.now();

  try {
    var body = request.body;

    // ============= INPUT VALIDATION =============
    // The body must be a non-null object (not an array, not a primitive).
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      $transform.fail('Invalid payload: body must be an object');
    }

    // ============= EVENT TYPE DETECTION =============
    // Detect which communication type we're processing based on the
    // presence of a specific top-level key in the Xano payload.
    var detected = detectEventType(body);
    var eventType = detected.eventType;
    var comm = detected.commRecord;

    if (!eventType || !comm) {
      $transform.fail(
        'Invalid payload: no recognized communication key found. ' +
        'Expected one of: ' + COMM_KEY_CALL + ', ' + COMM_KEY_CALL_RECORDING +
        ', ' + COMM_KEY_TEXT + ', ' + COMM_KEY_USER_NOTE
      );
    }

    // ============= REQUIRED RECORDS =============
    var customer = body.promax_customer;
    var dealer = body.promax_dealer;

    if (!customer) {
      $transform.fail('Invalid payload: missing promax_customer');
    }
    if (!dealer) {
      $transform.fail('Invalid payload: missing promax_dealer');
    }
    if (!customer.regal_external_id) {
      $transform.fail('Invalid payload: customer missing regal_external_id');
    }
    if (!comm.id) {
      $transform.fail('Invalid payload: communication record missing id');
    }

    // ============= TIMESTAMPS =============
    // occurred_at is the canonical event time (epoch-ms from Xano).
    // The dealer timezone is used for human-readable display formatting.
    var occurredAt = comm.occurred_at;
    if (!occurredAt) {
      $transform.fail('Invalid payload: communication record missing occurred_at');
    }

    var tzName = dealer.time_zone || 'eastern';
    var originalTimestamp = toIsoUtc(occurredAt);
    var displayTimestamp = formatDisplayDateTime(occurredAt, tzName);

    // ============= SHARED OBJECTS =============
    // These are used across all event types.
    var dealerName = dealer.marketing_name || '';
    var dealerObj = buildDealerObject(dealer);
    var salesRep1Person = buildPersonObject(body.sales_rep_1, dealerName);
    var customerObj = buildCustomerObject(customer, salesRep1Person);

    // The employee_id field from Xano can be a real object or `false`
    // (when the employee lookup failed). buildPersonObject handles this
    // by returning null for non-object inputs.
    var employeePerson = buildPersonObject(body.employee_id, dealerName);

    // ============= DIRECTION =============
    // Direction is required for call, call_recording_note, and text events.
    // User notes have no direction (they are internal CRM notes).
    var direction = null;
    if (eventType !== 'user_note') {
      direction = (comm.direction || '').toLowerCase();
      if (direction !== 'inbound' && direction !== 'outbound') {
        $transform.fail('Invalid payload: unrecognized direction "' + comm.direction + '"');
      }
    }

    // ============= EVENT NAME =============
    // Build the Regal event name based on type and direction:
    //   call:                crm_call.inbound    | crm_call.outbound
    //   call_recording_note: crm_call.outbound.recording  (direction from record)
    //   text:                crm_sms.inbound     | crm_sms.outbound
    //   user_note:           crm_note
    var eventName;
    if (eventType === 'call') {
      eventName = 'crm_call.' + direction;
    } else if (eventType === 'call_recording_note') {
      eventName = 'crm_call.' + direction + '.recording';
    } else if (eventType === 'text') {
      eventName = 'crm_sms.' + direction;
    } else {
      eventName = 'crm_note';
    }

    // ============= ACTIVITY TRAITS =============
    // Build the activity sub-object appropriate for this event type.
    var activity;
    if (eventType === 'call') {
      activity = buildCallActivity(
        originalTimestamp, comm.dealer_id, direction, comm.disposition || 'unknown'
      );
    } else if (eventType === 'call_recording_note') {
      activity = buildCallRecordingActivity(
        originalTimestamp, comm.dealer_id, direction,
        comm.disposition || 'unknown', comm.talk_time
      );
    } else if (eventType === 'text') {
      activity = buildSmsActivity(originalTimestamp, comm.dealer_id, direction);
    } else {
      activity = buildNoteActivity(originalTimestamp, comm.dealer_id);
    }

    var traits = {
      activity: activity
    };

    // ============= PROPERTIES =============
    // Build the event-specific properties object.
    var properties;
    if (eventType === 'call') {
      properties = buildCallProperties(
        comm, originalTimestamp, displayTimestamp, direction,
        employeePerson, customerObj, dealerObj
      );
    } else if (eventType === 'call_recording_note') {
      properties = buildCallRecordingProperties(
        comm, originalTimestamp, displayTimestamp, direction,
        customerObj, dealerObj
      );
    } else if (eventType === 'text') {
      properties = buildSmsProperties(
        comm, originalTimestamp, displayTimestamp, direction,
        employeePerson, customerObj, dealerObj
      );
    } else {
      properties = buildNoteProperties(
        comm, originalTimestamp, displayTimestamp,
        employeePerson, customerObj, dealerObj
      );
    }

    // ============= FINAL OUTPUT =============
    // Assemble the Regal event envelope.
    var output = {
      userId: customer.regal_external_id,
      name: eventName,
      eventSource: EVENT_SOURCE,
      originalTimestamp: originalTimestamp,
      traits: traits,
      properties: properties
    };

    // ============= LOGGING =============
    var logMeta = {
      event_type: eventType,
      event_name: eventName,
      comm_id: comm.id,
      customer_id: customer.id,
      dealer_id: dealer.id,
      schema_version: SCHEMA_VERSION
    };
    if (direction) {
      logMeta.direction = direction;
    }

    console.log(
      'Communication → Regal transformation processed in ' + (Date.now() - startTime) + 'ms',
      logMeta
    );

    request.body = output;
    return request;

  } catch (error) {
    console.error('Transformation error:', {
      error: error.message,
      schema_version: SCHEMA_VERSION
    });
    throw error;
  }
});

// ============================================
// END COMMUNICATIONS → REGAL TRANSFORMATION v1.0
// ============================================
