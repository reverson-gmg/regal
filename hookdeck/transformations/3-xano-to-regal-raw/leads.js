// ============================================
// HOOKDECK LEAD → REGAL TRANSFORMATION SCRIPT v1.0
// ============================================
// Transforms Xano lead output (stage 3) into Regal event format (stage 4).
//
// Handles all website lead form types from the Feathery → Xano pipeline:
//
//   book_appointment                  → Schedule Appointment
//   get_approved_complete             → Get Approved: Complete
//   get_approved_incomplete           → Get Approved: Incomplete
//   inventory_browsing_squeeze        → Inventory Browsing Access
//   vehicle_ask_question              → Vehicle Ask Question
//   vehicle_book_appointment          → Vehicle Schedule Appointment
//   vehicle_check_availability        → Vehicle Check Availability
//   vehicle_explore_payments          → Vehicle Explore Payments
//   vehicle_get_approved_complete     → Vehicle Get Approved: Complete
//   vehicle_get_approved_incomplete   → Vehicle Get Approved: Incomplete
//   vehicle_request_info              → Vehicle Request Info
//   vehicle_text_us                   → Vehicle Text Us
//
// Features:
//   ✅ Detects lead type from lead.type field and maps to human-readable display name
//   ✅ US timezone-aware date formatting with DST support (eastern, central, mountain, pacific, alaska, hawaii)
//   ✅ Converts UTC submitted_at to dealer-local ISO 8601 with correct UTC offset
//   ✅ Human-readable display timestamps localized to dealer timezone
//   ✅ Dealer object mapping with computed website URL and area_code extraction
//   ✅ Hours display string computed from structured hours data (Mon–Sun order)
//   ✅ Phone number formatting: E.164 (+1XXXXXXXXXX) for traits, (XXX) XXX-XXXX for display
//   ✅ Phone label derived from phone_verification.line_type with capitalization
//   ✅ Email verification: sendex → score field rename, verified_at → local timezone "at"
//   ✅ Activity traits with type-specific lead entry and "last" sub-object
//   ✅ Appointment types: appt_date/appt_time in activity, appointment in traits, date_display in submission
//   ✅ Credit/finance types: preferences, credit_profile, housing, employment, address promoted to traits
//   ✅ Vehicle types: vehicle metadata mapped with location from vehicle_dealer.marketing_name
//   ✅ Submission output: input fields minus score/lead_summary, plus at/at_display
//   ✅ Form metadata URL cleaning: strip query strings, fragments, and tracking parameters
//   ✅ Custom object fields: lead_id, lead_name, received_display, dealer, summary, message, details
//   ✅ Emoji-formatted details string varies by lead type category
//   ✅ Sparse field mapping: optional fields only included when present in source data
//   ✅ Defensive null/type checks throughout — no uncaught exceptions
//   ✅ Explicit $transform.fail() for missing required data
// ============================================

// ============= CONFIGURATION =============

var SCHEMA_VERSION = '1.0';
var EVENT_SOURCE = 'Website';
var EVENT_NAME = 'lead.website';
var DEALER_WEBSITE_BASE = 'https://www.rightway.com/d/';

// ============= EVENT TYPE DISPLAY NAMES =============

var EVENT_TYPE_NAMES = {
  book_appointment: 'Schedule Appointment',
  get_approved_complete: 'Get Approved: Complete',
  get_approved_incomplete: 'Get Approved: Incomplete',
  inventory_browsing_squeeze: 'Inventory Browsing Access',
  vehicle_ask_question: 'Vehicle Ask Question',
  vehicle_book_appointment: 'Vehicle Schedule Appointment',
  vehicle_check_availability: 'Vehicle Check Availability',
  vehicle_explore_payments: 'Vehicle Explore Payments',
  vehicle_get_approved_complete: 'Vehicle Get Approved: Complete',
  vehicle_get_approved_incomplete: 'Vehicle Get Approved: Incomplete',
  vehicle_request_info: 'Vehicle Request Info',
  vehicle_text_us: 'Vehicle Text Us'
};

// ============= TIMEZONE UTILITIES =============

