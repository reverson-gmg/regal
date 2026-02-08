// ============================================
// HOOKDECK APPOINTMENTS TRANSFORMATION SCRIPT v1.4
// ============================================
// Features:
//   ✅ Handles Set, Confirmed, Current, Missed, Shown, Sold, Unsold, Cancelled, Rescheduled, Deleted events
//   ✅ MD5-based deterministic websocket_uuid with namespace (INCLUDES timestamp for uniqueness)
//   ✅ Status enum validation
//   ✅ Event type detection from payload structure
//   ✅ 15-minute boundary detection for set events (no dealer_parties required)
//   ✅ Separate promax_appointment, promax_appointment_update, promax_customer, and promax_customer_last_activity objects
//   ✅ Field-level timestamp tracking (field_last_received_at)
//   ✅ Field-level event attribution (field_last_received_by)
//   ✅ Tracks customer last activity timestamps
//   ✅ Primary tier tracking based on event type
//   ✅ Payload hash extraction from idempotency-key header
// ============================================

// ============= CONFIGURATION =============
const NAMESPACE = 'promax_dex';
const SCHEMA_VERSION = '1.4';
const EVENT_NAME = 'promax_websocket.appointments';

// ============= ENUMS =============
const VALID_EVENT_TYPES = new Set([
  'set', 'confirmed', 'current', 'missed', 'shown',
  'sold', 'unsold', 'cancelled', 'rescheduled', 'deleted'
]);

const VALID_STATUSES = new Set([
  'Current', 'Confirmed', 'Cancelled', 'Rescheduled',
  'Missed', 'Shown', 'Unsold', 'Sold', 'Deleted'
]);

/**
 * Validates status values (case-sensitive)
 */
function assertStatus(value, defaultValue = null) {
  if (!value) return defaultValue;
  return VALID_STATUSES.has(value) ? value : defaultValue;
}

/**
 * Validates event type (lowercase)
 */
function assertEventType(value, defaultValue = null) {
  if (!value) return defaultValue;
  const normalized = value.toString().toLowerCase();
  return VALID_EVENT_TYPES.has(normalized) ? normalized : defaultValue;
}

