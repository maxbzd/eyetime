// Row packing for the widget board (pure function, unit-tested).
// Widgets flow in order into rows of 12 columns. With `fill` every complete row is stretched to the full width,
// so the board stays tidy however widgets are ordered or sized. A lone widget on the last row keeps its size.
(function (root) {
  function packRows(base, fill) {
    const rows = [];
    let cur = [], sum = 0;
    base.forEach((c, i) => {
      if (sum + c > 12 && cur.length) { rows.push(cur); cur = []; sum = 0; }
      cur.push(i); sum += c;
    });
    if (cur.length) rows.push(cur);
    const spans = base.slice();
    rows.forEach((row, ri) => {
      const total = row.reduce((s, i) => s + base[i], 0);
      const last = ri === rows.length - 1;
      if (!fill || total >= 12 || (last && row.length === 1)) return;
      let left = 12 - total;
      const n = row.length, each = Math.floor(left / n);
      row.forEach(i => { spans[i] += each; });
      left -= each * n;
      for (let k = 0; left > 0; k++, left--) spans[row[k % n]] += 1;
    });
    return spans;
  }
  const api = { packRows };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.EyeTimePack = api;
})(typeof self !== 'undefined' ? self : this);