var TZ_STANDARD_OFFSETS = {
  eastern: -5, central: -6, mountain: -7, pacific: -8, alaska: -9, hawaii: -10
};

var TZ_DST_OFFSETS = {
  eastern: -4, central: -5, mountain: -6, pacific: -7, alaska: -8, hawaii: -10
};

function getNthDayOfMonth(year, month, dayOfWeek, n) {
  var first = new Date(Date.UTC(year, month, 1));
  var firstDow = first.getUTCDay();
  return 1 + ((dayOfWeek - firstDow + 7) % 7) + (n - 1) * 7;
}

function isDST(utcMs, tz) {
  if (tz === 'hawaii') return false;
  var d = new Date(utcMs);
  var year = d.getUTCFullYear();
  var marchSunday = getNthDayOfMonth(year, 2, 0, 2);
  var standardOffset = TZ_STANDARD_OFFSETS[tz] || 0;
  var dstStartUtc = Date.UTC(year, 2, marchSunday, 2 - standardOffset, 0, 0);
  var novSunday = getNthDayOfMonth(year, 10, 0, 1);
  var dstOffset = TZ_DST_OFFSETS[tz] || 0;
  var dstEndUtc = Date.UTC(year, 10, novSunday, 2 - dstOffset, 0, 0);
  return utcMs >= dstStartUtc && utcMs < dstEndUtc;
}

function getTimezoneOffset(utcMs, tzName) {
  var tz = (tzName || '').toLowerCase();
  return isDST(utcMs, tz) ? (TZ_DST_OFFSETS[tz] || 0) : (TZ_STANDARD_OFFSETS[tz] || 0);
}

function toLocalDate(epochMs, tzName) {
  var offset = getTimezoneOffset(epochMs, tzName);
  return new Date(epochMs + offset * 3600000);
}

// ============= DATE FORMATTING =============

var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad2(n) { return n < 10 ? '0' + n : String(n); }

/**
 * Converts epoch-ms to local ISO 8601 with UTC offset: "2026-02-08T15:12:56-05:00"
 */
function toLocalIso(epochMs, tzName) {
  if (!epochMs) return null;
  var d = toLocalDate(epochMs, tzName);
  if (isNaN(d.getTime())) return null;
  var offset = getTimezoneOffset(epochMs, tzName);
  var sign = offset <= 0 ? '-' : '+';
  var absOffset = Math.abs(offset);
  var offsetHours = Math.floor(absOffset);
  var offsetMins = Math.round((absOffset - offsetHours) * 60);
  return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()) +
    'T' + pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ':' + pad2(d.getUTCSeconds()) +
    sign + pad2(offsetHours) + ':' + pad2(offsetMins);
}

/**
 * Formats epoch-ms as dealer-local display: "Sun, Feb 8, 2026 - 3:12 PM"
 */
function formatDisplayDateTime(epochMs, tzName) {
  if (!epochMs) return null;
  var d = toLocalDate(epochMs, tzName);
  var hours = d.getUTCHours();
  var minutes = d.getUTCMinutes();
  var ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  var timeStr = hours + ':' + pad2(minutes) + ' ' + ampm;
  return DAYS[d.getUTCDay()] + ', ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() +
    ', ' + d.getUTCFullYear() + ' - ' + timeStr;
}

/**
 * Formats epoch-ms as short date: "2/8/26" (M/D/YY in dealer local time)
 */
function formatShortDate(epochMs, tzName) {
  var d = toLocalDate(epochMs, tzName);
  return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + '/' + String(d.getUTCFullYear()).slice(2);
}

/**
 * Formats a YYYY-MM-DD date string as "Fri, Feb 20, 2026"
 */
function formatDateString(dateStr) {
  if (!dateStr) return null;
  var parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  var d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
  if (isNaN(d.getTime())) return null;
  return DAYS[d.getUTCDay()] + ', ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() +
    ', ' + d.getUTCFullYear();
}

// ============= TIMESTAMP PARSING =============

