export const TAU = Math.PI * 2;

export const ROOFS = [
  { name: 'lower-roof', radius: 10.65, innerRadius: 6.12, eave: 10.3, rise: 3.05, ribs: 240, lift: 10.9, delay: 0.14 },
  { name: 'middle-roof', radius: 8.55, innerRadius: 4.38, eave: 14.1, rise: 3.12, ribs: 192, lift: 14.6, delay: 0.07 },
  { name: 'upper-roof', radius: 6.6, innerRadius: 0.24, eave: 17.85, rise: 4.9, ribs: 160, lift: 18.2, delay: 0 },
];

export const TERRACES = [
  { radius: 18.2, bottom: 0.13, height: 1.05, bays: 20, lift: 0, delay: 0.48 },
  { radius: 15.75, bottom: 1.18, height: 1.05, bays: 17, lift: 1.75, delay: 0.44 },
  { radius: 13.3, bottom: 2.23, height: 1.05, bays: 14, lift: 3.5, delay: 0.4 },
];

export const QUALITY = {
  eco: { pixelRatio: 1, shadowSize: 1024, aoScale: 0.45, ao: false },
  balanced: { pixelRatio: 1.35, shadowSize: 1536, aoScale: 0.5, ao: true },
  high: { pixelRatio: 1.75, shadowSize: 2048, aoScale: 0.65, ao: true },
};

export function readOptions(search = '') {
  const query = new URLSearchParams(search);
  const test = query.get('test') === '1';
  const still = query.get('still') === '1';
  const bounded = (key, fallback, min, max) => {
    const raw = query.get(key);
    const value = raw === null || raw.trim() === '' ? fallback : Number(raw);
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : fallback));
  };
  return {
    test,
    still,
    fps: bounded('fps', test ? 6 : 30, 1, 60),
    frames: Math.round(bounded('frames', 12, 1, 240)),
    quality: Object.hasOwn(QUALITY, query.get('quality')) ? query.get('quality') : 'balanced',
    annotations: query.get('labels') === '1',
  };
}