// ============= MD5 =============
function md5(string) {
  function rl(v, s) { return (v << s) | (v >>> (32 - s)); }
  function au(x, y) { const l = (x & 0xffff) + (y & 0xffff); return ((x >> 16) + (y >> 16) + (l >> 16) << 16) | (l & 0xffff); }
  function cmn(q, a, b, x, s, t) { return au(rl(au(au(a, q), au(x, t)), s), b); }
  function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
  function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
  function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t); }
  function md5blk(s) {
    const blks = new Array(16); for (let i = 0; i < 64; i += 4)
      blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
    return blks;
  }
  function md5cycle(x, k) {
    let [a, b, c, d] = x;
    a = ff(a, b, c, d, k[0], 7, -680876936); d = ff(d, a, b, c, k[1], 12, -389564586); c = ff(c, d, a, b, k[2], 17, 606105819); b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897); d = ff(d, a, b, c, k[5], 12, 1200080426); c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416); d = ff(d, a, b, c, k[9], 12, -1958414417); c = ff(c, d, a, b, k[10], 17, -42063); b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682); d = ff(d, a, b, c, k[13], 12, -40341101); c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);

    a = gg(a, b, c, d, k[1], 5, -165796510); d = gg(d, a, b, c, k[6], 9, -1069501632); c = gg(c, d, a, b, k[11], 14, 643717713); b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691); d = gg(d, a, b, c, k[10], 9, 38016083); c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438); d = gg(d, a, b, c, k[14], 9, -1019803690); c = gg(c, d, a, b, k[3], 14, -187363961); b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784); c = gg(c, d, a, b, k[7], 14, 1735328473); b = gg(b, c, d, a, k[12], 20, -1926607734);

    a = hh(a, b, c, d, k[5], 4, -378558); d = hh(d, a, b, c, k[8], 11, -2022574463); c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060); d = hh(d, a, b, c, k[4], 11, 1272893353); c = hh(c, d, a, b, k[7], 16, -155497632); b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174); d = hh(d, a, b, c, k[0], 11, -358537222); c = hh(c, d, a, b, k[3], 16, -722521979); b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487); d = hh(d, a, b, c, k[12], 11, -421815835); c = hh(c, d, a, b, k[15], 16, 530742520); b = hh(b, c, d, a, k[2], 23, -995338651);

    a = ii(a, b, c, d, k[0], 6, -198630844); d = ii(d, a, b, c, k[7], 10, 1126891415); c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571); d = ii(d, a, b, c, k[3], 10, -1894986606); c = ii(c, d, a, b, k[10], 15, -1051523); b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359); d = ii(d, a, b, c, k[15], 10, -30611744); c = ii(c, d, a, b, k[6], 15, -1560198380); b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070); d = ii(d, a, b, c, k[11], 10, -1120210379); c = ii(c, d, a, b, k[2], 15, 718787259); b = ii(b, c, d, a, k[9], 21, -343485551);

    x[0] = (x[0] + a) | 0; x[1] = (x[1] + b) | 0; x[2] = (x[2] + c) | 0; x[3] = (x[3] + d) | 0;
  }
  function md51(s) {
    let n = s.length, state = [1732584193, -271733879, -1732584194, 271733878], i;
    for (i = 64; i <= n; i += 64) { md5cycle(state, md5blk(s.substring(i - 64, i))); }
    s = s.substring(i - 64); const tail = new Array(16).fill(0);
    for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
    tail[i >> 2] |= 0x80 << ((i % 4) << 3); if (i > 55) { md5cycle(state, tail); tail.fill(0); }
    tail[14] = n * 8; md5cycle(state, tail); return state;
  }
  function rhex(n) { const h = '0123456789abcdef'; let s = ''; for (let j = 0; j < 4; j++) { s += h[(n >> ((j * 8) + 4)) & 0x0F] + h[(n >> (j * 8)) & 0x0F]; } return s; }
  const x = md51(string); return rhex(x[0]) + rhex(x[1]) + rhex(x[2]) + rhex(x[3]);
}

// ============= CORE UTILS =============

function canonicalStringify(value) {
  const seen = new WeakSet();
  const enc = (v) => {
    if (v === null) return null;
    const t = typeof v;
    if (t === 'number') return Number.isFinite(v) ? v : null;
    if (t === 'bigint') return v.toString();
    if (t === 'boolean' || t === 'string') return v;
    if (t === 'object') {
      if (seen.has(v)) return null;
      seen.add(v);
      if (Array.isArray(v)) {
        return v.map(enc).sort((a, b) => {
          const sa = JSON.stringify(a);
          const sb = JSON.stringify(b);
          return sa < sb ? -1 : sa > sb ? 1 : 0;
        });
      }
      const out = {};
      for (const k of Object.keys(v).sort()) out[k] = enc(v[k]);
      return out;
    }
    return null;
  };
  return JSON.stringify(enc(value));
}

function getOrNull(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number' && !Number.isFinite(v)) return null;
  if (typeof v === 'string') {
    const trimmed = v.trim().toLowerCase();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'n/a') return null;
  }
  return v;
}

function md5ToUuid(md5hex) {
  return [
    md5hex.slice(0, 8),
    md5hex.slice(8, 12),
    md5hex.slice(12, 16),
    md5hex.slice(16, 20),
    md5hex.slice(20, 32),
  ].join('-');
}

/**
 * Creates deterministic event ID from body (INCLUDES timestamp)
 */
function createDeterministicEventId(body, namespace) {
  const canonical = canonicalStringify(body);
  const namespaced = `${namespace}:${canonical}`;
  const hex = md5(namespaced);
  return md5ToUuid(hex);
}

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (typeof value === 'number' && !Number.isFinite(value)) return false;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value).length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

function addIfHasValue(obj, key, value) {
  if (hasValue(value)) {
    obj[key] = value;
  }
}

// ============= EVENT TYPE DETECTION =============

/**
 * Checks if a datetime string is on a 15-minute boundary (00, 15, 30, 45)
 * This is used to detect scheduled appointments even when dealer_parties is missing
 */