/**
 * Parses "2026-02-08 20:12:56+00:00" or "2026-02-08T20:12:56.573Z" to epoch-ms.
 * Returns null for invalid/empty input.
 */
function parseTimestamp(ts) {
  if (!ts || typeof ts !== 'string') return null;
  var normalized = ts.trim().replace(' ', 'T');
  var d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d.getTime();
}

// ============= PHONE FORMATTING =============

/**
 * Formats 10-digit phone as (XXX) XXX-XXXX for display.
 */
function formatPhoneDisplay(phone) {
  if (!phone) return null;
  var digits = String(phone).replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '1') digits = digits.slice(1);
  if (digits.length !== 10) return null;
  return '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6);
}

/**
 * Formats phone as E.164: +1XXXXXXXXXX
 */
function formatPhoneE164(phone) {
  if (!phone) return null;
  var digits = String(phone).replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '1') digits = digits.slice(1);
  if (digits.length !== 10) return null;
  return '+1' + digits;
}

/**
 * Extracts the 3-digit area code from a phone number.
 */
function extractAreaCode(phoneStr) {
  if (!phoneStr) return null;
  var digits = String(phoneStr).replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '1') digits = digits.slice(1);
  return digits.length >= 10 ? digits.slice(0, 3) : null;
}

// ============= TEXT NORMALIZATION =============

/**
 * Normalizes Unicode curly quotes/apostrophes to ASCII equivalents.
 * U+2018/U+2019 (single curly) → ' (U+0027)
 * U+201C/U+201D (double curly) → " (U+0022)
 */
function normalizeQuotes(str) {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

// ============= URL CLEANING =============

/**
 * Strips query strings and fragments from a URL, preserving the path.
 * "https://example.com/path/?q=1#hash" → "https://example.com/path/"
 */
function cleanFormUrl(url) {
  if (!url || typeof url !== 'string') return url;
  var qIdx = url.indexOf('?');
  var hIdx = url.indexOf('#');
  var cutAt = -1;
  if (qIdx !== -1 && hIdx !== -1) cutAt = Math.min(qIdx, hIdx);
  else if (qIdx !== -1) cutAt = qIdx;
  else if (hIdx !== -1) cutAt = hIdx;
  return cutAt === -1 ? url : url.slice(0, cutAt);
}

// ============= HOURS DISPLAY =============

var DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
var DAY_ABBREV = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };

/**
 * Builds the hours display string and reorders hours to Mon-Sun.
 * Returns { display: "Mon: 9am - 7pm\n...", monday: {...}, ... }
 */
function buildHoursObject(rawHours) {
  if (!rawHours || typeof rawHours !== 'object') return rawHours;
  var lines = [];
  var result = {};

  for (var i = 0; i < DAY_ORDER.length; i++) {
    var day = DAY_ORDER[i];
    var dayData = rawHours[day];
    if (!dayData) continue;
    var label = DAY_ABBREV[day];
    lines.push(label + ': ' + (dayData.is_open ? dayData.display : 'Closed'));
  }
  result.display = lines.join('\n');

  for (var j = 0; j < DAY_ORDER.length; j++) {
    var dayKey = DAY_ORDER[j];
    if (rawHours[dayKey]) result[dayKey] = rawHours[dayKey];
  }
  return result;
}

// ============= DEALER OBJECT BUILDER =============

/**
 * Maps Xano dealer record to Regal dealer format.
 */
function buildDealerObject(dealer, opts) {
  if (!dealer) return null;
  var areaCode = extractAreaCode(dealer.phone_number_main);
  var tz = dealer.time_zone || '';
  var obj = {
    id: dealer.id,
    address: dealer.address || '',
    address_2: dealer.address_2 || '',
    city: dealer.city || '',
    state: dealer.state || '',
    st: dealer.st || '',
    region_name: dealer.region_name || '',
    zip_code: dealer.zip_code || '',
    time_zone: tz.charAt(0).toUpperCase() + tz.slice(1),
    slug: dealer.slug || '',
  };
  // crm_email is included in traits.dealer but excluded from properties.dealer
  if (!opts || !opts.excludeCrmEmail) {
    obj.crm_email = dealer.crm_email || '';
  }
  obj.name = dealer.marketing_name || '';
  obj.name_no_st = dealer.marketing_name_no_st || '';
  obj.phone = dealer.phone_number_main || '';
  obj.internal_name = dealer.gmg_nickname || '';
  obj.website = dealer.slug ? DEALER_WEBSITE_BASE + dealer.slug + '/' : '';
  if (areaCode) obj.area_code = areaCode;
  if (dealer.hours) obj.hours = buildHoursObject(dealer.hours);
  return obj;
}

