// ============================================
// HOOKDECK SHOWROOM VISIT → REGAL TRANSFORMATION SCRIPT v1.0
// ============================================
// Transforms Xano showroom visit output (stage 3) into Regal event format (stage 4).
//
// Features:
//   ✅ Handles new_visit and exit_note event types
//   ✅ US timezone-aware date formatting with DST support (eastern, central, mountain, pacific, alaska, hawaii)
//   ✅ Visit type PascalCase → snake_case and display name conversion
//   ✅ Dealer object mapping with computed website URL and area_code
//   ✅ Person/employee object enrichment (name, name_at_dealership)
//   ✅ Phone number formatting (10-digit → (XXX) XXX-XXXX)
//   ✅ Exit note sentence-casing
//   ✅ Human-readable summary generation per event type
//   ✅ Regal custom object flat field generation
//   ✅ Activity trait generation for showroom visit events
//   ✅ Appointment details with confirmed status
//   ✅ Defensive null/type checks throughout
// ============================================

// ============= CONFIGURATION =============
var SCHEMA_VERSION = '1.0';
var EVENT_SOURCE = 'Promax';
var EVENT_NAME_PREFIX = 'showroom_visit';
var PROMAX_CUSTOMER_URL_BASE = 'https://promaxonline.com/customer/workscreen?customer=';
var DEALER_WEBSITE_BASE = 'https://www.rightway.com/d/';

// ============= VISIT TYPE MAPPINGS =============
var VISIT_TYPE_DISPLAY = {
  'BeBack': 'Be-Back',
  'InternetApptShow': 'Internet Appt Show',
  'PhoneApptShow': 'Phone Appt Show',
  'RepeatCustomer': 'Repeat Customer',
  'FreshWalkIn': 'Fresh Walk-In',
  'OutsideProspect': 'Outside Prospect',
  'Referral': 'Referral',
  'ServiceCustomer': 'Service Customer'
};

// ============= TIMEZONE UTILITIES =============
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
 * dayOfWeek: 0=Sunday, month: 0-indexed, n: 1-based
 */
function getNthDayOfMonth(year, month, dayOfWeek, n) {
  var first = new Date(Date.UTC(year, month, 1));
  var firstDow = first.getUTCDay();
  return 1 + ((dayOfWeek - firstDow + 7) % 7) + (n - 1) * 7;
}

/**
 * Determines if a UTC epoch ms falls within US DST.
 * DST starts: 2nd Sunday of March at 2:00 AM local standard time
 * DST ends:   1st Sunday of November at 2:00 AM local DST time
 */
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

/**
 * Returns the UTC offset in hours for a timezone at a given UTC time.
 */
function getTimezoneOffset(utcMs, tzName) {
  var tz = (tzName || '').toLowerCase();
  if (isDST(utcMs, tz)) {
    return TZ_DST_OFFSETS[tz] || 0;
  }
  return TZ_STANDARD_OFFSETS[tz] || 0;
}

/**
 * Returns a Date shifted so getUTC* methods return local time values.
 */
function toLocalDate(epochMs, tzName) {
  var offset = getTimezoneOffset(epochMs, tzName);
  return new Date(epochMs + offset * 3600000);
}

// ============= DATE FORMATTING =============
var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Converts epoch ms to ISO 8601 UTC string with +00:00 suffix.
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
 * Formats time from a local-shifted Date: "1:49 PM"
 */
function formatTimeOnly(localDate) {
  var hours = localDate.getUTCHours();
  var minutes = localDate.getUTCMinutes();
  var ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return hours + ':' + (minutes < 10 ? '0' + minutes : String(minutes)) + ' ' + ampm;
}

/**
 * Formats display date-time: "Sat, Feb 7, 2026 - 1:49 PM"
 */
function formatDisplayDateTime(epochMs, tzName) {
  if (!epochMs) return null;
  var d = toLocalDate(epochMs, tzName);
  return DAYS[d.getUTCDay()] + ', ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() +
    ', ' + d.getUTCFullYear() + ' - ' + formatTimeOnly(d);
}

/**
 * Formats summary date-time: "Sat, Feb 7, 2026 at 1:49 PM"
 */
