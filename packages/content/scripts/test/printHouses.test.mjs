import assert from 'node:assert';
import { test } from 'node:test';
import { checkPrintHouseCatalog } from '../printHouses.mjs';

const good = {
  id: 'boardgamesmaker',
  label: 'Board Games Maker',
  url: 'https://www.boardgamesmaker.com/',
  source: 'https://www.boardgamesmaker.com/pops/faq-photo.html',
  checkedAt: '2026-10-24',
  formats: [{ format: 'trading-card', width: 822, height: 1122, type: 'png', dpi: 300 }],
  backs: 'per-card',
};

test('print houses: a sourced, dated profile passes; missing source, bad date, bad sizes and duplicates fail', () => {
  assert.deepStrictEqual(checkPrintHouseCatalog({ printHouses: [good] }), []);
  const problems = checkPrintHouseCatalog({
    printHouses: [
      { ...good, source: undefined },
      { ...good, id: 'b', checkedAt: 'last week' },
      { ...good, id: 'c', backs: 'sometimes', formats: [{ format: 'trading-card', width: 10.5, height: 1122, type: 'gif', dpi: 72 }] },
      { ...good, id: 'b' },
    ],
  });
  for (const re of [/boardgamesmaker: source must be an https link/, /b: checkedAt must be/, /c: backs must be/, /c trading-card: type must be/, /c trading-card: width and height/, /c trading-card: dpi/, /b: id used twice/]) {
    assert.ok(problems.some((p) => re.test(p)), `${re}\n${problems.join('\n')}`);
  }
});