// ============= VERIFICATION BUILDER =============

/**
 * Builds traits.verification from phone_verification and email_verification.
 * Converts verified_at to dealer-local ISO, renames sendex → score.
 */
function buildVerification(lead, tzName) {
  var result = {};
  var pv = lead.phone_verification;
  if (pv) {
    var phoneObj = {
      line_type: pv.line_type,
      carrier_name: pv.carrier_name,
      valid_number: pv.valid_number
    };
    if (pv.verified_at) {
      var pvMs = parseTimestamp(pv.verified_at);
      if (pvMs) phoneObj.at = toLocalIso(pvMs, tzName);
    }
    result.phone = phoneObj;
  }
  var ev = lead.email_verification;
  if (ev) {
    var emailObj = {
      free: ev.free,
      role: ev.role,
      reason: ev.reason,
      result: ev.result,
      score: ev.sendex,
      accept_all: ev.accept_all,
      disposable: ev.disposable
    };
    if (ev.verified_at) {
      var evMs = parseTimestamp(ev.verified_at);
      if (evMs) emailObj.at = toLocalIso(evMs, tzName);
    }
    result.email = emailObj;
  }
  return result;
}

// ============= ACTIVITY BUILDER =============

/**
 * Builds traits.activity with lead-type-specific entry and "last" sub-object.
 */
function buildActivity(lead, originalTimestamp, dealerName) {
  var type = lead.type;
  var submission = lead.submission || {};
  var score = (submission.score != null) ? submission.score : 0;

  var entry = {
    at: originalTimestamp,
    dealer_id: String(lead.dealer_id),
    dealer: dealerName,
    score: score
  };

  // Appointment types include appt_date and appt_time
  var appt = submission.appointment;
  if (appt) {
    if (appt.date) entry.appt_date = appt.date;
    if (appt.time) entry.appt_time = appt.time;
  }

  var last = {};
  var entryKeys = Object.keys(entry);
  for (var i = 0; i < entryKeys.length; i++) {
    last[entryKeys[i]] = entry[entryKeys[i]];
  }
  last.type = type;

  var leads = {};
  leads[type] = entry;
  leads.last = last;

  return {
    at: originalTimestamp,
    leads: leads
  };
}

// ============= SUBMISSION BUILDER =============

// Fields to exclude from the output submission
var SUBMISSION_EXCLUDE = { score: true, lead_summary: true };

/**
 * Determines if a lead type is a "get_approved" variant.
 */
function isGetApprovedType(type) {
  return type === 'get_approved_complete' || type === 'get_approved_incomplete' ||
    type === 'vehicle_get_approved_complete' || type === 'vehicle_get_approved_incomplete';
}

/**
 * Builds properties.submission from input submission, adding at/at_display,
 * stripping score/lead_summary, and enriching appointment with date_display.
 */
function buildSubmission(inputSubmission, originalTimestamp, displayTimestamp, leadType) {
  var result = { at: originalTimestamp, at_display: displayTimestamp };
  if (!inputSubmission) return result;

  var keys = Object.keys(inputSubmission);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (SUBMISSION_EXCLUDE[key]) continue;
    // Strip address for non-get_approved types
    if (key === 'address' && !isGetApprovedType(leadType)) continue;
    if (key === 'appointment') {
      var appt = inputSubmission.appointment;
      var apptOut = {};
      if (appt.date) apptOut.date = appt.date;
      if (appt.time) apptOut.time = appt.time;
      apptOut.date_display = formatDateString(appt.date);
      result.appointment = apptOut;
    } else if (key === 'message') {
      result[key] = normalizeQuotes(inputSubmission[key]);
    } else {
      result[key] = inputSubmission[key];
    }
  }
  return result;
}

