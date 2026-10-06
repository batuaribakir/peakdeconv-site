// Chart formation: the growth series drawn as a dotted Catmull-Rom curve plus two dotted
// axes. Points past the "today" index (and off the x axis) are teal.
//
// series: { values: number[], vMax, todayIndex }  (CHART from content.js)
// frame:  { x0, x1, yBase, yTop }                   (config.chart)
// Returns [x, y, teal] triples in stage px (integers).

export function chartPoints(series, frame) {
  const { values, vMax, todayIndex } = series;
  const { x0, x1, yBase, yTop } = frame;
  const n = values.length;
  const X = i => x0 + (x1 - x0) * (i / (n - 1));
  const Y = v => yBase - (yBase - yTop) * (v / vMax);
  const P = values.map((v, i) => [X(i), Y(v)]);
  const xToday = X(todayIndex);

  // uniform Catmull-Rom; the end points stand in for their missing neighbours
  const at = (i, t, k) => {
    const a = P[Math.max(0, i - 1)][k], b = P[i][k], c = P[i + 1][k], d = P[Math.min(n - 1, i + 2)][k];
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  };

  const pts = [];
  let px = 0, py = 0, started = false;
  for (let i = 0; i < n - 1; i++) {
    for (let t = 0; t < 1; t += 0.003) {
      const x = at(i, t, 0), y = at(i, t, 1);
      if (started && Math.hypot(x - px, y - py) < 1) continue;
      const rx = Math.round(x), ry = Math.round(y);
      pts.push([rx, ry], [rx, ry - 1], [rx, ry + 1]);
      px = x; py = y; started = true;
    }
  }
  for (let x = x0; x <= x1; x += 5) pts.push([x, yBase]);
  for (let y = yTop; y <= yBase; y += 5) pts.push([x0, y]);
  return pts.map(p => [p[0], p[1], p[0] > xToday && Math.abs(p[1] - yBase) > 4]);
}

/** Stage position [x, y] of series point i (anchor for the DOM chart labels). */
export function chartAnchor(series, frame, i) {
  const n = series.values.length;
  return [frame.x0 + (frame.x1 - frame.x0) * (i / (n - 1)), frame.yBase - (frame.yBase - frame.yTop) * (series.values[i] / series.vMax)];
}