function isOn15MinuteBoundary(dateTimeStr) {
  if (!dateTimeStr) return false;
  try {
    const date = new Date(dateTimeStr);
    if (isNaN(date.getTime())) return false;
    const minutes = date.getUTCMinutes();
    return minutes % 15 === 0;
  } catch {
    return false;
  }
}

/**
 * Detects event type from appointment payload structure
 * Priority order:
 * 1. Confirmed event: confirmed_status.confirmed = true
 * 2. Set event: Has date_time and root dealer_parties with Current status
 *    OR: Has date_time on 15-min boundary with Current status (no dealer_parties required)
 * 3. Rescheduled event: status = "Reschedule" with details.new_appointment_id
 * 4. Status change events: Based on appointment_status.status
 */
function detectEventType(appointment, salesAppointment) {
  if (!appointment || !appointment.appointment_status) {
    throw new Error('Invalid payload: missing appointment or appointment_status');
  }

  const status = appointment.appointment_status.status;
  const hasRootDealerParties = salesAppointment && hasValue(salesAppointment.dealer_parties);
  const confirmedStatus = appointment.confirmed_status;
  const isConfirmed = confirmedStatus && confirmedStatus.confirmed === true;
  const details = appointment.appointment_status.details;
  const dateTime = getOrNull(appointment.date_time);

  // Priority 1: Confirmed event (check BEFORE set)
  if (isConfirmed) {
    return 'confirmed';
  }

  // Priority 2: Set event
  const isCurrentStatus = status === 'Current';
  const hasDateTime = hasValue(dateTime);
  const isScheduledTime = isOn15MinuteBoundary(dateTime);

  // Set if: Current status + date_time + (dealer_parties OR 15-min boundary)
  if (isCurrentStatus && hasDateTime && (hasRootDealerParties || isScheduledTime)) {
    return 'set';
  }

  // Priority 3: Rescheduled event
  if (status === 'Reschedule' && details && hasValue(details.new_appointment_id)) {
    return 'rescheduled';
  }

  // Priority 4: Status-based events
  const statusToEventType = {
    'Current': 'current',
    'Missed': 'missed',
    'Shown': 'shown',
    'Sold': 'sold',
    'Unsold': 'unsold',
    'Cancelled': 'cancelled',
    'Deleted': 'deleted'
  };

  const eventType = statusToEventType[status];
  if (!eventType) {
    throw new Error(`Invalid payload: unsupported appointment status "${status}"`);
  }

  return eventType;
}

/**
 * Determines the status value for the appointment based on event type
 */
function determineStatus(eventType, appointmentStatus) {
  // For confirmed events, always return "Confirmed"
  if (eventType === 'confirmed') {
    return 'Confirmed';
  }

  // For rescheduled events, always return "Rescheduled"
  if (eventType === 'rescheduled') {
    return 'Rescheduled';
  }

  // For all other events, use the appointment_status.status
  const status = appointmentStatus.status;
  return assertStatus(status, status);
}

