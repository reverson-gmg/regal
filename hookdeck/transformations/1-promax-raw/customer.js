// ============================================
// HOOKDECK CUSTOMER TRANSFORMATION SCRIPT v2.7
// ============================================
// Features:
//   ✅ MD5-based deterministic event_id with namespace (INCLUDES timestamp)
//   ✅ Canonical array ordering for collision-proof event_id
//   ✅ UTF-8 byte-accurate size checking
//   ✅ Unicode NFKD normalization for names
//   ✅ State/ZIP standardization
//   ✅ Month-end safe date arithmetic
//   ✅ Duration validation (integer >= 0)
//   ✅ Case-insensitive field lookups
//   ✅ Null-like string handling ('null', 'n/a')
//   ✅ Schema versioning
//   ✅ Deterministic Regal UUID generation
//   ✅ Structured payload with promax_customer, regal_contact, promax_lead_source
//   ✅ Separate promax_customer_previous_address object
//   ✅ Separate promax_customer_sensitive object for PII
//   ✅ Sparse field mapping (only non-null values)
//   ✅ Flattened address fields with standardized naming
//   ✅ Field-level timestamp tracking (field_last_received_at)
//   ✅ Field-level event attribution (field_last_received_by)
//   ✅ Vehicle data pass-through
//   ✅ Phone number normalization (10-digit format)
// ============================================

// ============= CONFIGURATION =============
const NAMESPACE = 'promax_dex';
const SCHEMA_VERSION = '2.7';
const EVENT_NAME = 'promax_websocket.customer';
const MAX_BODY_BYTES = 5_000_000; // 5MB

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

function createDeterministicEventId(body, namespace) {
  const canonical = canonicalStringify(body);
  const namespaced = `${namespace}:${canonical}`;
  const hex = md5(namespaced);
  return md5ToUuid(hex);
}

function createUUIDFromString(str) {
  if (!str) return null;
  try {
    const hex = md5(str);
    return md5ToUuid(hex);
  } catch { return null; }
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasAlphabeticCharacter(str) {
  if (!str || typeof str !== 'string') return false;
  return /[a-zA-Z]/.test(str);
}

function normalizeLastName(lastName) {
  if (!lastName) return null;
  try {
    let normalized = lastName.toLowerCase();

    const suffixes = [
      ', i', ' i', ', ii', ' ii', ', iii', ' iii', ', iv', ' iv', ', v', ' v',
      ', vi', ' vi', ', vii', ' vii', ', viii', ' viii', ', ix', ' ix', ', x', ' x',
      ', jr.', ' jr.', ', jr', ' jr', ', sr.', ' sr.', ', sr', ' sr',
      ', md', ' md', ', do', ' do', ', phd', ' phd', ', jd', ' jd', ', esq', ' esq',
      ', dds', ' dds', ', dvm', ' dvm', ', rn', ' rn', ', cpa', ' cpa',
      ', mba', ' mba', ', ms', ' ms', ', bs', ' bs', ', pa', ' pa'
    ];

    suffixes.forEach(suffix => {
      const escapedSuffix = escapeRegex(suffix);
      normalized = normalized.replace(new RegExp(escapedSuffix + '$'), '');
    });

    const prefixes = ['dr. ', 'dr ', 'rev. ', 'rev ', 'fr. ', 'fr ', 'col. ', 'col ', 'gen. ', 'gen ', 'capt. ', 'capt '];
    prefixes.forEach(prefix => {
      if (normalized.startsWith(prefix)) {
        normalized = normalized.substring(prefix.length);
      }
    });

    normalized = normalized
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '');

    normalized = normalized.replace(/[0-9]/g, '');

    const specialChars = ['~', '`', '^', '$', '@', '&', '*', '(', ')', '-', '_', '=', '+', '|', '[', ']', '{', '}', ';', ':', "'", '"', '/', '.', ',', '>', '<', ' '];
    specialChars.forEach(char => {
      const escapedChar = escapeRegex(char);
      normalized = normalized.replace(new RegExp(escapedChar, 'g'), '');
    });

    return normalized.trim() || null;
  } catch { return null; }
}