// ============= VEHICLE BUILDER =============

/**
 * Builds properties.vehicle from lead.vehicle_metadata and vehicle_dealer.
 */
function buildVehicle(lead, vehicleDealer) {
  var vm = lead.vehicle_metadata;
  if (!vm) return null;
  var vehicle = {
    vin: lead.vehicle_vin || '',
    year: vm.year || '',
    make: vm.make || '',
    model: vm.model || '',
    trim: vm.trim || '',
    body_style: vm.body_style || '',
    mileage: vm.mileage || '',
    stock: vm.stock || '',
    age: vm.age || '',
    dealer_id: String(vm.dealer_id || ''),
    location: (vehicleDealer && vehicleDealer.marketing_name) ? vehicleDealer.marketing_name : '',
    location_type: vm.location_type || ''
  };
  return vehicle;
}

// ============= FORM METADATA BUILDER =============

/**
 * Builds properties.form_metadata with cleaned URL.
 */
function buildFormMetadata(rawMeta) {
  if (!rawMeta) return null;
  var result = {
    id: rawMeta.id,
    url: cleanFormUrl(rawMeta.url),
    name: rawMeta.name,
    embed_type: rawMeta.embed_type
  };
  if (rawMeta.referral_url) result.referral_url = rawMeta.referral_url;
  return result;
}

// ============= DETAILS STRING BUILDER =============

/**
 * Builds the emoji-formatted custom_object_lead_details string.
 * Content varies by lead type category:
 *   - Vehicle info types: vehicle line + body style + color + location + stock + VIN + age + URL
 *   - Appointment types: appointment date/time (plus vehicle details if vehicle type)
 *   - Credit/finance types: stage + timeframe + credit + down payment + payment + income + employment + etc.
 *   - Non-vehicle get_approved: body_style as vehicle line
 */
