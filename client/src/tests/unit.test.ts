import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEthiopian, toEthiopian } from '../lib/ethiopian.ts';

test('Gregorian dates convert to the Ethiopian calendar', () => {
  assert.deepEqual(toEthiopian(new Date(2026, 9, 7)), { year: 2019, month: 1, day: 27 });
  assert.deepEqual(toEthiopian(new Date(2026, 8, 11)), { year: 2019, month: 1, day: 1 }); // Enkutatash
  assert.deepEqual(toEthiopian(new Date(2026, 8, 10)), { year: 2018, month: 13, day: 5 }); // last day of Pagume
  assert.deepEqual(toEthiopian(new Date(2023, 8, 11)), { year: 2015, month: 13, day: 6 }); // leap-year Pagume has 6 days
  assert.deepEqual(toEthiopian(new Date(2000, 0, 1)), { year: 1992, month: 4, day: 22 });
});

test('Ethiopian dates format in English and Amharic', () => {
  assert.equal(formatEthiopian(new Date(2026, 9, 7), 'en'), 'Meskerem 27, 2019');
  assert.equal(formatEthiopian(new Date(2026, 9, 7), 'am'), 'መስከረም 27, 2019');
});
