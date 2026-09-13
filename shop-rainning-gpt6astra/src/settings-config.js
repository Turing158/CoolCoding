export const SHADOW_QUALITY = { off: 0, low: 512, medium: 1536, high: 2048 };
export const RENDER_SCALE = { economy: .65, standard: 1, high: 1.35 };
export const REFLECTION_QUALITY = {
  off: { size: 1, interval: Infinity },
  low: { size: 384, interval: 500 },
  medium: { size: 768, interval: 240 },
  high: { size: 1024, interval: 125 },
};

export function defaultSettings({ reducedMotion = false, narrow = false } = {}) {
  return {
    fps: reducedMotion ? 12 : 24,
    resolution: 'standard',
    shadows: 'medium',
    reflections: 'medium',
    rain: reducedMotion ? Math.round(280 / (narrow ? 500 : 820) * 100) : 100,
    bloom: 24,
    exposure: 108,
  };
}

// Stored preferences are untrusted input: reject unknown modes and cap numbers.
export function normalizeSettings(input, defaults) {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const number = (key, min, max) => typeof value[key] === 'number' && Number.isFinite(value[key])
    ? Math.min(max, Math.max(min, Math.round(value[key]))) : defaults[key];
  const choice = (key, options) => Object.hasOwn(options, value[key]) ? value[key] : defaults[key];
  return {
    fps: number('fps', 1, 60),
    resolution: choice('resolution', RENDER_SCALE),
    shadows: choice('shadows', SHADOW_QUALITY),
    reflections: choice('reflections', REFLECTION_QUALITY),
    rain: number('rain', 0, 100),
    bloom: number('bloom', 0, 60),
    exposure: number('exposure', 70, 145),
  };
}

export function createPresets(defaults) {
  return {
    economy: { ...defaults, fps: 12, resolution: 'economy', shadows: 'low', reflections: 'low', rain: 30, bloom: 14 },
    balanced: { ...defaults },
    detailed: { ...defaults, fps: 30, resolution: 'high', shadows: 'high', reflections: 'high', rain: 100, bloom: 32 },
  };
}

export function matchingPreset(settings, presets) {
  return Object.keys(presets).find(name => Object.keys(settings).every(key => presets[name][key] === settings[key])) || 'custom';
}
