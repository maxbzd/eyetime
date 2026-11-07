// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The numbers the collector holds itself to, in one place for the handler and both stores.

/** Kinds of things the collector counts about its own door, by day and never by who: the way to see that reports are failing without keeping a log of anyone. */
export const INGEST_KINDS = ['accepted', 'forgot', 'bad_report', 'bad_json', 'bad_type', 'too_big', 'wrong_origin', 'too_soon', 'flood', 'bad_feedback'];

/** A day's answers to the question after removal, in all: a script cannot swamp the counts with one request after another. */
export const MAX_UNINSTALLS_PER_DAY = 2000;

/** Notes on the charts ("released 3.8.1", "post on Habr"): few, short, the owner's own. */
export const MAX_NOTES = 300;
export const MAX_NOTE_LENGTH = 80;

/** Settings the owner may keep on the collector; an alert key is "alert:<id>" and holds the day it was last sent. */
export const SETTING_KEYS = /^(targets|alert:[a-z0-9_-]{1,32})$/;

/** The day (UTC) of a time in ms, as YYYY-MM-DD. */
export const dayOf = (/** @type {number} */ ms) => new Date(ms).toISOString().slice(0, 10);