function buildDetails(lead, vehicleDealer, cleanedFormUrl) {
  var lines = [];
  var type = lead.type;
  var sub = lead.submission || {};
  var vm = lead.vehicle_metadata;
  var prefs = sub.preferences || {};
  var credit = sub.credit_profile || {};
  var emp = sub.employment || {};
  var housing = sub.housing || {};
  var address = sub.address || {};
  var hasVehicle = !!vm;
  var isAppt = (type === 'book_appointment' || type === 'vehicle_book_appointment');
  var isCredit = (type.indexOf('get_approved') !== -1 || type === 'vehicle_explore_payments');
  var isComplete = (type === 'get_approved_complete' || type === 'vehicle_get_approved_complete');
  var isIncomplete = (type === 'get_approved_incomplete' || type === 'vehicle_get_approved_incomplete');
  var isExplorePayments = (type === 'vehicle_explore_payments');

  // Vehicle name line
  if (hasVehicle) {
    lines.push('\uD83D\uDE97 Vehicle: ' + (vm.year || '') + ' ' + (vm.make || '') + ' ' + (vm.model || ''));
  } else if (prefs.body_style) {
    lines.push('\uD83D\uDE97 Vehicle: ' + prefs.body_style);
  }

  // Appointment lines
  if (isAppt && sub.appointment) {
    lines.push('\uD83D\uDCC5 Appt: ' + formatDateString(sub.appointment.date));
    if (sub.appointment.time) lines.push('\uD83D\uDD52 Time: ' + sub.appointment.time);
  }

  // Credit/finance lines
  if (isCredit) {
    if (isIncomplete) {
      // Incomplete types: minimal details — Stage, Credit, Trade-In only
      lines.push('\uD83C\uDFAF Stage: ' + (prefs.shopping_stage || ''));
      lines.push('\uD83D\uDCB3 Credit: ' + (credit.credit_estimate || ''));
      if (prefs.trade_in != null) lines.push('\uD83D\uDD04 Trade-In: ' + prefs.trade_in);
    } else {
      // Complete and explore_payments: full details
      lines.push('\uD83C\uDFAF Stage: ' + (prefs.shopping_stage || ''));
      if (prefs.purchase_timeframe != null || isExplorePayments) {
        lines.push('\u23F1\uFE0F Timeframe: ' + (prefs.purchase_timeframe || ''));
      }
      lines.push('\uD83D\uDCB3 Credit: ' + (credit.credit_estimate || ''));
      if (prefs.preferred_down_payment != null) {
        lines.push('\uD83D\uDCB0 Down Payment: ' + prefs.preferred_down_payment);
      }
      if (prefs.payment_range != null) {
        lines.push('\uD83D\uDCB8 Payment: ' + prefs.payment_range);
      }
      if (emp.income_monthly != null) {
        lines.push('\uD83E\uDDFE Monthly Income: $' + emp.income_monthly);
      }

      // Employment details vary by completeness
      if (isComplete) {
        if (emp.status) lines.push('\uD83D\uDC77 Job Type: ' + emp.status);
        if (emp.title != null) lines.push('\uD83D\uDCBC Job Title: ' + emp.title);
        if (emp.duration) lines.push('\uD83D\uDCC5 Job Time: ' + emp.duration);
        if (emp.employer != null) lines.push('\uD83C\uDFE2 Employer: ' + emp.employer);
      } else if (isExplorePayments && emp.status) {
        lines.push('\uD83D\uDC77 Employment: ' + emp.status);
      }

      // Housing (complete types only)
      if (isComplete && housing.status) {
        lines.push('\uD83C\uDFE0 Home Type: ' + housing.status);
        if (housing.residence_duration) lines.push('\uD83D\uDCCD Residency: ' + housing.residence_duration);
      }

      // Address (complete types only)
      if (isComplete && address.street) {
        var addrParts = [address.street];
        if (address.city) addrParts.push(address.city);
        if (address.state) addrParts.push(address.state + ' ' + (address.zip_code || ''));
        else if (address.zip_code) addrParts.push(address.zip_code);
        lines.push('\uD83D\uDCEB Address: ' + addrParts.join(', '));
      }

      // Trade-in, repo, bankruptcy
      if (prefs.trade_in != null) lines.push('\uD83D\uDD04 Trade-In: ' + prefs.trade_in);
      if (credit.repossession != null) lines.push('\uD83D\uDCC9 Repo: ' + credit.repossession);
      if (credit.bankruptcy != null) lines.push('\u2696\uFE0F Bankruptcy: ' + credit.bankruptcy);
    }
  }

  // Vehicle detail lines (for vehicle types)
  if (hasVehicle && !isCredit) {
    // Simple vehicle info types and appointment vehicle types
    lines.push('\uD83D\uDE98 Body Style: ' + (vm.body_style || ''));
    lines.push('\uD83C\uDFA8 Color: ');
    lines.push('\uD83D\uDCCD Location: ' + ((vehicleDealer && vehicleDealer.marketing_name) || ''));
    lines.push('\uD83C\uDD94 Stock #: ' + (vm.stock || ''));
    lines.push('\uD83D\uDD11 VIN: ' + (lead.vehicle_vin || ''));
    lines.push('\uD83D\uDCC5 Age: ' + (vm.age || '') + ' days');
    lines.push('\uD83D\uDD17 URL: ' + (cleanedFormUrl || ''));
  } else if (hasVehicle && isCredit) {
    // Credit types with vehicle: stock/VIN/location at the end
    lines.push('\uD83C\uDD94 Stock #: ' + (vm.stock || ''));
    lines.push('\uD83D\uDD11 VIN: ' + (lead.vehicle_vin || ''));
    lines.push('\uD83D\uDCCD Location: ' + ((vehicleDealer && vehicleDealer.marketing_name) || ''));
    lines.push('\uD83D\uDCC5 Age: ' + (vm.age || '') + ' days');
    lines.push('\uD83D\uDD17 URL: ' + (cleanedFormUrl || ''));
  }

  return lines.join('\n');
}

// ============= TRAITS BUILDER =============

