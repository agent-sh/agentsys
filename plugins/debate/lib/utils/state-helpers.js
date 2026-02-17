'use strict';

const { isDeepStrictEqual } = require('util');

const RETRY_SLEEP_STATE = typeof SharedArrayBuffer === 'function' && typeof Atomics === 'object' && typeof Atomics.wait === 'function'
  ? new Int32Array(new SharedArrayBuffer(4))
  : null;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasUpdatedSubset(target, subset) {
  if (!isPlainObject(subset)) {
    return isDeepStrictEqual(target, subset);
  }
  if (!isPlainObject(target)) {
    return false;
  }

  for (const [key, value] of Object.entries(subset)) {
    if (!hasUpdatedSubset(target[key], value)) {
      return false;
    }
  }
  return true;
}

function updatesApplied(state, updates) {
  if (!state) return false;

  for (const [key, value] of Object.entries(updates || {})) {
    if (key === '_version') continue;
    if (!hasUpdatedSubset(state[key], value)) {
      return false;
    }
  }

  return true;
}

function sleepForRetry(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return;
  }

  const delayMs = Math.floor(ms);
  if (RETRY_SLEEP_STATE) {
    try {
      Atomics.wait(RETRY_SLEEP_STATE, 0, 0, delayMs);
    } catch {
      // Ignore environments where Atomics.wait exists but cannot be used.
    }
  }
}

module.exports = {
  isPlainObject,
  updatesApplied,
  sleepForRetry
};
