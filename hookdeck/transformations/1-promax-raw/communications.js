// ============================================
// HOOKDECK COMMUNICATIONS TRANSFORMATION SCRIPT v2.7
// ============================================
// Features:
//   ✅ Handles Text (SMS), Phone (Call), Email, Note (User Note), Call Recording Note, and Lead Note events
//   ✅ MD5-based deterministic websocket_uuid with namespace (excludes timestamp for deduplication)
//   ✅ SMS body cleaning (remove carrier info)
//   ✅ Email body cleaning (strip HTML/CSS/tracking pixels, decode entities)
//   ✅ Enhanced phone number normalization (handles 10/11 digit formats)
//   ✅ Consent action detection (SMS - includes help, opt_out_possible)
//   ✅ Call disposition detection with strict priority order
//   ✅ Call recording note parsing (talk_time, disposition, recording_link)
//   ✅ Lead note body extraction (after "Original Message:")
//   ✅ User note support (no direction, no disposition)
//   ✅ Direction normalization (Outgoing → outbound, Incoming → inbound)
//   ✅ Field-level timestamp tracking (field_last_received_at)
//   ✅ Field-level event attribution (field_last_received_by)
//   ✅ Enum validation for event_type, disposition, consent_action
//   ✅ Separate promax_customer, promax_communication, and promax_customer_last_activity objects
//   ✅ Primary tier tracking for SMS/Call/Lead Note events
//   ✅ Payload hash extraction from idempotency-key header
//   ✅ Dynamic lead event tracking (last_lead_{event_name} from "Lead Event:" in body)
// ============================================

// ============= CONFIGURATION =============
const NAMESPACE = 'promax_dex';
const SCHEMA_VERSION = '2.7';
const EVENT_NAME = 'promax_websocket.communications';

// ============= ENUMS =============
const VALID_EVENT_TYPES = new Set(['text', 'call', 'email', 'user_note', 'call_recording_note', 'lead_note']);

const VALID_DISPOSITIONS = new Set([
  'voicemail', 'no_answer', 'hung_up', 'not_interested',
  'disconnected', 'wrong_number', 'busy', 'no_note', 'unknown'
]);

const VALID_CONSENT_ACTIONS = new Set([
  'opt_in_request', 'opt_out', 'opt_in_reply_possible',
  'opt_in_possible', 'opt_out_possible', 'help'
]);

const VALID_DIRECTIONS = new Set(['inbound', 'outbound']);

/**
 * Validates and normalizes enum values
 */
function assertEnum(value, enumSet, defaultValue = null) {
  if (!value) return defaultValue;
  const normalized = value.toString().toLowerCase();
  return enumSet.has(normalized) ? normalized : defaultValue;
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
  function md51(s) {
    let n = s.length, state = [1732584193, -271733879, -1732584194, 271733878], i;
    for (i = 64; i <= n; i += 64) { md5cycle(state, md5blk(s.substring(i - 64, i))); }
    s = s.substring(i - 64); const tail = new Array(16).fill(0);
    for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
    tail[i >> 2] |= 0x80 << ((i % 4) << 3); if (i > 55) { md5cycle(state, tail); tail.fill(0); }
    tail[14] = n * 8; md5cycle(state, tail); return state;
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
  function rhex(n) { const h = '0123456789abcdef'; let s = ''; for (let j = 0; j < 4; j++) { s += h[(n >> ((j * 8) + 4)) & 0x0F] + h[(n >> (j * 8)) & 0x0F]; } return s; }
  const x = md51(string); return rhex(x[0]) + rhex(x[1]) + rhex(x[2]) + rhex(x[3]);
}

// ============= CORE UTILS =============

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

function bytesLength(str) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str).length;
  return unescape(encodeURIComponent(str)).length;
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

/**
 * Enhanced phone number normalization
 * Strips all non-digits, handles 10 and 11 digit formats
 */
function normalizePhoneNumber(phone) {
  if (!phone) return null;

  // Strip all non-digit characters
  const digits = phone.toString().replace(/\D/g, '');

  // If 11 digits starting with 1, drop the leading 1
  if (digits.length === 11 && digits[0] === '1') {
    return digits.substring(1);
  }

  // If 10 digits, return as-is
  if (digits.length === 10) {
    return digits;
  }

  // Otherwise, invalid
  return null;
}

