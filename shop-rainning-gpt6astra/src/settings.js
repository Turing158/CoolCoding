import { createPresets, matchingPreset } from './settings-config.js';

const icons = {
  settings: '<path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  play: '<path d="m9 5 10 7-10 7V5Z"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
};
const svg = name => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;

export function createSettingsBar({ settings, defaults, onChange, onToggleMotion, onResetView, onResetSettings, onLayout }) {
  const presets = createPresets(defaults);
  const dock = document.createElement('section');
  dock.className = 'settings-dock';
  dock.setAttribute('aria-label', '场景设置');
  dock.innerHTML = `
    <div class="settings-header">
      <div class="settings-heading">
        <span class="settings-emblem">${svg('settings')}</span>
        <div><h1>场景设置</h1><p class="settings-status"><span class="status-dot"></span><span data-status>正在加载场景</span></p></div>
      </div>
      <div class="settings-actions">
        <button type="button" class="dock-button motion-button" data-action="motion" aria-label="暂停动效" title="暂停动效">${svg('pause')}<span class="action-text">暂停动效</span></button>
        <button type="button" class="dock-button" data-action="view" aria-label="视角复位" title="视角复位">${svg('reset')}<span class="action-text">视角复位</span></button>
        <button type="button" class="dock-button collapse-button" data-action="collapse" aria-expanded="true" aria-controls="settings-content" aria-label="收起设置" title="收起设置">${svg('chevron')}</button>
      </div>
    </div>
    <div id="settings-content">
      <div class="settings-grid">
        <label class="setting-field"><span>画质预设</span><select name="preset" aria-label="画质预设"><option value="economy">节能</option><option value="balanced">平衡</option><option value="detailed">精细</option><option value="custom" disabled>自定义</option></select></label>
        <label class="setting-field"><span>帧率上限</span><select name="fps" aria-label="帧率上限">${[6, 12, 24, 30, 45, 60].map(fps => `<option value="${fps}">${fps} FPS</option>`).join('')}</select></label>
        <label class="setting-field"><span>渲染精度</span><select name="resolution" aria-label="渲染精度"><option value="economy">节能 · 65%</option><option value="standard">标准 · 100%</option><option value="high">精细 · 135%</option></select></label>
        <label class="setting-field"><span>阴影质量</span><select name="shadows" aria-label="阴影质量"><option value="off">关闭</option><option value="low">低 · 512</option><option value="medium">标准 · 1536</option><option value="high">高 · 2048</option></select></label>
        <label class="setting-field"><span>积水反射</span><select name="reflections" aria-label="积水反射"><option value="off">关闭</option><option value="low">节能</option><option value="medium">标准</option><option value="high">精细</option></select></label>
        <label class="setting-field range-field"><span>雨量<output data-output="rain" for="setting-rain"></output></span><input id="setting-rain" name="rain" type="range" min="0" max="100" step="1" aria-label="雨量" /></label>
      </div>
      <div id="advanced-settings" class="advanced-settings" hidden>
        <label class="setting-field range-field"><span>画面亮度<output data-output="exposure" for="setting-exposure"></output></span><input id="setting-exposure" name="exposure" type="range" min="70" max="145" step="1" aria-label="画面亮度" /></label>
        <label class="setting-field range-field"><span>灯光辉光<output data-output="bloom" for="setting-bloom"></output></span><input id="setting-bloom" name="bloom" type="range" min="0" max="60" step="1" aria-label="灯光辉光" /></label>
      </div>
      <div class="settings-footer">
        <button type="button" class="text-button" data-action="advanced" aria-expanded="false" aria-controls="advanced-settings">更多参数${svg('chevron')}</button>
        <span class="save-hint" data-save-hint>设置自动保存</span>
        <button type="button" class="text-button reset-settings" data-action="defaults">恢复默认</button>
      </div>
    </div>
  `;
  document.body.appendChild(dock);

  const content = dock.querySelector('#settings-content');
  const advanced = dock.querySelector('#advanced-settings');
  const collapseButton = dock.querySelector('[data-action="collapse"]');
  const advancedButton = dock.querySelector('[data-action="advanced"]');
  const motionButton = dock.querySelector('[data-action="motion"]');
  const statusText = dock.querySelector('[data-status]');
  const fields = Object.fromEntries([...dock.querySelectorAll('select[name], input[name]')].map(field => [field.name, field]));
  const outputs = Object.fromEntries([...dock.querySelectorAll('output')].map(output => [output.dataset.output, output]));
  const events = new AbortController();
  let collapsed = false, previousInset = 0, lastPaused = null, lastStatus = '', currentSettings = { ...settings };

  function measure(notify = true) {
    const inset = window.innerHeight - dock.getBoundingClientRect().top + 18;
    if (Math.abs(inset - previousInset) < 1) return;
    previousInset = inset;
    if (notify) onLayout();
  }

  function sync(next) {
    currentSettings = { ...next };
    // URL-based bounded tests can use frame rates between the standard choices.
    if (![...fields.fps.options].some(option => option.value === String(next.fps))) {
      fields.fps.add(new Option(`${next.fps} FPS`, String(next.fps)));
    }
    for (const [key, value] of Object.entries(next)) {
      const field = fields[key];
      if (!field) continue;
      field.value = value;
      if (field.type === 'range') {
        const progress = (value - Number(field.min)) / (Number(field.max) - Number(field.min)) * 100;
        field.style.setProperty('--range-progress', `${progress}%`);
        field.setAttribute('aria-valuetext', key === 'rain' && value === 0 ? '停雨' : `${value}%`);
        outputs[key].value = key === 'rain' && value === 0 ? '停雨' : `${value}%`;
      }
    }
    fields.preset.value = matchingPreset(next, presets);
  }

  function handleChange(event) {
    const field = event.target;
    if (!field.matches('select[name], input[type="range"]')) return;
    if (field.name === 'preset') onChange(presets[field.value]);
    else onChange({ [field.name]: field.type === 'range' || field.name === 'fps' ? Number(field.value) : field.value }, { persist: event.type === 'change' });
  }

  dock.addEventListener('input', event => {
    if (event.target.matches('input[type="range"]')) handleChange(event);
  }, { signal: events.signal });
  dock.addEventListener('change', handleChange, { signal: events.signal });
  dock.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'motion') onToggleMotion();
    if (button.dataset.action === 'view') onResetView();
    if (button.dataset.action === 'defaults') onResetSettings();
    if (button.dataset.action === 'collapse') {
      collapsed = !collapsed;
      content.hidden = collapsed;
      dock.classList.toggle('is-collapsed', collapsed);
      collapseButton.setAttribute('aria-expanded', String(!collapsed));
      collapseButton.setAttribute('aria-label', collapsed ? '展开设置' : '收起设置');
      collapseButton.title = collapsed ? '展开设置' : '收起设置';
      measure();
    }
    if (button.dataset.action === 'advanced') {
      advanced.hidden = !advanced.hidden;
      advancedButton.setAttribute('aria-expanded', String(!advanced.hidden));
      measure();
    }
  }, { signal: events.signal });

  // Settings never forward pointer or wheel gestures to the 3D scene.
  dock.addEventListener('pointerdown', event => event.stopPropagation(), { signal: events.signal });
  dock.addEventListener('wheel', event => event.stopPropagation(), { signal: events.signal, passive: true });
  sync(settings);
  measure(false);
  const observer = new ResizeObserver(() => measure());
  observer.observe(dock);

  return {
    sync,
    getInset() { return window.innerHeight - dock.getBoundingClientRect().top + 18; },
    updateStatus({ paused, hidden }) {
      const status = `${hidden ? '后台已暂停' : paused ? '动效已暂停' : '动效播放中'} · ${currentSettings.fps} FPS 上限`;
      if (lastStatus !== status) { statusText.textContent = status; lastStatus = status; }
      dock.dataset.paused = String(paused || hidden);
      if (lastPaused !== paused) {
        lastPaused = paused;
        const label = paused ? '播放动效' : '暂停动效';
        motionButton.innerHTML = `${svg(paused ? 'play' : 'pause')}<span class="action-text">${label}</span>`;
        motionButton.setAttribute('aria-label', label);
        motionButton.title = label;
      }
    },
    setStorageAvailable(available) { dock.querySelector('[data-save-hint]').textContent = available ? '设置自动保存' : '设置仅本次有效'; },
    dispose() { events.abort(); observer.disconnect(); dock.remove(); },
  };
}
