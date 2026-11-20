// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The movement break: every Nth eye break (the third by default, about an hour of work) is a little longer and asks the body for a moment instead of only the eyes.
// Pure: which break it is, and which of the exercises comes with it. The exercises are words (`break.ex.1` … `break.ex.8`), the same in every language of the page.

/** How many exercises there are (the keys `break.ex.1` … `break.ex.N`). */
export const MOVE_EXERCISES = 8;
/** How long a movement break lasts, in seconds. */
export const MOVE_SECONDS = 45;

/**
 * Is the next break a movement break? `taken` = breaks finished today, `every` = the setting (0 or 1 = never: "every break" would only be a longer break).
 * @param {number} taken @param {number} every
 */
export const isMoveBreak = (taken, every) => Number.isInteger(every) && every > 1 && Number.isInteger(taken) && taken >= 0 && (taken + 1) % every === 0;

/** The exercise (1 … MOVE_EXERCISES) for the break that comes after `taken` finished ones: the next one each time, so that a day does not repeat itself. */
export const exerciseOf = (taken, every) => 1 + (Math.floor(Math.max(0, taken) / Math.max(2, every)) % MOVE_EXERCISES);
