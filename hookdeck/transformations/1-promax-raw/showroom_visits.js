// ============================================
// HOOKDECK SHOWROOM VISIT TRANSFORMATION SCRIPT v1.2
// ============================================
// Features:
//   ✅ Handles New Visit, Exit Note, and Delete events
//   ✅ MD5-based deterministic websocket_uuid with namespace (EXCLUDES timestamp for deduplication)
//   ✅ Visit type enum validation
//   ✅ Event type detection from payload structure
//   ✅ Separate promax_customer, promax_showroom_visit, and promax_customer_last_activity objects
//   ✅ Field-level timestamp tracking (field_last_received_at)
//   ✅ Field-level event attribution (field_last_received_by)
//   ✅ Primary tier tracking for new visits
//   ✅ Render ID extraction from idempotency-key header
//   ✅ Exit note exit_at uses original payload timestamp (converted to ISO)
//   ✅ Exit note populates promax_customer.last_showroom_visit from exit_note.date
// ============================================

// ============= CONFIGURATION =============
const NAMESPACE = 'promax_dex';
const SCHEMA_VERSION = '1.2';
const EVENT_NAME = 'promax_websocket.showroom_visit';

// ============= ENUMS =============
const VALID_EVENT_TYPES = new Set(['new_visit', 'exit_note', 'delete']);

const VALID_VISIT_TYPES = new Set([
  'BeBack', 'InternetApptShow', 'PhoneApptShow', 'RepeatCustomer',
  'FreshWalkIn', 'OutsideProspect', 'Referral', 'ServiceCustomer'
]);

function assertVisitType(value, defaultValue = null) {
  if (!value) return defaultValue;
  return VALID_VISIT_TYPES.has(value) ? value : defaultValue;
}

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
 * Creates deterministic event ID from body (EXCLUDES timestamp for deduplication)
 */
function createDeterministicEventId(body, namespace) {
  const bodyWithoutTimestamp = { ...body };
  delete bodyWithoutTimestamp.timestamp;

  const canonical = canonicalStringify(bodyWithoutTimestamp);
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

/**
 * Converts a timestamp value to epoch milliseconds
 * Handles: unix ms epoch (number), unix s epoch (number), or ISO string
 */
function toEpochMs(value) {
  if (!value) return null;
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value;
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.getTime();
  }
  return null;
}