function formatSummaryDateTime(epochMs, tzName) {
  if (!epochMs) return null;
  var d = toLocalDate(epochMs, tzName);
  return DAYS[d.getUTCDay()] + ', ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() +
    ', ' + d.getUTCFullYear() + ' at ' + formatTimeOnly(d);
}

/**
 * Formats date-only: "Sat, Feb 7, 2026"
 */
function formatDateOnly(epochMs, tzName) {
  if (!epochMs) return null;
  var d = toLocalDate(epochMs, tzName);
  return DAYS[d.getUTCDay()] + ', ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() +
    ', ' + d.getUTCFullYear();
}

/**
 * Formats short date: "2/5/26"
 */
function formatShortDate(epochMs, tzName) {
  if (!epochMs) return null;
  var d = toLocalDate(epochMs, tzName);
  return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + '/' + (d.getUTCFullYear() % 100);
}

// ============= DATA FORMATTING =============

/**
 * Converts PascalCase to snake_case.
 */
function toSnakeCase(str) {
  if (!str) return str;
  return str.replace(/([A-Z])/g, function(m, p1, offset) {
    return (offset > 0 ? '_' : '') + p1.toLowerCase();
  });
}

/**
 * Formats 10-digit phone number to (XXX) XXX-XXXX.
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
  return phone;
}

/**
 * Extracts area code from a formatted phone number string.
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
 * Sentence-cases a string: first char uppercase, rest lowercase.
 */
