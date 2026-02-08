#!/usr/bin/env node
/**
 * Test harness for leads.js transformation.
 * Loads each example 3-xano-to-regal-raw.json, runs the transformation,
 * and deep-compares output against the expected 4-regal-formatted.json.
 */

const fs = require('fs');
const path = require('path');

// ============= MOCK HOOKDECK ENVIRONMENT =============

let capturedHandler = null;

global.addHandler = function(type, fn) {
  if (type === 'transform') capturedHandler = fn;
};

global.$transform = {
  fail: function(msg) { throw new Error('$transform.fail: ' + msg); }
};

// Load the transformation script
const scriptPath = path.join(__dirname, 'hookdeck/transformations/3-xano-to-regal-raw/leads.js');
require(scriptPath);

if (!capturedHandler) {
  console.error('ERROR: No transform handler was registered');
  process.exit(1);
}

// ============= EXAMPLE DIRECTORIES =============

const exampleDirs = [
  'examples/lead/book_appointment',
  'examples/lead/get_approved/complete',
  'examples/lead/get_approved/incomplete',
  'examples/lead/inventory_browsing_squeeze',
  'examples/lead/vehicle_ask_question',
  'examples/lead/vehicle_book_appointment',
  'examples/lead/vehicle_check_availability',
  'examples/lead/vehicle_explore_payments',
  'examples/lead/vehicle_get_approved/complete',
  'examples/lead/vehicle_get_approved/incomplete',
  'examples/lead/vehicle_request_info',
  'examples/lead/vehicle_text_us'
];

// Fields that use Date.now() and will always differ
const TIMESTAMP_FIELDS = new Set([
  'properties.custom_object_lead_name',
  'properties.custom_object_lead_received_display'
]);

// Known acceptable differences where implementation intentionally differs from example files
// per user requirements (internal_name uses dealer.gmg_nickname; referral_url always included)
const KNOWN_ACCEPTABLE_PATHS = new Set([
  'traits.dealer.internal_name',
  'properties.dealer.internal_name',
  'properties.form_metadata.referral_url'
]);

// ============= DEEP DIFF =============

function deepDiff(actual, expected, pathStr) {
  const diffs = [];

  if (TIMESTAMP_FIELDS.has(pathStr) || KNOWN_ACCEPTABLE_PATHS.has(pathStr)) {
    // Skip fields that depend on Date.now() or have known acceptable differences
    return diffs;
  }

  if (actual === expected) return diffs;

  if (typeof actual !== typeof expected) {
    diffs.push({ path: pathStr, actual: actual, expected: expected, type: 'type_mismatch' });
    return diffs;
  }

  if (actual === null || expected === null) {
    if (actual !== expected) {
      diffs.push({ path: pathStr, actual: actual, expected: expected, type: 'value_mismatch' });
    }
    return diffs;
  }

  if (typeof actual === 'object') {
    if (Array.isArray(actual) !== Array.isArray(expected)) {
      diffs.push({ path: pathStr, actual: typeof actual, expected: typeof expected, type: 'type_mismatch' });
      return diffs;
    }

    if (Array.isArray(actual)) {
      if (actual.length !== expected.length) {
        diffs.push({ path: pathStr, actual: 'length=' + actual.length, expected: 'length=' + expected.length, type: 'array_length' });
      }
      const len = Math.max(actual.length, expected.length);
      for (let i = 0; i < len; i++) {
        diffs.push(...deepDiff(actual[i], expected[i], pathStr + '[' + i + ']'));
      }
    } else {
      const allKeys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
      for (const key of allKeys) {
        const childPath = pathStr ? pathStr + '.' + key : key;
        if (TIMESTAMP_FIELDS.has(childPath) || KNOWN_ACCEPTABLE_PATHS.has(childPath)) continue;
        if (!(key in actual)) {
          diffs.push({ path: childPath, actual: '<missing>', expected: expected[key], type: 'missing_in_actual' });
        } else if (!(key in expected)) {
          diffs.push({ path: childPath, actual: actual[key], expected: '<missing>', type: 'extra_in_actual' });
        } else {
          diffs.push(...deepDiff(actual[key], expected[key], childPath));
        }
      }
    }
  } else {
    if (actual !== expected) {
      diffs.push({ path: pathStr, actual: actual, expected: expected, type: 'value_mismatch' });
    }
  }

  return diffs;
}

// ============= RUN TESTS =============

let totalPassed = 0;
let totalFailed = 0;
let totalDiffs = 0;

for (const dir of exampleDirs) {
  const inputPath = path.join(__dirname, dir, '3-xano-to-regal-raw.json');
  const expectedPath = path.join(__dirname, dir, '4-regal-formatted.json');
  const testName = dir.replace('examples/lead/', '');

  if (!fs.existsSync(inputPath) || !fs.existsSync(expectedPath)) {
    console.log('⚠  SKIP: ' + testName + ' (missing files)');
    continue;
  }

  try {
    const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));

    // Run transformation
    const request = { body: JSON.parse(JSON.stringify(input)) };
    const result = capturedHandler(request, {});
    const actual = result.body;

    // Compare
    const diffs = deepDiff(actual, expected, '');

    if (diffs.length === 0) {
      console.log('✓  PASS: ' + testName);
      totalPassed++;
    } else {
      console.log('✗  FAIL: ' + testName + ' (' + diffs.length + ' differences)');
      totalFailed++;
      totalDiffs += diffs.length;
      for (const diff of diffs) {
        const actualStr = typeof diff.actual === 'object' ? JSON.stringify(diff.actual) : String(diff.actual);
        const expectedStr = typeof diff.expected === 'object' ? JSON.stringify(diff.expected) : String(diff.expected);
        console.log('   ' + diff.path);
        console.log('     actual:   ' + actualStr.slice(0, 200));
        console.log('     expected: ' + expectedStr.slice(0, 200));
      }
    }
  } catch (err) {
    console.log('✗  ERROR: ' + testName + ': ' + err.message);
    totalFailed++;
  }
}

console.log('\n' + '='.repeat(60));
console.log('Results: ' + totalPassed + ' passed, ' + totalFailed + ' failed, ' + totalDiffs + ' total diffs');
console.log('='.repeat(60));

process.exit(totalFailed > 0 ? 1 : 0);