function toIsoString(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof value === 'number') {
    // < 1e12 heuristic: seconds vs milliseconds epoch
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

// ============= EVENT TYPE DETECTION =============

function detectEventType(showroomVisit) {
  if (!showroomVisit || typeof showroomVisit !== 'object') {
    throw new Error('Invalid payload: missing or invalid showroom_visit object');
  }

  if (showroomVisit.new_visit) {
    return 'new_visit';
  }
  if (showroomVisit.exit_note) {
    return 'exit_note';
  }
  if (showroomVisit.delete) {
    return 'delete';
  }

  throw new Error('Invalid payload: showroom_visit must contain new_visit, exit_note, or delete');
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
    if (!body.showroom_visit || typeof body.showroom_visit !== 'object') {
      throw new Error('Invalid payload: missing required showroom_visit object');
    }

    // ============= BASE DATA EXTRACTION =============
    const showroomVisit = body.showroom_visit;

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

    // ============= EVENT TYPE DETECTION =============
    const eventType = detectEventType(showroomVisit);

    if (!assertEventType(eventType)) {
      throw new Error(`Invalid event_type: "${eventType}"`);
    }

    const eventId = createDeterministicEventId(body, NAMESPACE);

    // ============= EVENT-TYPE-SPECIFIC DATA EXTRACTION =============
    let showroom_visit_id = null;
    let dateTime = null;
    let visitType = null;
    let createdBy = null;
    let appointmentId = null;
    let exitNoteId = null;
    let exitAt = null;
    let exitBy = null;
    let isManagerNote = null;
    let exitNote = null;
    let reasonUnsold = null;
    let deletedBy = null;
    let exitNoteDate = null;

    if (eventType === 'new_visit') {
      const newVisit = showroomVisit.new_visit;

      if (!newVisit) {
        throw new Error('Invalid payload: missing new_visit object');
      }

      showroom_visit_id = getOrNull(newVisit.id);
      dateTime = getOrNull(newVisit.date);
      visitType = getOrNull(newVisit.type);
      createdBy = getOrNull(newVisit.employee_id);

      if (!showroom_visit_id) {
        throw new Error('Invalid payload: missing new_visit.id');
      }
      if (!dateTime) {
        throw new Error('Invalid payload: missing new_visit.date');
      }
      if (!visitType) {
        throw new Error('Invalid payload: missing new_visit.type');
      }

      if (!assertVisitType(visitType)) {
        throw new Error(`Invalid visit type: "${visitType}"`);
      }

      if (newVisit.appointment && newVisit.appointment.id) {
        appointmentId = getOrNull(newVisit.appointment.id);
      }

    } else if (eventType === 'exit_note') {
      const exitNoteObj = showroomVisit.exit_note;

      if (!exitNoteObj) {
        throw new Error('Invalid payload: missing exit_note object');
      }

      showroom_visit_id = getOrNull(exitNoteObj.showroom_visit_id);
      exitNoteId = getOrNull(exitNoteObj.id);
      exitNoteDate = getOrNull(exitNoteObj.date);
      // exit_at uses the websocket arrival time, not the exit_note.date
      exitAt = toIsoString(dexWsTimestamp);
      exitBy = getOrNull(exitNoteObj.employee_id);
      isManagerNote = getOrNull(exitNoteObj.is_manager_note);
      exitNote = getOrNull(exitNoteObj.quick_note);
      reasonUnsold = getOrNull(exitNoteObj.reason_unsold);

      if (!showroom_visit_id) {
        throw new Error('Invalid payload: missing exit_note.showroom_visit_id');
      }
      if (!exitNoteId) {
        throw new Error('Invalid payload: missing exit_note.id');
      }

    } else if (eventType === 'delete') {
      const deleteObj = showroomVisit.delete;

      if (!deleteObj) {
        throw new Error('Invalid payload: missing delete object');
      }

      showroom_visit_id = getOrNull(deleteObj.id);
      deletedBy = getOrNull(deleteObj.employee_id);

      if (!showroom_visit_id) {
        throw new Error('Invalid payload: missing delete.id');
      }
    }

    // ============= BUILD PROMAX_CUSTOMER OBJECT =============
    const promaxCustomer = {
      id: customer_id,
      dealer_id: dealer_id
    };

    const customerFieldLastReceivedAt = {
      dealer_id: dexWsTimestamp
    };

    const customerFieldLastReceivedBy = {
      dealer_id: eventId
    };

    if (eventType === 'new_visit') {
      promaxCustomer.primary_tier = 1;
      promaxCustomer.last_primary_tier_event = dateTime;
      promaxCustomer.last_showroom_visit = dateTime;

      customerFieldLastReceivedAt.primary_tier = dexWsTimestamp;
      customerFieldLastReceivedAt.last_primary_tier_event = dexWsTimestamp;
      customerFieldLastReceivedAt.last_showroom_visit = dexWsTimestamp;

      customerFieldLastReceivedBy.primary_tier = eventId;
      customerFieldLastReceivedBy.last_primary_tier_event = eventId;
      customerFieldLastReceivedBy.last_showroom_visit = eventId;
    }

    if (eventType === 'exit_note') {
      promaxCustomer.last_showroom_visit = dexWsTimestamp;

      customerFieldLastReceivedAt.last_showroom_visit = dexWsTimestamp;
      customerFieldLastReceivedBy.last_showroom_visit = eventId;
    }

    promaxCustomer.field_last_received_at = customerFieldLastReceivedAt;
    promaxCustomer.field_last_received_by = customerFieldLastReceivedBy;

    // ============= BUILD PROMAX_SHOWROOM_VISIT OBJECT =============
    const promaxShowroomVisit = {
      id: showroom_visit_id,
      dealer_id: dealer_id,
      customer_id: customer_id
    };

    if (eventType === 'new_visit') {
      promaxShowroomVisit.date_time = dateTime;
      promaxShowroomVisit.type = visitType;
      addIfHasValue(promaxShowroomVisit, 'created_by', createdBy);
      addIfHasValue(promaxShowroomVisit, 'appointment_id', appointmentId);

    } else if (eventType === 'exit_note') {
      // If exit_note.date is >10 min before payload timestamp, it's the actual visit time
      if (exitNoteDate) {
        const exitNoteDateMs = toEpochMs(exitNoteDate);
        const payloadTimestampMs = toEpochMs(dexWsTimestamp);
        if (exitNoteDateMs !== null && payloadTimestampMs !== null) {
          const TEN_MINUTES_MS = 10 * 60 * 1000;
          if ((payloadTimestampMs - exitNoteDateMs) >= TEN_MINUTES_MS) {
            promaxShowroomVisit.date_time = exitNoteDate;
          }
        }
      }
      promaxShowroomVisit.exit_note_id = exitNoteId;
      promaxShowroomVisit.exit_at = exitAt;
      addIfHasValue(promaxShowroomVisit, 'exit_by', exitBy);
      addIfHasValue(promaxShowroomVisit, 'is_manager_note', isManagerNote);
      addIfHasValue(promaxShowroomVisit, 'exit_note', exitNote);
      addIfHasValue(promaxShowroomVisit, 'reason_unsold', reasonUnsold);

    } else if (eventType === 'delete') {
      promaxShowroomVisit.deleted_at = dexWsTimestamp;
      addIfHasValue(promaxShowroomVisit, 'deleted_by', deletedBy);
    }

    // ============= BUILD PROMAX_CUSTOMER_LAST_ACTIVITY OBJECT =============
    const promaxCustomerLastActivity = {
      id: customer_id,
      dealer_id: dealer_id
    };

    if (eventType === 'new_visit') {
      promaxCustomerLastActivity.last_showroom_visit = dexWsTimestamp;
    } else if (eventType === 'exit_note') {
      promaxCustomerLastActivity.last_showroom_visit_exit_note = dexWsTimestamp;
      // Backfill last_showroom_visit with the earlier visit time if >10 min gap
      if (exitNoteDate) {
        const exitNoteDateMs = toEpochMs(exitNoteDate);
        const payloadTimestampMs = toEpochMs(dexWsTimestamp);
        if (exitNoteDateMs !== null && payloadTimestampMs !== null) {
          const TEN_MINUTES_MS = 10 * 60 * 1000;
          if ((payloadTimestampMs - exitNoteDateMs) >= TEN_MINUTES_MS) {
            promaxCustomerLastActivity.last_showroom_visit = exitNoteDateMs;
          }
        }
      }
    } else if (eventType === 'delete') {
      promaxCustomerLastActivity.last_showroom_visit_deleted = dexWsTimestamp;
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
      showroom_visit_id: showroom_visit_id,
      promax_customer: promaxCustomer,
      promax_showroom_visit: promaxShowroomVisit,
      promax_customer_last_activity: promaxCustomerLastActivity,
      original_payload: body
    };

    // ============= LOGGING & METRICS =============
    const logMeta = {
      event_id: eventId,
      payload_hash: payloadHash,
      customer_id: customer_id,
      dealer_id: dealer_id,
      showroom_visit_id: showroom_visit_id,
      event_type: eventType,
      namespace: NAMESPACE,
      event_version: SCHEMA_VERSION
    };

    if (eventType === 'new_visit') {
      logMeta.visit_type = visitType;
      logMeta.has_appointment = !!appointmentId;
    } else if (eventType === 'exit_note') {
      logMeta.is_manager_note = isManagerNote;
      logMeta.has_reason_unsold = !!reasonUnsold;
    }

    console.log(`Showroom visit event processed in ${Date.now() - start}ms`, logMeta);

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