/** @jest-environment jsdom */
const SelectionUtils = require('../public/selectionUtils');

describe('SelectionUtils', () => {
  test('buildIdMap assigns stable ids and next avoids asked', () => {
    const qs = [{ text: 'A' }, { text: 'B' }, { text: 'C' }];
    const { byId, order } = SelectionUtils.buildIdMap(qs);
    expect(order.length).toBe(3);
    const askedSet = new Set([order[0], order[1]]);
    const next = SelectionUtils.nextQuestionId(order, askedSet);
    expect([order[2], null]).toContain(next);
  });

  test('exhausted returns null', () => {
    const qs = [{ text: 'X' }];
    const { order } = SelectionUtils.buildIdMap(qs);
    const askedSet = new Set(order);
    expect(SelectionUtils.nextQuestionId(order, askedSet)).toBe(null);
  });
});