// Fields from submission that can be promoted to top-level traits for get_approved types
var GET_APPROVED_TRAIT_FIELDS = ['address', 'dealer_proximity', 'preferences', 'credit_profile', 'housing', 'employment', 'date_of_birth'];
// Fields for explore_payments traits
var EXPLORE_TRAIT_FIELDS = ['preferences', 'credit_profile', 'employment'];

/**
 * Builds the traits object with conditional field promotion based on lead type.
 */
function buildTraits(lead, dealer, originalTimestamp, tzName) {
  var type = lead.type;
  var sub = lead.submission || {};
  var dealerObj = buildDealerObject(dealer);

  var traits = {
    firstName: lead.first_name || '',
    lastName: lead.last_name || ''
  };

  // Phones
  var e164 = formatPhoneE164(lead.phone_number);
  if (e164) {
    var pv = lead.phone_verification || {};
    var lineType = pv.line_type || 'mobile';
    var phoneLabel = lineType.charAt(0).toUpperCase() + lineType.slice(1);
    var phones = {};
    phones[e164] = { label: phoneLabel, isPrimary: true };
    traits.phones = phones;
  }

  // Emails
  if (lead.email_address) {
    var emails = {};
    emails[lead.email_address] = { label: 'Personal', isPrimary: true };
    traits.emails = emails;
  }

  // Dealer
  if (dealerObj) traits.dealer = dealerObj;

  // Verification
  var verification = buildVerification(lead, tzName);
  if (Object.keys(verification).length > 0) traits.verification = verification;

  // Activity
  var dealerName = dealer.marketing_name || '';
  traits.activity = buildActivity(lead, originalTimestamp, dealerName);

  // Appointment trait (for appointment types)
  var appt = sub.appointment;
  if (appt) {
    var apptTrait = {};
    if (appt.date) apptTrait.date = appt.date;
    if (appt.time) apptTrait.time = appt.time;
    traits.appointment = apptTrait;
  }

  // Promote fields from submission to traits based on lead type
  if (isGetApprovedType(type)) {
    for (var i = 0; i < GET_APPROVED_TRAIT_FIELDS.length; i++) {
      var field = GET_APPROVED_TRAIT_FIELDS[i];
      if (sub[field] != null) {
        // For address: exclude street_line2 from traits (only include core fields)
        if (field === 'address') {
          var srcAddr = sub.address;
          var traitAddr = {};
          if (srcAddr.street) traitAddr.street = srcAddr.street;
          if (srcAddr.city) traitAddr.city = srcAddr.city;
          if (srcAddr.state) traitAddr.state = srcAddr.state;
          if (srcAddr.zip_code) traitAddr.zip_code = srcAddr.zip_code;
          traits.address = traitAddr;
        } else if (field === 'dealer_proximity') {
          // Only include dealer_proximity when address has a street (full address)
          if (sub.address && sub.address.street) {
            traits.dealer_proximity = sub[field];
          }
        } else {
          traits[field] = sub[field];
        }
      }
    }
  } else if (type === 'vehicle_explore_payments') {
    for (var k = 0; k < EXPLORE_TRAIT_FIELDS.length; k++) {
      var ef = EXPLORE_TRAIT_FIELDS[k];
      if (sub[ef] != null) traits[ef] = sub[ef];
    }
  }

  return traits;
}

// ============= MAIN HANDLER =============

