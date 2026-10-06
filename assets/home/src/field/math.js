// Small numeric helpers shared by every part of the particle field.
//
// S(x) is the cubic smoothstep on [0, 1]; ramp(x, a, b) eases from 0 at a to 1 at b;
// win(l, i0, i1, o0, o1) is a trapezoid that rises over [i0, i1] and falls over [o0, o1].

export const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
export const S = x => { const t = clamp01(x); return t * t * (3 - 2 * t); };
export const ramp = (x, a, b) => S((x - a) / (b - a));
export const win = (l, i0, i1, o0, o1) => Math.min(ramp(l, i0, i1), 1 - ramp(l, o0, o1));
export const lerp = (a, b, t) => a + (b - a) * t;
export const TAU = Math.PI * 2;

/** Mix two [r, g, b] colours and round each channel. */
export const mixRGB = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

/** In-place Fisher-Yates shuffle driven by `random` (last index first). */
export function shuffle(list, random) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const t = list[i]; list[i] = list[j]; list[j] = t;
  }
  return list;
}