function isPlaceholderName(value) {
  if (!value || typeof value !== 'string') return true;
  const trimmed = value.trim();
  return trimmed === '-' || trimmed === '+' || trimmed === '*' || trimmed === '';
}

function findFirst(array, propertyName, propertyValue) {
  if (!Array.isArray(array)) return null;
  try {
    const normalized = typeof propertyValue === 'string'
      ? propertyValue.toLowerCase()
      : propertyValue;

    return array.find(item => {
      if (!item) return false;
      const val = item[propertyName];
      const itemVal = typeof val === 'string' ? val.toLowerCase() : val;
      return itemVal === normalized;
    }) || null;
  } catch { return null; }
}

function subtractMonthsSafe(months, baseTimestamp) {
  if (!months || !baseTimestamp) return null;
  try {
    const date = new Date(baseTimestamp);
    if (isNaN(date.getTime())) return null;

    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() - months);

    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, lastDay));

    return date.toISOString();
  } catch { return null; }
}

function validateDuration(duration) {
  if (!duration) return null;
  try {
    const parsed = parseInt(duration, 10);
    return (Number.isFinite(parsed) && parsed >= 0 && parsed <= 900) ? parsed : null;
  } catch { return null; }
}

function normalizeState(state) {
  if (!state) return null;
  try {
    const normalized = state.toString().trim().toUpperCase();
    return normalized.slice(0, 2) || null;
  } catch { return null; }
}

function normalizeZip(zip) {
  if (!zip) return null;
  try {
    const clean = zip.toString().replace(/\D/g, '');
    if (clean.length >= 5) {
      return clean.slice(0, 5);
    }
    return null;
  } catch {
    return null;
  }
}

function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber) return null;
  try {
    const digits = phoneNumber.toString().replace(/\D/g, '');
    if (digits.length === 10) return digits;
    if (digits.length === 11 && digits[0] === '1') return digits.substring(1);
    return null;
  } catch { return null; }
}

