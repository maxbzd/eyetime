import test from 'node:test';
import assert from 'node:assert/strict';
import { isMinorUpdate } from '../../src/shared/whatsnew.js';

test('the "What\'s new" card appears for minor and major updates only', () => {
  assert.equal(isMinorUpdate('2.8.0', '2.9.0'), true);
  assert.equal(isMinorUpdate('2.9.3', '3.0.0'), true);
  assert.equal(isMinorUpdate('2.8.0', '2.8.1'), false);
  assert.equal(isMinorUpdate('2.8.0', '2.8.0'), false);
  assert.equal(isMinorUpdate('3.1.0', '3.0.9'), false); // a downgrade is not news
  assert.equal(isMinorUpdate(undefined, '3.0.0'), false);
});
