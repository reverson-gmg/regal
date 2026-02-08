// ============================================
// HOOKDECK STATUS TRANSFORMATION SCRIPT v2.7
// ============================================
// Features:
//   ✅ Handles customer_status, lead_status, and service_status events
//   ✅ MD5-based deterministic websocket_uuid (excludes timestamp for deduplication)
//   ✅ Flexible status handling (1, 2, or 3 status types)
//   ✅ Field-level timestamp tracking (field_last_received_at)
//   ✅ Field-level event attribution (field_last_received_by)
//   ✅ Separate promax_customer and promax_status objects
//   ✅ Conditional dealer_id inclusion (not for Lead status)
//   ✅ primary_tier: '1' for Delivered, '4' otherwise (excluded for Bad Lead/Unsubscribe/Bad - Invalid Info)
//   ✅ last_primary_tier_event tracking (excluded for Bad Lead/Unsubscribe/Bad - Invalid Info)
//   ✅ promax_customer_last_activity with:
//      - last_customer_status_update (when Customer status present)
//      - last_lead_status_update (when Lead status present)
//      - last_delivered (only when customer_status = "Delivered")
// ============================================

// ============= CONFIGURATION =============
const NAMESPACE = 'promax_dex';
const SCHEMA_VERSION = '2.7';
const EVENT_NAME = 'promax_websocket.status';

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