function sentenceCase(str) {
  if (!str || typeof str !== 'string') return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ============= BUILDER FUNCTIONS =============

/**
 * Builds the dealer object for traits and properties from promax_dealer.
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
 * Builds an enriched person object with computed name and name_at_dealership.
 * Returns null if person is falsy or not an object.
 */
function buildPersonObject(person, dealerName) {
  if (!person || typeof person !== 'object') return null;
  var name = ((person.first_name || '') + ' ' + (person.last_name || '')).trim();
  return {
    id: person.id,
    first_name: person.first_name || '',
    last_name: person.last_name || '',
    name: name,
    name_at_dealership: name + ' | ' + (dealerName || '')
  };
}

/**
 * Gets the full name string from a person object, or null.
 */
function getPersonName(person) {
  if (!person || typeof person !== 'object') return null;
  return ((person.first_name || '') + ' ' + (person.last_name || '')).trim() || null;
}

// ============= MAIN HANDLER =============
addHandler('transform', function(request, context) {
  var startTime = Date.now();

  try {
    var body = request.body;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      $transform.fail('Invalid payload: body must be an object');
    }

    var visit = body.promax_showroom_visit;
    var customer = body.promax_customer;
    var appointment = body.promax_appointment;
    var dealer = body.promax_dealer;

    if (!visit) {
      $transform.fail('Invalid payload: missing promax_showroom_visit');
    }
    if (!customer) {
      $transform.fail('Invalid payload: missing promax_customer');
    }
    if (!dealer) {
      $transform.fail('Invalid payload: missing promax_dealer');
    }

    // ============= EVENT TYPE DETECTION =============
    var isExitNote = visit.exit_note_id != null;
    var isDeleted = visit.deleted_at != null;
    var eventType;

    if (isDeleted) {
      $transform.fail('Delete events are not supported in Regal transformation');
    } else if (isExitNote) {
      eventType = 'exit_note';
    } else {
      eventType = 'new_visit';
    }

    var eventName = EVENT_NAME_PREFIX + '.' + eventType;

    // ============= TIMESTAMPS =============
    var tzName = dealer.time_zone || 'eastern';
    var primaryTimestamp = eventType === 'exit_note' ? visit.exit_at : visit.date_time;
    var originalTimestamp = toIsoUtc(primaryTimestamp);
    var startTimestamp = visit.date_time;

    if (!originalTimestamp) {
      $transform.fail('Invalid payload: missing primary timestamp');
    }

    // ============= DEALER =============
    var dealerObj = buildDealerObject(dealer);
    var dealerName = dealer.marketing_name || '';

    // ============= PERSON OBJECTS =============
    var createdByPerson = buildPersonObject(body.created_by, dealerName);
    var exitByPerson = buildPersonObject(body.exit_by, dealerName);
    var salesRep1Person = buildPersonObject(body.sales_rep_1, dealerName);

    // ============= VISIT TYPE =============
    var visitTypeRaw = visit.type || '';
    var visitTypeSnake = toSnakeCase(visitTypeRaw);
    var visitTypeDisplay = VISIT_TYPE_DISPLAY[visitTypeRaw] || visitTypeRaw;

    // ============= ACTIVITY =============
    var activitySpecific = {};

    if (eventType === 'exit_note') {
      activitySpecific.at = originalTimestamp;
      activitySpecific.dealer_id = visit.dealer_id;
      if (visit.reason_unsold) activitySpecific.reason_unsold = visit.reason_unsold;
      activitySpecific.showroom_visit_id = visit.id;
    } else {
      activitySpecific.at = originalTimestamp;
      activitySpecific.dealer_id = visit.dealer_id;
      activitySpecific.customer_id = visit.customer_id;
      activitySpecific.showroom_visit_id = visit.id;
    }

    var activityLast = {
      at: originalTimestamp,
      dealer_id: visit.dealer_id,
      customer_id: visit.customer_id,
      showroom_visit_id: visit.id,
      type: eventType
    };

    var showroomVisitsActivity = {};
    showroomVisitsActivity[eventType] = activitySpecific;
    showroomVisitsActivity.last = activityLast;

    // ============= TRAITS =============
    var traits = {
      firstName: customer.first_name || '',
      lastName: customer.last_name || '',
      dealer: dealerObj,
      activity: {
        at: originalTimestamp,
        showroom_visits: showroomVisitsActivity
      }
    };

    // ============= START =============
    var startObj = {
      at: toIsoUtc(startTimestamp),
      at_display: formatDisplayDateTime(startTimestamp, tzName),
      by: createdByPerson
    };

    // ============= EXIT (exit_note only) =============
    var exitObj = null;
    if (eventType === 'exit_note') {
      exitObj = {
        id: visit.exit_note_id,
        reason_unsold: visit.reason_unsold || '',
        note: sentenceCase(visit.exit_note) || '',
        is_manager_note: visit.is_manager_note ? 'Yes' : 'No',
        at: toIsoUtc(visit.exit_at),
        at_display: formatDisplayDateTime(visit.exit_at, tzName),
        by: exitByPerson
      };
    }

    // ============= APPOINTMENT =============
    var appointmentObj = null;
    if (appointment && appointment.id) {
      var confirmedStatus = (body.confirmed_by && typeof body.confirmed_by === 'object') ? 'Yes' : 'No';
      appointmentObj = {
        id: appointment.id,
        scheduled_by: getPersonName(body.scheduled_by) || '',
        scheduled_for: formatDisplayDateTime(appointment.scheduled_for, tzName),
        set_via: appointment.set_via || '',
        set_at: formatDisplayDateTime(appointment.scheduled_at, tzName),
        confirmed_status: confirmedStatus
      };
    }

    // ============= CUSTOMER =============
    var customerName = ((customer.first_name || '') + ' ' + (customer.last_name || '')).trim();
    var customerObj = {
      id: customer.id,
      url: PROMAX_CUSTOMER_URL_BASE + customer.id,
      first_name: customer.first_name || '',
      last_name: customer.last_name || '',
      name: customerName,
      cell_phone: formatPhone(customer.cell_phone),
      home_phone: formatPhone(customer.home_phone),
      email: customer.primary_email || '',
      sales_rep_1: salesRep1Person
    };

    // ============= SUMMARY =============
    var summary = '';

    if (eventType === 'exit_note') {
      var exitDateStr = formatSummaryDateTime(visit.exit_at, tzName);
      var exitByName = getPersonName(body.exit_by) || 'Unknown';
      summary = customerName + ' left our ' + dealerName + ' dealership on ' + exitDateStr +
        ' and was checked out by ' + exitByName + '.';
      if (visit.reason_unsold) {
        summary += ' Reason Unsold: ' + visit.reason_unsold + '.';
      }
      if (visit.exit_note) {
        summary += ' Note: ' + sentenceCase(visit.exit_note) + '.';
      }
    } else {
      var startDateStr = formatSummaryDateTime(startTimestamp, tzName);
      var createdByName = getPersonName(body.created_by) || 'Unknown';
      summary = customerName + ' visited our ' + dealerName + ' dealership as a ' + visitTypeDisplay +
        ' on ' + startDateStr + ' and was checked in by ' + createdByName + '.';
      if (appointment && appointment.scheduled_for) {
        var apptShortDate = formatShortDate(appointment.scheduled_for, tzName);
        var apptLocal = toLocalDate(appointment.scheduled_for, tzName);
        var apptTime = formatTimeOnly(apptLocal);
        summary += ' Had an appointment scheduled for ' + apptShortDate + ' at ' + apptTime + '.';
      }
    }

    // ============= CUSTOM OBJECT FIELDS =============
    var customFields = {};
    customFields.custom_object_showroom_visit_id = String(visit.id);
    customFields.custom_object_showroom_visit_customer_id = String(customer.id);
    customFields.custom_object_showroom_visit_name = formatDateOnly(primaryTimestamp, tzName) + ' | ' + dealerName;
    customFields.custom_object_showroom_visit_date_display = formatDisplayDateTime(primaryTimestamp, tzName);
    customFields.custom_object_showroom_visit_start_at_display = formatDisplayDateTime(startTimestamp, tzName);

    if (eventType === 'exit_note') {
      customFields.custom_object_showroom_visit_exit_at_display = formatDisplayDateTime(visit.exit_at, tzName);
    }

    customFields.custom_object_showroom_visit_dealer = dealerName;
    customFields.custom_object_showroom_visit_type = visitTypeDisplay;
    customFields.custom_object_showroom_visit_start_by = getPersonName(body.created_by) || '';

    if (eventType === 'exit_note') {
      customFields.custom_object_showroom_visit_exit_by = getPersonName(body.exit_by) || '';
    }

    customFields.custom_object_showroom_visit_sales_rep_1 = getPersonName(body.sales_rep_1) || '';

    if (eventType === 'exit_note') {
      if (visit.exit_note) {
        customFields.custom_object_showroom_visit_exit_note = sentenceCase(visit.exit_note);
      }
      if (visit.reason_unsold) {
        customFields.custom_object_showroom_visit_exit_reason = visit.reason_unsold;
      }
    }

    if (appointmentObj) {
      var apptDetails =
        '\ud83d\udcc5 Appt: ' + (appointmentObj.scheduled_for || '') +
        '\n\ud83d\udc68\u200d\ud83d\udcbb Set By: ' + (appointmentObj.scheduled_by || '') +
        '\n\ud83d\udcf2 Set Via: ' + (appointmentObj.set_via || '') +
        '\n\u270f\ufe0f Set At: ' + (appointmentObj.set_at || '');
      if (appointment.comments) {
        apptDetails += '\n\ud83d\udcac Comments: ' + appointment.comments;
      }
      apptDetails +=
        '\n\u2705 Confirmed: ' + (appointmentObj.confirmed_status || '') +
        '\n\ud83c\udd94 Appt ID: ' + appointmentObj.id;
      customFields.custom_object_showroom_visit_appt_details = apptDetails;
    }

    // ============= PROPERTIES =============
    var properties = {
      event_id: String(visit.id),
      summary: summary,
      visit_type: visitTypeSnake,
      visit_type_display: visitTypeDisplay,
      start: startObj
    };

    if (exitObj) {
      properties.exit = exitObj;
    }

    if (appointmentObj) {
      properties.appointment = appointmentObj;
    }

    properties.customer = customerObj;
    properties.dealer = dealerObj;

    var customKeys = Object.keys(customFields);
    for (var i = 0; i < customKeys.length; i++) {
      properties[customKeys[i]] = customFields[customKeys[i]];
    }

    // ============= FINAL OUTPUT =============
    var output = {
      userId: customer.regal_external_id,
      name: eventName,
      eventSource: EVENT_SOURCE,
      originalTimestamp: originalTimestamp,
      traits: traits,
      properties: properties
    };

    console.log('Showroom visit → Regal transformation processed in ' + (Date.now() - startTime) + 'ms', {
      event_type: eventType,
      showroom_visit_id: visit.id,
      customer_id: customer.id,
      dealer_id: dealer.id,
      schema_version: SCHEMA_VERSION
    });

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
// END SHOWROOM VISIT → REGAL TRANSFORMATION v1.0
// ============================================