function obfuscateSSN(ssn) {
  if (!ssn) return 'N/A';
  const ssnStr = ssn.toString();
  if (ssnStr.length >= 4) return `XXX-XX-${ssnStr.slice(-4)}`;
  return 'XXX-XX-XXXX';
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

function buildNestedMetadata(obj, timestamp, eventId) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;

  const timestampObj = {};
  const attributionObj = {};

  for (const [key, value] of Object.entries(obj)) {
    if (hasValue(value) && typeof value !== 'object') {
      timestampObj[key] = timestamp;
      attributionObj[key] = eventId;
    } else if (typeof value === 'object' && !Array.isArray(value) && hasValue(value)) {
      const nested = buildNestedMetadata(value, timestamp, eventId);
      if (nested && nested.timestamps && Object.keys(nested.timestamps).length > 0) {
        timestampObj[key] = nested.timestamps;
        attributionObj[key] = nested.attribution;
      }
    }
  }

  return {
    timestamps: Object.keys(timestampObj).length > 0 ? timestampObj : null,
    attribution: Object.keys(attributionObj).length > 0 ? attributionObj : null
  };
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
    if (!body.customer || typeof body.customer !== 'object') {
      throw new Error('Invalid payload: missing required customer object');
    }

    const rawCanonical = stableStringify(body);
    const bodyBytes = bytesLength(rawCanonical);
    if (bodyBytes > MAX_BODY_BYTES) {
      console.warn(`Large payload detected: ${bodyBytes} bytes`);
    }

    // ============= BASE IDENTIFIERS =============
    const eventId = createDeterministicEventId(body, NAMESPACE);
    const customer_id = getOrNull(body.customer_id);
    const dealer_id = getOrNull(body.dealer_id);
    const sentAt = nowIso();
    const dexWsTimestamp = getOrNull(body.timestamp) || Date.now();
    const payloadHash = getOrNull(headers['idempotency-key']);

    // ============= DATA EXTRACTION =============

    const person = body.customer?.person || {};
    const communications = Array.isArray(person.communications) ? person.communications : [];
    const addresses = Array.isArray(person.address) ? person.address : [];
    const dealerParties = Array.isArray(body.customer?.dealer_parties) ? body.customer.dealer_parties : [];

    const rawLastName = getOrNull(person.last_name);
    const validLastName = hasAlphabeticCharacter(rawLastName) ? rawLastName : null;
    const lastNameNormalized = normalizeLastName(validLastName);


    const cellPhone = findFirst(communications, 'communication_type', 'CellPhone');
    const homePhone = findFirst(communications, 'communication_type', 'HomePhone');
    const workPhone = findFirst(communications, 'communication_type', 'WorkPhone');
    const primaryEmail = findFirst(communications, 'communication_type', 'PrimaryEmail');
    const secondaryEmail = findFirst(communications, 'communication_type', 'SecondaryEmail');

    const cellPhoneFormatted = normalizePhoneNumber(cellPhone?.complete_number);
    const homePhoneFormatted = normalizePhoneNumber(homePhone?.complete_number);
    const workPhoneFormatted = normalizePhoneNumber(workPhone?.complete_number);

    const currentAddress = findFirst(addresses, 'address_type', 'Current');
    const prev1Address = findFirst(addresses, 'address_type', 'Previous1');
    const prev2Address = findFirst(addresses, 'address_type', 'Previous2');
    const prev3Address = findFirst(addresses, 'address_type', 'Previous3');

    const salesRep1 = findFirst(dealerParties, 'party_type', 'SalesRep1');
    const salesRep2 = findFirst(dealerParties, 'party_type', 'SalesRep2');
    const salesBdr = findFirst(dealerParties, 'party_type', 'SalesBDR');
    const serviceBdr = findFirst(dealerParties, 'party_type', 'ServiceBDR');

    const cellPhoneNumber = cellPhone?.complete_number;
    const regalId = (lastNameNormalized && cellPhoneNumber)
      ? `${lastNameNormalized}_${cellPhoneNumber}`
      : null;
    const regalUuid = createUUIDFromString(regalId);

    const currAddrDuration = validateDuration(currentAddress?.duration);
    const currAddrStart = currAddrDuration
      ? subtractMonthsSafe(currAddrDuration, dexWsTimestamp)
      : null;
    const currAddrZip = normalizeZip(currentAddress?.zip_code);
    const currAddrState = normalizeState(currentAddress?.state);

    const prev1AddrDuration = validateDuration(prev1Address?.duration);
    const prev1AddrZip = normalizeZip(prev1Address?.zip_code);
    const prev1AddrState = normalizeState(prev1Address?.state);

    const prev2AddrDuration = validateDuration(prev2Address?.duration);
    const prev2AddrZip = normalizeZip(prev2Address?.zip_code);
    const prev2AddrState = normalizeState(prev2Address?.state);

    const prev3AddrDuration = validateDuration(prev3Address?.duration);
    const prev3AddrZip = normalizeZip(prev3Address?.zip_code);
    const prev3AddrState = normalizeState(prev3Address?.state);

    const desiredVehicle = Array.isArray(body.customer?.desired_vehicle)
      ? body.customer.desired_vehicle
      : [];
    const tradeVehicle = Array.isArray(body.customer?.trade_vehicle)
      ? body.customer.trade_vehicle
      : [];

    const leadSource = getOrNull(body.customer?.lead_source);
    const leadSourceId = getOrNull(body.customer?.lead_source_id);
    const leadType = getOrNull(body.customer?.lead_type);

    const ssn = getOrNull(person.ssn);
    const birthDate = getOrNull(person.birth_date);

    // ============= BUILD PROMAX_CUSTOMER OBJECT =============
    const promaxCustomer = {
      id: customer_id,
      dealer_id: dealer_id
    };
    promaxCustomer.primary_tier = 4;
    promaxCustomer.last_primary_tier_event = dexWsTimestamp;
    promaxCustomer.last_customer_update = dexWsTimestamp;


    // Excludes ssn, birth_date (in promax_customer_sensitive) and prev_addr fields (in promax_customer_previous_address)
    addIfHasValue(promaxCustomer, 'regal_external_id', regalId);
    addIfHasValue(promaxCustomer, 'regal_external_uuid', regalUuid);
    const rawFirstName = getOrNull(person.first_name);
    const rawMiddleName = getOrNull(person.middle_name);
    addIfHasValue(promaxCustomer, 'first_name', isPlaceholderName(rawFirstName) ? null : rawFirstName);
    addIfHasValue(promaxCustomer, 'middle_name', isPlaceholderName(rawMiddleName) ? null : rawMiddleName);
    addIfHasValue(promaxCustomer, 'last_name', validLastName);
    addIfHasValue(promaxCustomer, 'last_name_normalized', lastNameNormalized);
    addIfHasValue(promaxCustomer, 'cell_phone', cellPhoneFormatted);
    addIfHasValue(promaxCustomer, 'home_phone', homePhoneFormatted);
    addIfHasValue(promaxCustomer, 'work_phone', workPhoneFormatted);
    addIfHasValue(promaxCustomer, 'work_phone_extension', getOrNull(workPhone?.extension_number));
    addIfHasValue(promaxCustomer, 'primary_email', getOrNull(primaryEmail?.email_address));
    addIfHasValue(promaxCustomer, 'secondary_email', getOrNull(secondaryEmail?.email_address));
    addIfHasValue(promaxCustomer, 'lead_source', leadSource);
    addIfHasValue(promaxCustomer, 'lead_source_id', leadSourceId);
    addIfHasValue(promaxCustomer, 'lead_type', leadType);
    addIfHasValue(promaxCustomer, 'ad_source', getOrNull(body.customer?.ad_source));
    addIfHasValue(promaxCustomer, 'sales_rep_1', getOrNull(salesRep1?.employee_id));
    addIfHasValue(promaxCustomer, 'sales_rep_2', getOrNull(salesRep2?.employee_id));
    addIfHasValue(promaxCustomer, 'sales_bdr', getOrNull(salesBdr?.employee_id));
    addIfHasValue(promaxCustomer, 'service_bdr', getOrNull(serviceBdr?.employee_id));

    addIfHasValue(promaxCustomer, 'curr_addr_street', getOrNull(currentAddress?.line_one));
    addIfHasValue(promaxCustomer, 'curr_addr_street2', getOrNull(currentAddress?.line_two));
    addIfHasValue(promaxCustomer, 'curr_addr_city', getOrNull(currentAddress?.city));
    addIfHasValue(promaxCustomer, 'curr_addr_state', currAddrState);
    addIfHasValue(promaxCustomer, 'curr_addr_zip_code', currAddrZip);
    addIfHasValue(promaxCustomer, 'curr_addr_duration', currAddrDuration);
    addIfHasValue(promaxCustomer, 'curr_addr_start', currAddrStart);
    addIfHasValue(promaxCustomer, 'curr_addr_monthly_payment', getOrNull(currentAddress?.monthly_payment));

    addIfHasValue(promaxCustomer, 'desired_vehicle', desiredVehicle);
    addIfHasValue(promaxCustomer, 'trade_vehicle', tradeVehicle);

    addIfHasValue(promaxCustomer, 'cash_down', getOrNull(body.customer?.cash_down));

    addIfHasValue(promaxCustomer, 'block_text', getOrNull(body.customer?.block_text));
    addIfHasValue(promaxCustomer, 'block_email', getOrNull(body.customer?.block_email));
    addIfHasValue(promaxCustomer, 'block_letters', getOrNull(body.customer?.block_letters));

    // ============= GENERATE FIELD TIMESTAMPS FOR PROMAX_CUSTOMER =============
    const fieldLastReceivedAt = {};
    const fieldLastReceivedBy = {};
    const excludedFieldsForMetadata = ['id', 'field_last_received_at', 'field_last_received_by'];

    for (const [key, value] of Object.entries(promaxCustomer)) {
      if (excludedFieldsForMetadata.includes(key)) continue;

      if (typeof value === 'object' && !Array.isArray(value) && hasValue(value)) {
        const nested = buildNestedMetadata(value, dexWsTimestamp, eventId);
        if (nested && nested.timestamps) {
          fieldLastReceivedAt[key] = nested.timestamps;
          fieldLastReceivedBy[key] = nested.attribution;
        }
      } else if (hasValue(value)) {
        fieldLastReceivedAt[key] = dexWsTimestamp;
        fieldLastReceivedBy[key] = eventId;
      }
    }

    promaxCustomer.field_last_received_at = fieldLastReceivedAt;
    promaxCustomer.field_last_received_by = fieldLastReceivedBy;

    // ============= BUILD PROMAX_CUSTOMER_SENSITIVE (CONDITIONAL) =============
    let promaxCustomerSensitive = null;

    const sensitiveData = {};
    addIfHasValue(sensitiveData, 'ssn', ssn);
    addIfHasValue(sensitiveData, 'birth_date', birthDate);

    if (Object.keys(sensitiveData).length > 0) {
      promaxCustomerSensitive = {
        id: customer_id,
        ...sensitiveData
      };

      const sensitiveLastReceivedAt = {};
      const sensitiveLastReceivedBy = {};

      for (const [key, value] of Object.entries(sensitiveData)) {
        if (hasValue(value)) {
          sensitiveLastReceivedAt[key] = dexWsTimestamp;
          sensitiveLastReceivedBy[key] = eventId;
        }
      }

      promaxCustomerSensitive.field_last_received_at = sensitiveLastReceivedAt;
      promaxCustomerSensitive.field_last_received_by = sensitiveLastReceivedBy;
    }

    // ============= BUILD PROMAX_CUSTOMER_PREVIOUS_ADDRESS (CONDITIONAL) =============
    let promaxCustomerPreviousAddress = null;

    const prevAddrData = {};
    addIfHasValue(prevAddrData, 'prev_addr1_street', getOrNull(prev1Address?.line_one));
    addIfHasValue(prevAddrData, 'prev_addr1_street2', getOrNull(prev1Address?.line_two));
    addIfHasValue(prevAddrData, 'prev_addr1_city', getOrNull(prev1Address?.city));
    addIfHasValue(prevAddrData, 'prev_addr1_state', prev1AddrState);
    addIfHasValue(prevAddrData, 'prev_addr1_zip_code', prev1AddrZip);
    addIfHasValue(prevAddrData, 'prev_addr1_duration', prev1AddrDuration);
    addIfHasValue(prevAddrData, 'prev_addr1_monthly_payment', getOrNull(prev1Address?.monthly_payment));

    addIfHasValue(prevAddrData, 'prev_addr2_street', getOrNull(prev2Address?.line_one));
    addIfHasValue(prevAddrData, 'prev_addr2_street2', getOrNull(prev2Address?.line_two));
    addIfHasValue(prevAddrData, 'prev_addr2_city', getOrNull(prev2Address?.city));
    addIfHasValue(prevAddrData, 'prev_addr2_state', prev2AddrState);
    addIfHasValue(prevAddrData, 'prev_addr2_zip_code', prev2AddrZip);
    addIfHasValue(prevAddrData, 'prev_addr2_duration', prev2AddrDuration);
    addIfHasValue(prevAddrData, 'prev_addr2_monthly_payment', getOrNull(prev2Address?.monthly_payment));

    addIfHasValue(prevAddrData, 'prev_addr3_street', getOrNull(prev3Address?.line_one));
    addIfHasValue(prevAddrData, 'prev_addr3_street2', getOrNull(prev3Address?.line_two));
    addIfHasValue(prevAddrData, 'prev_addr3_city', getOrNull(prev3Address?.city));
    addIfHasValue(prevAddrData, 'prev_addr3_state', prev3AddrState);
    addIfHasValue(prevAddrData, 'prev_addr3_zip_code', prev3AddrZip);
    addIfHasValue(prevAddrData, 'prev_addr3_duration', prev3AddrDuration);
    addIfHasValue(prevAddrData, 'prev_addr3_monthly_payment', getOrNull(prev3Address?.monthly_payment));

    if (Object.keys(prevAddrData).length > 0) {
      promaxCustomerPreviousAddress = {
        id: customer_id,
        ...prevAddrData
      };

      const prevAddrLastReceivedAt = {};
      const prevAddrLastReceivedBy = {};

      for (const [key, value] of Object.entries(prevAddrData)) {
        if (hasValue(value)) {
          prevAddrLastReceivedAt[key] = dexWsTimestamp;
          prevAddrLastReceivedBy[key] = eventId;
        }
      }

      promaxCustomerPreviousAddress.field_last_received_at = prevAddrLastReceivedAt;
      promaxCustomerPreviousAddress.field_last_received_by = prevAddrLastReceivedBy;
    }

    // ============= BUILD PROMAX_CUSTOMER_TRADE_VEHICLE (CONDITIONAL) =============
    let promaxCustomerTradeVehicle = null;

    const tradeVehicleData = {};
    tradeVehicle.forEach(vehicle => {
      const tradeNum = getOrNull(vehicle.trade_vehicle);

      if (tradeNum === 1) {
        addIfHasValue(tradeVehicleData, 'trade_1_year', getOrNull(vehicle.model_year));
        addIfHasValue(tradeVehicleData, 'trade_1_make', getOrNull(vehicle.make));
        addIfHasValue(tradeVehicleData, 'trade_1_model', getOrNull(vehicle.model_name));
        addIfHasValue(tradeVehicleData, 'trade_1_style', getOrNull(vehicle.style));
        addIfHasValue(tradeVehicleData, 'trade_1_vin', getOrNull(vehicle.vin));
        addIfHasValue(tradeVehicleData, 'trade_1_mileage', getOrNull(vehicle.mileage));
        addIfHasValue(tradeVehicleData, 'trade_1_acv', getOrNull(vehicle.acv));
        addIfHasValue(tradeVehicleData, 'trade_1_allowance', getOrNull(vehicle.allowance));
        addIfHasValue(tradeVehicleData, 'trade_1_exterior_color', getOrNull(vehicle.exterior_color));
        addIfHasValue(tradeVehicleData, 'trade_1_interior_color', getOrNull(vehicle.interior_color));
        addIfHasValue(tradeVehicleData, 'trade_1_payment', getOrNull(vehicle.payment));
        addIfHasValue(tradeVehicleData, 'trade_1_payoff', getOrNull(vehicle.payoff));

        if (Array.isArray(vehicle.lienholder_info) && vehicle.lienholder_info.length > 0) {
          const lienholderName = getOrNull(vehicle.lienholder_info[0]?.lienholder_name);
          addIfHasValue(tradeVehicleData, 'trade_1_lienholder_name', lienholderName);
        }

      } else if (tradeNum === 2) {
        addIfHasValue(tradeVehicleData, 'trade_2_year', getOrNull(vehicle.model_year));
        addIfHasValue(tradeVehicleData, 'trade_2_make', getOrNull(vehicle.make));
        addIfHasValue(tradeVehicleData, 'trade_2_model', getOrNull(vehicle.model_name));
        addIfHasValue(tradeVehicleData, 'trade_2_style', getOrNull(vehicle.style));
        addIfHasValue(tradeVehicleData, 'trade_2_vin', getOrNull(vehicle.vin));
        addIfHasValue(tradeVehicleData, 'trade_2_mileage', getOrNull(vehicle.mileage));
        addIfHasValue(tradeVehicleData, 'trade_2_acv', getOrNull(vehicle.acv));
        addIfHasValue(tradeVehicleData, 'trade_2_allowance', getOrNull(vehicle.allowance));
        addIfHasValue(tradeVehicleData, 'trade_2_exterior_color', getOrNull(vehicle.exterior_color));
        addIfHasValue(tradeVehicleData, 'trade_2_interior_color', getOrNull(vehicle.interior_color));
        addIfHasValue(tradeVehicleData, 'trade_2_payment', getOrNull(vehicle.payment));
        addIfHasValue(tradeVehicleData, 'trade_2_payoff', getOrNull(vehicle.payoff));

        if (Array.isArray(vehicle.lienholder_info) && vehicle.lienholder_info.length > 0) {
          const lienholderName = getOrNull(vehicle.lienholder_info[0]?.lienholder_name);
          addIfHasValue(tradeVehicleData, 'trade_2_lienholder_name', lienholderName);
        }
      }
    });

    if (Object.keys(tradeVehicleData).length > 0) {
      promaxCustomerTradeVehicle = {
        id: customer_id,
        ...tradeVehicleData
      };

      const tradeVehicleLastReceivedAt = {};
      const tradeVehicleLastReceivedBy = {};

      for (const [key, value] of Object.entries(tradeVehicleData)) {
        if (hasValue(value)) {
          tradeVehicleLastReceivedAt[key] = dexWsTimestamp;
          tradeVehicleLastReceivedBy[key] = eventId;
        }
      }

      promaxCustomerTradeVehicle.field_last_received_at = tradeVehicleLastReceivedAt;
      promaxCustomerTradeVehicle.field_last_received_by = tradeVehicleLastReceivedBy;
    }

    // ============= BUILD REGAL_CONTACT (CONDITIONAL) =============
    let regalContact = null;
    if (regalId && regalUuid && lastNameNormalized && cellPhoneFormatted) {
      regalContact = {
        id: regalUuid,
        external_id: regalId,
        last_name_normalized: lastNameNormalized,
        phone: cellPhoneFormatted
      };
    }

    // ============= BUILD PROMAX_LEAD_SOURCE (CONDITIONAL) =============
    let promaxLeadSource = null;
    if (dealer_id && leadSourceId && leadSource) {
      promaxLeadSource = {
        id: leadSourceId,
        dealer_id: dealer_id,
        name: leadSource
      };
      addIfHasValue(promaxLeadSource, 'type', leadType);
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
      dealer_id: dealer_id
    };

    if (regalContact) {
      finalPayload.regal_contact = regalContact;
    }

    finalPayload.promax_customer = promaxCustomer;

    if (promaxCustomerSensitive) {
      finalPayload.promax_customer_sensitive = promaxCustomerSensitive;
    }

    if (promaxCustomerPreviousAddress) {
      finalPayload.promax_customer_previous_address = promaxCustomerPreviousAddress;
    }

    if (promaxCustomerTradeVehicle) {
      finalPayload.promax_customer_trade_vehicle = promaxCustomerTradeVehicle;
    }

    if (promaxLeadSource) {
      finalPayload.promax_lead_source = promaxLeadSource;
    }

    finalPayload.original_payload = body;

    // ============= LOGGING & METRICS =============

    const logMeta = {
      event_id: eventId,
      customer_id: customer_id,
      dealer_id: dealer_id,
      namespace: NAMESPACE,
      event_version: SCHEMA_VERSION,
      has_regal_contact: !!regalContact,
      has_sensitive_data: !!promaxCustomerSensitive,
      has_previous_address: !!promaxCustomerPreviousAddress,
      has_lead_source: !!promaxLeadSource,
      has_trade_vehicle: !!promaxCustomerTradeVehicle,
      has_ssn: !!ssn,
      ssn_obfuscated: obfuscateSSN(ssn),
      address_count: addresses.length,
      communication_count: communications.length,
      field_count: Object.keys(fieldLastReceivedAt).length
    };
    console.log(`Customer event processed in ${Date.now() - start}ms`, logMeta);

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

