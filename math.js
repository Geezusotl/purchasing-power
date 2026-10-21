/* Economic calculations shared by the interface and dependency-free Node tests. */
(function (root) {
  'use strict';
  const valid = n => typeof n === 'number' && Number.isFinite(n);
  const ratio = (a, b) => valid(a) && valid(b) && b > 0 ? a / b : null;
  const change = (a, b) => { const r = ratio(a, b); return r === null ? null : (r - 1) * 100; };
  const value = (s, date) => s.data.find(p => p.date === date)?.value ?? null;
  const previousYear = date => `${Number(date.slice(0, 4)) - 1}${date.slice(4)}`;
  const yoy = (s, date) => change(value(s, date), value(s, previousYear(date)));
  function realChange(wageNow, wageThen, priceNow, priceThen) {
    const w = ratio(wageNow, wageThen), p = ratio(priceNow, priceThen);
    return w === null || p === null || p === 0 ? null : (w / p - 1) * 100;
  }
  function equivalent(amount, from, to) {
    const r = ratio(to, from);
    return valid(amount) && amount >= 0 && r !== null ? amount * r : null;
  }
  function commonDates(...series) {
    return series[0].data.filter(p => valid(p.value) && series.every(s => valid(value(s, p.date)))).map(p => p.date).sort();
  }
  function indexed(series, base, end) {
    const b = value(series, base);
    return series.data.filter(p => p.date >= base && p.date <= end).map(p => ({date: p.date, value: valid(p.value) && b > 0 ? 100 * p.value / b : null}));
  }
  // Never draw through missing months, even when the provider omitted their rows.
  function segments(points) {
    const output = []; let current = [], previous = null;
    for (const p of points) {
      const month = Number(p.date.slice(0, 4)) * 12 + Number(p.date.slice(5));
      if (!valid(p.value) || (previous !== null && month !== previous + 1)) {
        if (current.length) output.push(current);
        current = [];
      }
      if (valid(p.value)) current.push(p);
      previous = month;
    }
    if (current.length) output.push(current);
    return output;
  }
  const api = {valid, ratio, change, value, previousYear, yoy, realChange, equivalent, commonDates, indexed, segments};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PPMath = api;
})(typeof window === 'undefined' ? globalThis : window);