addHandler('transform', function(request, context) {
  var startTime = Date.now();

  try {
    var body = request.body;

    // ============= INPUT VALIDATION =============
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      $transform.fail('Invalid payload: body must be an object');
    }

    var lead = body.lead;
    var dealer = body.dealer;

    if (!lead) $transform.fail('Invalid payload: missing lead');
    if (!dealer) $transform.fail('Invalid payload: missing dealer');
    if (!lead.type) $transform.fail('Invalid payload: lead missing type');
    if (!lead.regal_external_id) $transform.fail('Invalid payload: lead missing regal_external_id');

    var type = lead.type;
    var eventTypeName = EVENT_TYPE_NAMES[type];
    if (!eventTypeName) {
      $transform.fail('Invalid payload: unrecognized lead type "' + type + '"');
    }

    // ============= TIMESTAMPS =============
    var submittedMs = parseTimestamp(lead.submitted_at);
    if (!submittedMs) {
      $transform.fail('Invalid payload: lead missing or invalid submitted_at');
    }

    var tzName = (dealer.time_zone || 'eastern').toLowerCase();
    var originalTimestamp = toLocalIso(submittedMs, tzName);
    var displayTimestamp = formatDisplayDateTime(submittedMs, tzName);

    // "Received" timestamps use current processing time
    var nowMs = Date.now();
    var receivedDisplay = formatDisplayDateTime(nowMs, tzName);
    var receivedShortDate = formatShortDate(nowMs, tzName);

    // ============= BUILD OUTPUT =============
    var submission = lead.submission || {};
    var vehicleDealer = (body.vehicle_dealer && typeof body.vehicle_dealer === 'object') ? body.vehicle_dealer : null;
    var dealerName = dealer.marketing_name || '';
    var dealerObj = buildDealerObject(dealer, { excludeCrmEmail: true });

    // Traits
    var traits = buildTraits(lead, dealer, originalTimestamp, tzName);

    // Properties
    var properties = {};
    properties.event_type = type;
    properties.event_type_name = eventTypeName;

    // Score (from submission, only when present)
    if (submission.score != null) {
      properties.score = submission.score;
    }

    properties.first_name = lead.first_name || '';
    properties.last_name = lead.last_name || '';
    properties.phone = formatPhoneDisplay(lead.phone_number);

    if (lead.email_address) {
      properties.email = lead.email_address;
    }

    // Summary (excluded from properties for vehicle_text_us)
    if (submission.lead_summary && type !== 'vehicle_text_us') {
      properties.summary = normalizeQuotes(submission.lead_summary);
    }

    // Submission
    properties.submission = buildSubmission(submission, originalTimestamp, displayTimestamp, type);

    // Vehicle (for types with vehicle_metadata)
    var vehicle = buildVehicle(lead, vehicleDealer);
    if (vehicle) {
      properties.vehicle = vehicle;
    }

    // Dealer in properties
    properties.dealer = dealerObj;

    // Form metadata
    var formMeta = buildFormMetadata(lead.form_metadata);
    if (formMeta) {
      properties.form_metadata = formMeta;
    }

    // Custom object fields
    properties.custom_object_lead_id = lead.id;
    properties.custom_object_lead_name = 'Web - ' + eventTypeName + ' (' + receivedShortDate + ')';
    properties.custom_object_lead_received_display = receivedDisplay;
    properties.custom_object_lead_dealer = dealerName;

    if (submission.lead_summary) {
      properties.custom_object_lead_summary = normalizeQuotes(submission.lead_summary);
    }

    // Message (for types that have a user-submitted message)
    if (submission.message) {
      properties.custom_object_lead_message = normalizeQuotes(submission.message);
    }

    // Details
    var cleanedUrl = formMeta ? formMeta.url : '';
    properties.custom_object_lead_details = buildDetails(lead, vehicleDealer, cleanedUrl);

    // ============= FINAL OUTPUT =============
    var output = {
      userId: lead.regal_external_id,
      name: EVENT_NAME,
      eventSource: EVENT_SOURCE,
      originalTimestamp: originalTimestamp,
      traits: traits,
      properties: properties
    };

    // ============= LOGGING =============
    console.log(
      'Lead → Regal transformation processed in ' + (Date.now() - startTime) + 'ms',
      {
        lead_type: type,
        event_type_name: eventTypeName,
        lead_id: lead.id,
        dealer_id: dealer.id,
        regal_external_id: lead.regal_external_id,
        schema_version: SCHEMA_VERSION
      }
    );

    request.body = output;
    return request;

  } catch (error) {
    console.error('Lead transformation error:', {
      error: error.message,
      schema_version: SCHEMA_VERSION
    });
    throw error;
  }
});

// ============================================
// END LEAD → REGAL TRANSFORMATION v1.0
// ============================================