// ============= MAIN HANDLER =============
addHandler('transform', (request, context) => {
  const start = Date.now();
  const nowIso = () => new Date().toISOString();

  let body, headers, path, query;
  try {
    ({ body, headers, path, query } = request);

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('Invalid payload: body must be an object');
    }
    if (!body.sales_appointment || typeof body.sales_appointment !== 'object') {
      throw new Error('Invalid payload: missing required sales_appointment object');
    }

    // ============= BASE DATA EXTRACTION =============
    const salesAppointment = body.sales_appointment;
    const appointment = salesAppointment.appointment;

    if (!appointment) {
      throw new Error('Invalid payload: missing appointment object');
    }

    const customer_id = getOrNull(body.customer_id);
    const dealer_id = getOrNull(body.dealer_id);
    const dexWsTimestamp = getOrNull(body.timestamp) || Date.now();
    const sentAt = nowIso();
    const payloadHash = getOrNull(headers['idempotency-key']);

    if (!customer_id) {
      throw new Error('Invalid payload: missing customer_id');
    }
    if (!dealer_id) {
      throw new Error('Invalid payload: missing dealer_id');
    }

    const appointment_id = getOrNull(appointment.appointment_id);
    if (!appointment_id) {
      throw new Error('Invalid payload: missing appointment_id');
    }

    // ============= EVENT TYPE DETECTION =============
    const eventType = detectEventType(appointment, salesAppointment);

    // Validate event type
    if (!assertEventType(eventType)) {
      throw new Error(`Invalid event_type: "${eventType}"`);
    }

    // Generate deterministic ID (includes timestamp)
    const eventId = createDeterministicEventId(body, NAMESPACE);

    // ============= COMMON FIELDS =============
    const appointmentStatus = appointment.appointment_status;
    const status = determineStatus(eventType, appointmentStatus);
    const dateTime = getOrNull(appointment.date_time);

    // ============= BUILD PROMAX_CUSTOMER OBJECT =============
    const promaxCustomer = {
      id: customer_id,
      dealer_id: dealer_id
    };

    // primary_tier: 1 for set, current, confirmed, shown, sold, rescheduled, unsold
    const primaryTierEvents = new Set(['set', 'current', 'confirmed', 'shown', 'sold', 'rescheduled', 'unsold']);
    if (primaryTierEvents.has(eventType)) {
      addIfHasValue(promaxCustomer, 'primary_tier', 1);
      addIfHasValue(promaxCustomer, 'last_primary_tier_event', dexWsTimestamp);
    }

    // last_appt_scheduled_for: only for 'set' event, use dateTime
    if (eventType === 'set') {
      addIfHasValue(promaxCustomer, 'last_appt_scheduled_for', dateTime);
    }

    // last_appt_updated_at: for set, current, confirmed, shown, sold, rescheduled, unsold - use dexWsTimestamp
    const apptUpdatedEvents = new Set(['set', 'current', 'confirmed', 'shown', 'sold', 'rescheduled', 'unsold']);
    if (apptUpdatedEvents.has(eventType)) {
      addIfHasValue(promaxCustomer, 'last_appt_updated_at', dexWsTimestamp);
    }

    // Generate metadata for promax_customer
    const customerFieldLastReceivedAt = {
      dealer_id: dexWsTimestamp
    };

    const customerFieldLastReceivedBy = {
      dealer_id: eventId
    };

    // Track all fields that have values
    const excludedFields = ['id', 'field_last_received_at', 'field_last_received_by'];
    for (const [key, value] of Object.entries(promaxCustomer)) {
      if (excludedFields.includes(key)) continue;
      if (hasValue(value)) {
        customerFieldLastReceivedAt[key] = dexWsTimestamp;
        customerFieldLastReceivedBy[key] = eventId;
      }
    }

    promaxCustomer.field_last_received_at = customerFieldLastReceivedAt;
    promaxCustomer.field_last_received_by = customerFieldLastReceivedBy;

    // ============= BUILD PROMAX_APPOINTMENT OBJECT =============
    const promaxAppointment = {
      id: appointment_id,
      dealer_id: dealer_id,
      customer_id: customer_id
    };

    // ============= EVENT-TYPE-SPECIFIC PROCESSING =============
    if (eventType === 'set') {
      // Set event: scheduled_at, scheduled_for, scheduled_by, status, status_updated_at, set_via, comments
      const rootDealerParties = salesAppointment.dealer_parties;
      const scheduledBy = rootDealerParties ? getOrNull(rootDealerParties.employee_id) : null;
      const setVia = getOrNull(appointment.set_via);
      const comments = getOrNull(appointment.comments);

      addIfHasValue(promaxAppointment, 'scheduled_at', dexWsTimestamp);
      addIfHasValue(promaxAppointment, 'scheduled_for', dateTime);
      addIfHasValue(promaxAppointment, 'scheduled_by', scheduledBy);
      addIfHasValue(promaxAppointment, 'status', status);
      addIfHasValue(promaxAppointment, 'status_updated_at', dexWsTimestamp);
      addIfHasValue(promaxAppointment, 'set_via', setVia);
      addIfHasValue(promaxAppointment, 'comments', comments);

    } else if (eventType === 'confirmed') {
      // Confirmed event: status, status_updated_at, confirmed_at, confirmed_by
      const confirmedStatus = appointment.confirmed_status;
      const confirmedDealerParties = confirmedStatus ? confirmedStatus.dealer_parties : null;
      const confirmedBy = confirmedDealerParties ? getOrNull(confirmedDealerParties.employee_id) : null;

      addIfHasValue(promaxAppointment, 'status', status);
      addIfHasValue(promaxAppointment, 'status_updated_at', dexWsTimestamp);
      addIfHasValue(promaxAppointment, 'confirmed_at', dexWsTimestamp);
      addIfHasValue(promaxAppointment, 'confirmed_by', confirmedBy);

    } else if (eventType === 'rescheduled') {
      // Rescheduled event: status, status_updated_at, new_appointment_id
      const details = appointmentStatus.details;
      const newAppointmentId = details ? getOrNull(details.new_appointment_id) : null;

      addIfHasValue(promaxAppointment, 'status', status);
      addIfHasValue(promaxAppointment, 'status_updated_at', dexWsTimestamp);
      addIfHasValue(promaxAppointment, 'new_appointment_id', newAppointmentId);

    } else {
      // All other status change events: status, status_updated_at
      addIfHasValue(promaxAppointment, 'status', status);
      addIfHasValue(promaxAppointment, 'status_updated_at', dexWsTimestamp);
    }

    // ============= BUILD PROMAX_APPOINTMENT_UPDATE OBJECT =============
    const promaxAppointmentUpdate = {
      id: eventId,
      websocket_timestamp: dexWsTimestamp,
      dealer_id: dealer_id,
      customer_id: customer_id,
      appointment_id: appointment_id,
      status: status
    };

    // For confirmed events, use websocket timestamp; otherwise use the appointment date_time
    if (eventType === 'confirmed') {
      addIfHasValue(promaxAppointmentUpdate, 'date_time', dexWsTimestamp);
    } else {
      addIfHasValue(promaxAppointmentUpdate, 'date_time', dateTime);
    }

    // Add event-type-specific fields
    if (eventType === 'set') {
      const rootDealerParties = salesAppointment.dealer_parties;
      const employeeId = rootDealerParties ? getOrNull(rootDealerParties.employee_id) : null;
      const comments = getOrNull(appointment.comments);

      addIfHasValue(promaxAppointmentUpdate, 'employee_id', employeeId);
      addIfHasValue(promaxAppointmentUpdate, 'comments', comments);

    } else if (eventType === 'confirmed') {
      const confirmedStatus = appointment.confirmed_status;
      const confirmedDealerParties = confirmedStatus ? confirmedStatus.dealer_parties : null;
      const employeeId = confirmedDealerParties ? getOrNull(confirmedDealerParties.employee_id) : null;

      addIfHasValue(promaxAppointmentUpdate, 'employee_id', employeeId);

    } else if (eventType === 'rescheduled') {
      const details = appointmentStatus.details;
      const newAppointmentId = details ? getOrNull(details.new_appointment_id) : null;

      addIfHasValue(promaxAppointmentUpdate, 'new_appointment_id', newAppointmentId);
    }

    // ============= BUILD PROMAX_CUSTOMER_LAST_ACTIVITY OBJECT =============
    const promaxCustomerLastActivity = {
      id: customer_id,
      dealer_id: dealer_id
    };

    // Map event types to last activity fields
    if (eventType === 'set') {
      addIfHasValue(promaxCustomerLastActivity, 'last_appt_scheduled_for', dateTime);
      addIfHasValue(promaxCustomerLastActivity, 'last_appt_set', dexWsTimestamp);
    } else if (eventType === 'current') {
      addIfHasValue(promaxCustomerLastActivity, 'last_appt_set', dexWsTimestamp);
    } else if (eventType === 'confirmed') {
      addIfHasValue(promaxCustomerLastActivity, 'last_appt_confirmed', dexWsTimestamp);
    } else if (eventType === 'missed') {
      addIfHasValue(promaxCustomerLastActivity, 'last_appt_missed', dexWsTimestamp);
    } else if (eventType === 'shown') {
      addIfHasValue(promaxCustomerLastActivity, 'last_appt_shown', dexWsTimestamp);
    } else if (eventType === 'sold') {
      addIfHasValue(promaxCustomerLastActivity, 'last_appt_sold', dexWsTimestamp);
    } else if (eventType === 'unsold') {
      addIfHasValue(promaxCustomerLastActivity, 'last_appt_unsold', dexWsTimestamp);
    } else if (eventType === 'cancelled') {
      addIfHasValue(promaxCustomerLastActivity, 'last_appt_cancelled', dexWsTimestamp);
    } else if (eventType === 'rescheduled') {
      addIfHasValue(promaxCustomerLastActivity, 'last_appt_rescheduled', dexWsTimestamp);
    } else if (eventType === 'deleted') {
      addIfHasValue(promaxCustomerLastActivity, 'last_appt_deleted', dexWsTimestamp);
    }

    // ============= BUILD FINAL PAYLOAD =============
    const finalPayload = {
      event: EVENT_NAME,
      event_type: eventType,
      event_version: SCHEMA_VERSION,
      hookdeck_sent_at: sentAt,
      websocket_uuid: eventId,
      promax_websocket_timestamp: dexWsTimestamp,
      payload_hash: payloadHash,
      customer_id: customer_id,
      dealer_id: dealer_id,
      appointment_id: appointment_id,
      promax_customer: promaxCustomer,
      promax_appointment: promaxAppointment,
      promax_appointment_update: promaxAppointmentUpdate,
      promax_customer_last_activity: promaxCustomerLastActivity,
      original_payload: body
    };

    // Add new_appointment_id to root level for rescheduled events
    if (eventType === 'rescheduled') {
      const details = appointmentStatus.details;
      const newAppointmentId = details ? getOrNull(details.new_appointment_id) : null;
      if (newAppointmentId) {
        finalPayload.new_appointment_id = newAppointmentId;
      }
    }

    // ============= LOGGING & METRICS =============
    const logMeta = {
      event_id: eventId,
      payload_hash: payloadHash,
      customer_id: customer_id,
      dealer_id: dealer_id,
      appointment_id: appointment_id,
      event_type: eventType,
      status: status,
      namespace: NAMESPACE,
      event_version: SCHEMA_VERSION
    };

    if (eventType === 'rescheduled') {
      const details = appointmentStatus.details;
      const newAppointmentId = details ? getOrNull(details.new_appointment_id) : null;
      if (newAppointmentId) {
        logMeta.new_appointment_id = newAppointmentId;
      }
    }

    console.log(`Appointment event processed in ${Date.now() - start}ms`, logMeta);

    return {
      body: finalPayload,
      headers,
      path,
      query
    };

  } catch (error) {
    try {
      console.error('Transformation error:', {
        error: error.message,
        stack: error.stack,
        namespace: NAMESPACE,
        event_version: SCHEMA_VERSION,
        body_preview: (() => {
          try {
            const s = JSON.stringify(body);
            return s ? s.slice(0, 500) : null;
          } catch { return null; }
        })()
      });
    } catch { /* no-op */ }

    if (error.message && error.message.startsWith('Invalid payload')) {
      throw error;
    }

    return {
      body: {
        event: EVENT_NAME,
        event_type: 'unknown',
        event_version: SCHEMA_VERSION,
        hookdeck_sent_at: nowIso(),
        websocket_uuid: `error-${Date.now()}`,
        promax_websocket_timestamp: Date.now(),
        payload_hash: getOrNull(headers ? headers['idempotency-key'] : null),
        original_payload: body ?? null,
        error: { message: error.message, timestamp: nowIso() }
      },
      headers,
      path,
      query
    };
  }
});

// ============================================
// END APPOINTMENTS TRANSFORMATION v1.4
// Namespace: promax_dex
// Event: promax_websocket.appointments
// Version: 1.4
// Changes from v1.3:
//   - Added isOn15MinuteBoundary() helper function
//   - Modified detectEventType() to classify as 'set' when date_time
//     is on a 15-minute boundary, even without dealer_parties
// ============================================