function stableStringify(value) {
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
      if (Array.isArray(v)) return v.map(enc);
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
  // Create a copy without the timestamp field
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
    if (!body.customer_status || typeof body.customer_status !== 'object') {
      throw new Error('Invalid payload: missing required customer_status object');
    }

    // ============= BASE DATA EXTRACTION =============
    const statusObj = body.customer_status;
    const customer_id = getOrNull(body.customer_id);
    const dealer_id = getOrNull(body.dealer_id);
    const dexWsTimestamp = getOrNull(body.timestamp) || Date.now();
    const payloadHash = getOrNull(headers['idempotency-key']);
    const sentAt = nowIso();

    if (!customer_id) {
      throw new Error('Invalid payload: missing required customer_id');
    }
    if (!dealer_id) {
      throw new Error('Invalid payload: missing required dealer_id');
    }

    // Generate deterministic ID (excludes timestamp for deduplication)
    const eventId = createDeterministicEventId(body, NAMESPACE);

    // ============= EXTRACT STATUS FIELDS =============
    const customerStatus = getOrNull(statusObj.customer_status);
    const customerStatusId = getOrNull(statusObj.customer_status_id);
    const leadStatus = getOrNull(statusObj.lead_status);
    const leadStatusId = getOrNull(statusObj.lead_status_id);
    const serviceStatus = getOrNull(statusObj.service_status);
    const serviceStatusId = getOrNull(statusObj.service_status_id);

    // ============= DETERMINE PRIMARY TIER =============
    // '1' for Delivered, '4' for all other statuses
    // Excluded when status name contains: "Bad Lead", "Unsubscribe", "Bad - Invalid Info"
    const isDelivered = customerStatus && customerStatus.toLowerCase() === 'delivered';

    // Check if primary tier should be excluded based on status names
    const excludedStatusPatterns = ['bad lead', 'unsubscribe', 'bad - invalid info'];
    const shouldExcludePrimaryTier = (status) => {
      if (!status || typeof status !== 'string') return false;
      const lowerStatus = status.toLowerCase();
      return excludedStatusPatterns.some(pattern => lowerStatus.includes(pattern));
    };

    const excludePrimaryTier = shouldExcludePrimaryTier(customerStatus) ||
      shouldExcludePrimaryTier(leadStatus) ||
      shouldExcludePrimaryTier(serviceStatus);

    const primaryTier = excludePrimaryTier ? null : (isDelivered ? 1 : 4);

    // ============= BUILD PROMAX_CUSTOMER OBJECT =============
    const promaxCustomer = {
      id: customer_id,
      dealer_id: dealer_id
    };

    // Add status fields if present
    addIfHasValue(promaxCustomer, 'customer_status', customerStatus);
    addIfHasValue(promaxCustomer, 'customer_status_id', customerStatusId);
    addIfHasValue(promaxCustomer, 'lead_status', leadStatus);
    addIfHasValue(promaxCustomer, 'lead_status_id', leadStatusId);
    addIfHasValue(promaxCustomer, 'service_status', serviceStatus);
    addIfHasValue(promaxCustomer, 'service_status_id', serviceStatusId);

    // Add primary tier fields (only when not excluded)
    if (!excludePrimaryTier) {
      promaxCustomer.primary_tier = primaryTier;
      promaxCustomer.last_primary_tier_event = dexWsTimestamp;
    }

    // Generate metadata
    const fieldLastReceivedAt = {};
    const fieldLastReceivedBy = {};
    const excludedFields = ['id', 'field_last_received_at', 'field_last_received_by'];

    for (const [key, value] of Object.entries(promaxCustomer)) {
      if (excludedFields.includes(key)) continue;
      if (hasValue(value)) {
        fieldLastReceivedAt[key] = dexWsTimestamp;
        fieldLastReceivedBy[key] = eventId;
      }
    }

    promaxCustomer.field_last_received_at = fieldLastReceivedAt;
    promaxCustomer.field_last_received_by = fieldLastReceivedBy;

    // ============= BUILD PROMAX_STATUS ARRAY =============
    const promaxStatus = [];

    // Customer Status
    if (hasValue(customerStatusId) && hasValue(customerStatus)) {
      promaxStatus.push({
        id: customerStatusId,
        type: 'Customer',
        name: customerStatus,
        dealer_id: dealer_id
      });
    }

    // Service Status
    if (hasValue(serviceStatusId) && hasValue(serviceStatus)) {
      promaxStatus.push({
        id: serviceStatusId,
        type: 'Service',
        name: serviceStatus,
        dealer_id: dealer_id
      });
    }

    // Lead Status (NO dealer_id)
    if (hasValue(leadStatusId) && hasValue(leadStatus)) {
      promaxStatus.push({
        id: leadStatusId,
        type: 'Lead',
        name: leadStatus
      });
    }

    // ============= BUILD PROMAX_CUSTOMER_LAST_ACTIVITY =============
    const promaxCustomerLastActivity = {
      id: customer_id,
      dealer_id: dealer_id
    };

    // Add last_customer_status_update when Customer status is present
    if (hasValue(customerStatus)) {
      promaxCustomerLastActivity.last_customer_status_update = dexWsTimestamp;
    }

    // Add last_lead_status_update when Lead status is present
    if (hasValue(leadStatus)) {
      promaxCustomerLastActivity.last_lead_status_update = dexWsTimestamp;
    }

    // Only include last_delivered if customer_status = "Delivered"
    if (isDelivered) {
      promaxCustomerLastActivity.last_delivered = dexWsTimestamp;
    }

    // ============= BUILD FINAL PAYLOAD =============
    const finalPayload = {
      event: EVENT_NAME,
      event_version: SCHEMA_VERSION,
      hookdeck_sent_at: sentAt,
      websocket_uuid: eventId,
      promax_websocket_timestamp: dexWsTimestamp,
      payload_hash: payloadHash,
      customer_id: customer_id,
      dealer_id: dealer_id,
      promax_customer: promaxCustomer,
      promax_status: promaxStatus,
      promax_customer_last_activity: promaxCustomerLastActivity,
      original_payload: body
    };

    // ============= LOGGING & METRICS =============
    const logMeta = {
      event_id: eventId,
      customer_id: customer_id,
      dealer_id: dealer_id,
      namespace: NAMESPACE,
      event_version: SCHEMA_VERSION,
      status_types_count: promaxStatus.length,
      has_customer_status: hasValue(customerStatusId),
      has_lead_status: hasValue(leadStatusId),
      has_service_status: hasValue(serviceStatusId),
      primary_tier: primaryTier,
      exclude_primary_tier: excludePrimaryTier,
      is_delivered: isDelivered
    };

    console.log(`Status event processed in ${Date.now() - start}ms`, logMeta);

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
            const s = stableStringify(body);
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
// END STATUS TRANSFORMATION v2.7
// Namespace: promax_dex
// Event: promax_websocket.status
// Version: 2.7
// ============================================