// ============= EMAIL-SPECIFIC UTILS =============

/**
 * Decodes HTML entities including numeric and named entities
 */
function decodeHtmlEntities(text) {
  if (!text) return text;

  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&bull;': '•',
    '&mdash;': '—',
    '&ndash;': '–',
    '&hellip;': '…',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
    '&euro;': '€',
    '&pound;': '£',
    '&yen;': '¥'
  };

  let decoded = text;

  // Replace named entities
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }

  // Decode numeric entities like &#39; &#8217; etc
  decoded = decoded.replace(/&#(\d+);/g, (match, dec) => {
    try {
      return String.fromCodePoint(parseInt(dec, 10));
    } catch {
      return match;
    }
  });

  // Decode hex entities like &#x27;
  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
    try {
      return String.fromCodePoint(parseInt(hex, 16));
    } catch {
      return match;
    }
  });

  return decoded;
}

/**
 * Strips HTML/CSS/tracking pixels from email body and returns clean plain text
 */
function cleanEmailBody(body) {
  if (!body) return null;

  let cleaned = body;

  // Remove <style> blocks and their content
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove <script> blocks and their content
  cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // Remove tracking pixels (1x1 images)
  cleaned = cleaned.replace(/<img[^>]*\bwidth=["']?1["']?[^>]*\bheight=["']?1["']?[^>]*>/gi, '');
  cleaned = cleaned.replace(/<img[^>]*\bheight=["']?1["']?[^>]*\bwidth=["']?1["']?[^>]*>/gi, '');

  // IMPROVED: Remove bare CSS more aggressively
  // Remove @media queries (with nested braces) - iterate to handle nesting
  for (let i = 0; i < 10; i++) {
    const before = cleaned;
    // Match @media...{ anything including nested braces }
    cleaned = cleaned.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/gi, ' ');
    if (before === cleaned) break;
  }

  // Remove all CSS rules: anything {stuff}
  // This matches: "any text that isn't < or > followed by {anything} followed by }"
  // Uses non-greedy match to avoid over-matching
  cleaned = cleaned.replace(/[^<>{}]+?\{[^{}]*\}/g, ' ');

  // Remove all HTML tags but keep content
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  cleaned = decodeHtmlEntities(cleaned);

  // Clean up whitespace
  cleaned = cleaned.replace(/\r\n/g, '\n'); // Normalize line endings
  cleaned = cleaned.replace(/\r/g, '\n');   // Normalize line endings
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines
  cleaned = cleaned.replace(/[ \t]+/g, ' '); // Collapse spaces/tabs
  cleaned = cleaned.replace(/\n /g, '\n');   // Remove leading spaces on lines
  cleaned = cleaned.replace(/ \n/g, '\n');   // Remove trailing spaces on lines

  return cleaned.trim() || null;
}


// ============= SMS-SPECIFIC UTILS =============

function extractPhoneNumber(body) {
  if (!body) return null;

  // Match pattern: (Sent using (###)###-####)
  // Note: Only ONE closing paren at the end
  const match = body.match(/\(Sent using \((\d{3})\)(\d{3})-(\d{4})\)/);
  if (match) {
    return `${match[1]}${match[2]}${match[3]}`;
  }
  return null;
}

function cleanSmsBody(body) {
  if (!body) return null;
  return body.replace(/\s*\(Sent using \(\d{3}\)\d{3}-\d{4}\)\s*$/g, '').trim();
}

/**
 * Detects consent action from SMS body with enhanced patterns
 */
function detectConsentAction(body, direction) {
  if (!body) return null;

  const cleanBody = body.trim();
  const lowerBody = cleanBody.toLowerCase();

  // OUTBOUND: opt_in_request
  if (body.includes('requests permission to send you texts. Reply YES to allow. Reply STOP to end. HELP for help. Msg&data rates may apply.')) {
    return 'opt_in_request';
  }

  // INBOUND only patterns
  if (direction === 'inbound') {
    // help
    if (lowerBody === 'help') {
      return 'help';
    }

    // opt_out (exact matches)
    if (lowerBody === 'stop' || lowerBody === 'unsubscribe' || lowerBody === 'stop all') {
      return 'opt_out';
    }

    // opt_out_possible (contains patterns)
    if (lowerBody.includes('do not text me') ||
      lowerBody.includes('stop texting me') ||
      lowerBody.includes('stop!') ||
      lowerBody.includes('dont text me') ||
      lowerBody.includes("don't text")) {
      return 'opt_out_possible';
    }

    // opt_in_possible (exact matches)
    if (lowerBody === 'y' || lowerBody === 'agree') {
      return 'opt_in_possible';
    }

    // opt_in_reply_possible (exact match for YES)
    if (lowerBody === 'yes') {
      return 'opt_in_reply_possible';
    }
  }

  return null;
}

// ============= CALL-SPECIFIC UTILS =============

function detectCallDisposition(body) {
  if (!body) return 'no_note';

  const trimmed = body.trim();
  const lower = trimmed.toLowerCase();

  if (trimmed === '' || lower === 'no note added') {
    return 'no_note';
  }

  // PRIORITY 1: voicemail
  if (lower.includes('lvm') ||
    lower.includes('vm') ||
    lower.includes('left message') ||
    lower.includes('left msg') ||
    lower.includes('left mssg') ||
    lower.includes('voicemail') ||
    lower.includes('voice mail')) {
    return 'voicemail';
  }

  if (/(?:^|[^a-z])lm(?:[^a-z]|$)/.test(lower)) {
    return 'voicemail';
  }

  // PRIORITY 2: no_answer
  if (lower.includes('no vm') ||
    lower.includes('vm not set up') ||
    lower.includes('vm not setup') ||
    lower.includes('mb not setup') ||
    lower.includes('mb not set up') ||
    lower.includes('no answer') ||
    lower.includes("'t leave message") ||
    lower.includes("'t leave msg") ||
    lower.includes("'t leave voicemail") ||
    lower.includes("'t leave vm") ||
    lower.includes("'t leave a message") ||
    lower.includes("'t leave a msg") ||
    lower.includes("'t leave a voicemail") ||
    lower.includes("'t leave a vm") ||
    lower.includes('not leave message') ||
    lower.includes('not leave msg') ||
    lower.includes('not leave voicemail') ||
    lower.includes('not leave vm') ||
    lower.includes('not leave a message') ||
    lower.includes('not leave a msg') ||
    lower.includes('not leave a voicemail') ||
    lower.includes('not leave a vm')) {
    return 'no_answer';
  }

  if (/(?:^|[^a-z])na(?:[^a-z]|$)/.test(lower)) {
    return 'no_answer';
  }

  // PRIORITY 3: hung_up (added hangup, hungup)
  if (lower.includes('hung up') ||
    lower.includes('hang up') ||
    lower.includes('hangup') ||
    lower.includes('hungup')) {
    return 'hung_up';
  }

  // PRIORITY 4: not_interested
  if (lower.includes('not interested')) {
    return 'not_interested';
  }

  // PRIORITY 5: disconnected
  if (lower.includes('disconnected') || lower.includes('dropped')) {
    return 'disconnected';
  }

  // PRIORITY 6: wrong_number
  if (lower.includes('wrong number') ||
    lower.includes('wrong phone') ||
    lower.includes('invalid phone') ||
    lower.includes('invalid number') ||
    lower.includes('bad number')) {
    return 'wrong_number';
  }

  // PRIORITY 7: busy
  if (lower.includes('busy') ||
    lower.includes('busy signal') ||
    lower.includes('line busy')) {
    return 'busy';
  }

  return 'unknown';
}

// ============= CALL RECORDING NOTE UTILS =============

function parseCallRecordingNote(body) {
  if (!body) return {};

  const data = {};
  const lines = body.split(/\r?\n/);

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.substring(0, colonIndex).trim();
    const value = line.substring(colonIndex + 1).trim();

    if (value) {
      data[key] = value;
    }
  }

  return {
    talk_time: data.DurationSeconds ? parseInt(data.DurationSeconds, 10) : null,
    disposition: data.CallDnaClassification || null,
    from_number: normalizePhoneNumber(data.DisplayCallerId),
    to_number: normalizePhoneNumber(data.ClickToCallForwardNumber),
    recording_link: data.CallAudioURL || null
  };
}

// ============= LEAD NOTE UTILS =============

function extractLeadNoteBody(body) {
  if (!body) return null;

  const marker = 'Original Message:';
  const index = body.indexOf(marker);

  if (index !== -1) {
    const extracted = body.substring(index + marker.length).trim();
    return extracted || null;
  }

  return body.trim() || null;
}

/**
 * Extracts the lead event name from body if "Lead Event:" is present (exact case)
 * Returns null if not found or empty
 */
function extractLeadEventName(body) {
  if (!body) return null;

  const marker = 'Lead Event:';
  const index = body.indexOf(marker);

  if (index === -1) return null;

  // Get the text after "Lead Event:"
  const afterMarker = body.substring(index + marker.length);

  // Extract until end of line or end of string
  const endOfLine = afterMarker.search(/[\r\n]/);
  const eventName = endOfLine === -1
    ? afterMarker.trim()
    : afterMarker.substring(0, endOfLine).trim();

  return eventName || null;
}

// ============= COMMON UTILS =============

function normalizeDirection(direction) {
  if (!direction) return null;
  const normalized = direction.toLowerCase();
  if (normalized === 'outgoing') return 'outbound';
  if (normalized === 'incoming') return 'inbound';
  return normalized;
}

function normalizeEventType(type, direction) {
  if (!type) return null;
  const normalized = type.toLowerCase();
  if (normalized === 'text') return 'text';
  if (normalized === 'phone') return 'call';
  if (normalized === 'email') return 'email';
  if (normalized === 'lead') return 'lead_note';
  if (normalized === 'note') {
    if (!direction) return 'user_note';
    const normalizedDir = direction.toLowerCase();
    if (normalizedDir === 'outgoing') return 'call_recording_note';
  }
  return null;
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
    if (!body.communications || typeof body.communications !== 'object') {
      throw new Error('Invalid payload: missing required communications object');
    }

    const rawCanonical = stableStringify(body);
    const bodyBytes = bytesLength(rawCanonical);

    // ============= BASE DATA EXTRACTION =============
    const communications = body.communications;
    const customer_id = getOrNull(body.customer_id);
    const dealer_id = getOrNull(body.dealer_id);
    const employee_id = getOrNull(communications.employee_id);
    const dexWsTimestamp = getOrNull(body.timestamp) || Date.now();
    const sentAt = nowIso();
    const payloadHash = getOrNull(headers['idempotency-key']);

    const messages = Array.isArray(communications.messages) ? communications.messages : [];

    if (messages.length === 0) {
      throw new Error('Invalid payload: messages array is empty');
    }

    const message = messages[0];

    if (!message || !message.date_time) {
      throw new Error('Invalid payload: message missing required date_time');
    }

    // ============= MESSAGE TYPE DETECTION =============
    const messageType = getOrNull(message.type);
    const messageDirection = message.direction;
    const eventType = normalizeEventType(messageType, messageDirection);

    if (!eventType) {
      throw new Error(`Invalid payload: unsupported message type "${messageType}" with direction "${messageDirection}"`);
    }

    // Validate event type
    if (!assertEnum(eventType, VALID_EVENT_TYPES)) {
      throw new Error(`Invalid event_type: "${eventType}"`);
    }

    // ============= COMMON MESSAGE PROCESSING =============
    const direction = messageDirection ? normalizeDirection(messageDirection) : null;
    const rawBody = getOrNull(message.body);
    const rawSubject = getOrNull(message.subject);
    const occurredAt = getOrNull(message.date_time);

    // Generate deterministic ID (excludes timestamp for deduplication)
    const eventId = createDeterministicEventId(body, NAMESPACE);

    // ============= EVENT-TYPE-SPECIFIC PROCESSING =============
    let fromNumber = null;
    let toNumber = null;
    let cleanedBody = rawBody;
    let subject = null;
    let consentAction = null;
    let disposition = null;
    let talkTime = null;
    let recordingLink = null;
    let leadEventName = null;

    if (eventType === 'text') {
      fromNumber = direction === 'outbound' ? extractPhoneNumber(rawBody) : null;
      cleanedBody = cleanSmsBody(rawBody);
      consentAction = detectConsentAction(rawBody, direction);

      // Validate consent_action
      if (consentAction) {
        consentAction = assertEnum(consentAction, VALID_CONSENT_ACTIONS);
      }
    } else if (eventType === 'call') {
      disposition = detectCallDisposition(rawBody);

      // Validate disposition
      disposition = assertEnum(disposition, VALID_DISPOSITIONS, 'unknown');
    } else if (eventType === 'email') {
      cleanedBody = cleanEmailBody(rawBody);
      subject = rawSubject;
    } else if (eventType === 'call_recording_note') {
      const parsed = parseCallRecordingNote(rawBody);
      talkTime = parsed.talk_time;
      disposition = parsed.disposition;
      fromNumber = parsed.from_number;
      toNumber = parsed.to_number;
      recordingLink = parsed.recording_link;

      // Validate disposition
      if (disposition) {
        disposition = assertEnum(disposition, VALID_DISPOSITIONS);
      }
    } else if (eventType === 'lead_note') {
      cleanedBody = extractLeadNoteBody(rawBody);
      // Extract lead event name for dynamic field in promax_customer_last_activity
      leadEventName = extractLeadEventName(rawBody);
    }
    // user_note: no special processing needed

    // ============= CALCULATE LAST COMMUNICATION TIMESTAMPS AND PRIMARY TIER =============
    let lastIbSms = null;
    let lastObSms = null;
    let lastIbCall = null;
    let lastObCall = null;
    let primaryTier = null;
    let lastPrimaryTierEvent = null;

    if (eventType === 'text') {
      const isOptOut = consentAction === 'opt_out';

      if (direction === 'inbound') {
        // Only update SMS + tier if it's NOT an opt-out
        if (!isOptOut) {
          lastIbSms = occurredAt;
          primaryTier = 2;
          lastPrimaryTierEvent = occurredAt;
        }
        // If opt-out → do nothing for tier or last_ib_sms
      } else if (direction === 'outbound') {
        lastObSms = occurredAt;
        primaryTier = 3;
        lastPrimaryTierEvent = occurredAt;
      }

    } else if (eventType === 'call') {
      if (direction === 'inbound') {
        lastIbCall = occurredAt;
        primaryTier = 2;
        lastPrimaryTierEvent = occurredAt;
      } else if (direction === 'outbound') {
        lastObCall = occurredAt;
        primaryTier = 3;
        lastPrimaryTierEvent = occurredAt;
      }
    }

    // email, user_note, and call_recording_note: no last_* timestamps or tier

    // lead_note: set primary_tier = 1, last_primary_tier_event, and last_lead
    if (eventType === 'lead_note') {
      primaryTier = 1;
      lastPrimaryTierEvent = occurredAt;
    }

    // ============= BUILD PROMAX_CUSTOMER OBJECT =============
    const promaxCustomer = {
      id: customer_id,
      dealer_id: dealer_id
    };

    // Add event-type-specific fields
    if (eventType === 'text' || eventType === 'call') {
      addIfHasValue(promaxCustomer, 'last_ib_sms', lastIbSms);
      addIfHasValue(promaxCustomer, 'last_ob_sms', lastObSms);
      addIfHasValue(promaxCustomer, 'last_ib_call', lastIbCall);
      addIfHasValue(promaxCustomer, 'last_ob_call', lastObCall);
      addIfHasValue(promaxCustomer, 'primary_tier', primaryTier);
      addIfHasValue(promaxCustomer, 'last_primary_tier_event', lastPrimaryTierEvent);
    } else if (eventType === 'lead_note') {
      addIfHasValue(promaxCustomer, 'primary_tier', primaryTier);
      addIfHasValue(promaxCustomer, 'last_primary_tier_event', lastPrimaryTierEvent);
      addIfHasValue(promaxCustomer, 'last_lead', occurredAt);
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

    // ============= BUILD PROMAX_COMMUNICATION OBJECT =============
    const promaxCommunication = {
      id: eventId,
      occurred_at: occurredAt,
      customer_id: customer_id,
      dealer_id: dealer_id
    };

    // Add employee_id for text, call, email, and user_note (NOT for call_recording_note or lead_note)
    if (eventType !== 'call_recording_note' && eventType !== 'lead_note') {
      addIfHasValue(promaxCommunication, 'employee_id', employee_id);
    }

    // Add direction for text, call, email, and call_recording_note (NOT for user_note or lead_note)
    if (eventType !== 'user_note' && eventType !== 'lead_note') {
      // Validate direction
      const validatedDirection = assertEnum(direction, VALID_DIRECTIONS);
      addIfHasValue(promaxCommunication, 'direction', validatedDirection);
    }

    // Add subject only for email
    if (eventType === 'email') {
      addIfHasValue(promaxCommunication, 'subject', subject);
    }

    // Add body for text, call, email, user_note, and lead_note (NOT for call_recording_note)
    if (eventType !== 'call_recording_note') {
      addIfHasValue(promaxCommunication, 'body', cleanedBody);
    }

    // Add event-type-specific fields
    if (eventType === 'text') {
      addIfHasValue(promaxCommunication, 'consent_action', consentAction);
      addIfHasValue(promaxCommunication, 'from_number', fromNumber);
    } else if (eventType === 'call') {
      addIfHasValue(promaxCommunication, 'disposition', disposition);
    } else if (eventType === 'call_recording_note') {
      addIfHasValue(promaxCommunication, 'talk_time', talkTime);
      addIfHasValue(promaxCommunication, 'disposition', disposition);
      addIfHasValue(promaxCommunication, 'from_number', fromNumber);
      addIfHasValue(promaxCommunication, 'to_number', toNumber);
      addIfHasValue(promaxCommunication, 'recording_link', recordingLink);
    }
    // email, user_note, and lead_note: no additional fields

    // ============= BUILD PROMAX_CUSTOMER_LAST_ACTIVITY OBJECT =============
    const promaxCustomerLastActivity = {
      id: customer_id,
      dealer_id: dealer_id
    };

    const DIRECTION_COMM_TYPE = { text: 'sms', call: 'call', email: 'email' };
    const commType = DIRECTION_COMM_TYPE[eventType];
    if (commType) {
      if (direction === 'inbound') {
        promaxCustomerLastActivity[`last_ib_${commType}`] = dexWsTimestamp;
      } else if (direction === 'outbound') {
        promaxCustomerLastActivity[`last_ob_${commType}`] = dexWsTimestamp;
      }
    } else if (eventType === 'lead_note') {
      promaxCustomerLastActivity.last_lead_note = dexWsTimestamp;
      // Add dynamic lead event field if "Lead Event:" was found in body
      if (leadEventName) {
        promaxCustomerLastActivity[`last_lead_${leadEventName}`] = dexWsTimestamp;
      }
    } else if (eventType === 'user_note' || eventType === 'call_recording_note') {
      promaxCustomerLastActivity[`last_${eventType}`] = dexWsTimestamp;
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
      promax_customer: promaxCustomer,
      promax_communication: promaxCommunication,
      promax_customer_last_activity: promaxCustomerLastActivity,
      original_payload: body
    };

    // ============= LOGGING & METRICS =============
    const logMeta = {
      event_id: eventId,
      payload_hash: payloadHash,
      customer_id: customer_id,
      dealer_id: dealer_id,
      event_type: eventType,
      namespace: NAMESPACE,
      event_version: SCHEMA_VERSION
    };

    if (eventType !== 'user_note' && eventType !== 'lead_note') {
      logMeta.direction = direction;
    }

    if (eventType === 'text') {
      logMeta.consent_action = consentAction;
      logMeta.has_from_number = !!fromNumber;
      logMeta.primary_tier = primaryTier;
    } else if (eventType === 'call') {
      logMeta.disposition = disposition;
      logMeta.primary_tier = primaryTier;
    } else if (eventType === 'email') {
      logMeta.has_subject = !!subject;
    } else if (eventType === 'call_recording_note') {
      logMeta.disposition = disposition;
      logMeta.talk_time = talkTime;
      logMeta.has_recording = !!recordingLink;
    } else if (eventType === 'lead_note') {
      logMeta.lead_event_name = leadEventName;
      logMeta.primary_tier = primaryTier;
    }

    console.log(`Communication event processed in ${Date.now() - start}ms`, logMeta);

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
// END COMMUNICATIONS TRANSFORMATION v2.7
// Namespace: promax_dex
// Event: promax_websocket.communications
// Version: 2.7
// ============================================