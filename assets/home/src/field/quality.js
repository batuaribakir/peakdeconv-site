// Adaptive quality ladder. It watches the last 16 frame times; when their median is above
// 32 ms (and at least 500 ms after the previous step) it lowers three knobs in one step:
//   kCeil  ceiling of the resolution factor E (quarter steps, floor 0.4)
//   detail terrain grid density (floor 0.4)
//   dotK   share of particles drawn (floor 0.8)
// Stepping down is exactly the reference's rule.
//
// Two additions, both only ever raise quality (resolution-audit.md):
//  - Scene classes. The line scene ("travel": road, fork, climb) is far more expensive than the
//    dot scenes ("light": hero, chart, fall, circuit, blank). Each class keeps its own level, so
//    a slow patch in the line scene no longer leaves the dots and the circuit at 768×432 for the
//    rest of the visit, as it does in the reference. Switching class switches level at once.
//  - Recovery inside a class. After a calm period (light 2 s, travel 6 s) with a 16-frame median
//    of at most 20 ms the previous level comes back, one step at a time. Every recovery that is
//    followed by another step down within 4 s doubles that class's calm period (up to 32 s),
//    so a scene that is only affordable at the lower level settles there instead of pumping.
// createLadder({ recover: false }) gives the reference's behaviour: one class, no way back up.

const WINDOW = 16, LIMIT_MS = 32, COOLDOWN_MS = 500;
const RECOVER_MS = 20, CALM_MAX_MS = 32000, RELAPSE_MS = 4000;
const CALM_START_MS = { light: 2000, travel: 6000 };

function freshLevel(cls) {
  return { kCeil: 1, detail: 1, dotK: 1, history: [], calm: CALM_START_MS[cls] ?? 2000, lastUp: -Infinity };
}

export function createLadder({ recover = true } = {}) {
  const ring = new Float64Array(WINDOW);
  let filled = 0, head = 0, lastStep = -Infinity;
  const levels = { light: freshLevel('light') };
  let cls = 'light', lv = levels.light;
  const q = { kCeil: 1, detail: 1, dotK: 1, steps: 0, recoveries: 0, recover, get sceneClass() { return cls; } };
  const expose = () => { q.kCeil = lv.kCeil; q.detail = lv.detail; q.dotK = lv.dotK; };
  const resetWindow = () => { filled = 0; head = 0; };

  /** Switch the scene class ('light' | 'travel'). Returns true when the active level changed. */
  q.setClass = next => {
    if (!recover || next === cls) return false;
    const before = lv.kCeil;
    cls = next; lv = levels[cls] || (levels[cls] = freshLevel(cls));
    expose(); resetWindow();
    return lv.kCeil !== before;
  };

  /**
   * Feed one frame delta (ms) at time `now`.
   * Returns -1 when the ladder stepped down, +1 when it recovered one step, 0 otherwise.
   */
  q.sample = (deltaMs, now) => {
    ring[head] = deltaMs; head = (head + 1) % WINDOW;
    if (filled < WINDOW) filled++;
    if (filled < WINDOW || now - lastStep < COOLDOWN_MS) return 0;
    const sorted = Array.from(ring).sort((a, b) => a - b);
    const median = sorted[WINDOW / 2];   // upper median: 8 slow frames out of 16 are enough
    if (median > LIMIT_MS) {
      if (lv.kCeil <= 0.4 && lv.detail <= 0.4 && lv.dotK <= 0.8) return 0;
      lv.history.push({ kCeil: lv.kCeil, detail: lv.detail, dotK: lv.dotK });
      const m = LIMIT_MS / median;
      lv.kCeil = Math.max(0.4, Math.min(lv.kCeil - 0.25, Math.floor(lv.kCeil * m * 4) / 4));
      lv.detail = Math.max(0.4, Math.min(lv.detail - 0.2, lv.detail * m));
      lv.dotK = Math.max(0.8, Math.min(lv.dotK - 0.25, lv.dotK * m));
      if (now - lv.lastUp < RELAPSE_MS) lv.calm = Math.min(CALM_MAX_MS, lv.calm * 2);
      q.steps++; expose();
      lastStep = now; resetWindow();
      return -1;
    }
    if (recover && lv.history.length && median <= RECOVER_MS && now - lastStep >= lv.calm) {
      Object.assign(lv, lv.history.pop());
      lv.lastUp = now;
      q.recoveries++; expose();
      lastStep = now; resetWindow();
      return 1;
    }
    return 0;
  };
  return q;
}
