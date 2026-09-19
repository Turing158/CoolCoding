/**
 * ui.js —— 画面左上角的可折叠设置条
 *
 * 说明：这一条是悬浮在画布之上的调试/性能面板，不属于三维场景本身。
 * 场景内部（模型上）没有任何 UI 元素。
 */

const $ = (id) => document.getElementById(id);

export function createUI({ settings, shadowPresets, onChange, onView, onReset, onAutoRotate }) {
  const root = $('ui-root');
  const toggle = $('ui-toggle');
  const stats = $('ui-stats');

  const els = {
    fpsLimit: $('fpsLimit'),
    fpsLimitVal: $('fpsLimitVal'),
    shadowQuality: $('shadowQuality'),
    shadowQualityVal: $('shadowQualityVal'),
    renderScale: $('renderScale'),
    renderScaleVal: $('renderScaleVal'),
    outline: $('outline'),
    outlineVal: $('outlineVal'),
    reflection: $('reflection'),
    wetShine: $('wetShine'),
    rainAmount: $('rainAmount'),
    rainAmountVal: $('rainAmountVal'),
    splash: $('splash'),
    autoDoor: $('autoDoor'),
    flicker: $('flicker'),
  };

  const viewButtons = [...document.querySelectorAll('[data-view]')];
  const actionButtons = [...document.querySelectorAll('[data-action]')];

  let collapsed = true;
  root.classList.toggle('ui-collapsed', collapsed);

  toggle.addEventListener('click', () => {
    collapsed = !collapsed;
    root.classList.toggle('ui-collapsed', collapsed);
  });

  function syncLabels() {
    els.fpsLimitVal.textContent = `${settings.fpsLimit} FPS`;
    els.shadowQualityVal.textContent = shadowPresets[settings.shadowQuality].name;
    els.renderScaleVal.textContent = `${settings.renderScale}%`;
    els.outlineVal.textContent = settings.outline ? '开' : '关';
  }

  function push(patch) {
    Object.assign(settings, patch);
    syncLabels();
    onChange(patch);
  }

  /* --- 帧率上限 --- */
  els.fpsLimit.addEventListener('input', () => {
    push({ fpsLimit: Number(els.fpsLimit.value) });
  });

  /* --- 阴影质量 --- */
  els.shadowQuality.addEventListener('input', () => {
    push({ shadowQuality: Number(els.shadowQuality.value) });
  });

  /* --- 渲染倍率 --- */
  els.renderScale.addEventListener('input', () => {
    push({ renderScale: Number(els.renderScale.value) });
  });

  /* --- 轮廓线 --- */
  els.outline.addEventListener('input', () => {
    push({ outline: Number(els.outline.value) === 1 });
  });

  /* --- 复选开关 --- */
  for (const [key, el] of [
    ['reflection', els.reflection],
    ['wetShine', els.wetShine],
    ['splash', els.splash],
    ['autoDoor', els.autoDoor],
    ['flicker', els.flicker],
  ]) {
    el.addEventListener('change', () => push({ [key]: el.checked }));
  }

  /* --- 雨量 --- */
  els.rainAmount.addEventListener('input', () => {
    const v = Number(els.rainAmount.value);
    els.rainAmountVal.textContent = `${v}%`;
    push({ rainAmount: v });
  });

  /* --- 视角 --- */
  for (const b of viewButtons) {
    b.addEventListener('click', () => {
      viewButtons.forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      onView(b.dataset.view);
    });
  }

  /* --- 动作按钮 --- */
  for (const b of actionButtons) {
    b.addEventListener('click', () => {
      const a = b.dataset.action;
      if (a === 'reset') {
        viewButtons.forEach((x) => x.classList.remove('active'));
        onReset();
      } else if (a === 'auto') {
        const next = !b.classList.contains('active');
        b.classList.toggle('active', next);
        onAutoRotate(next);
      }
    });
  }

  /* --- 键盘快捷键（不产生任何场景内 UI） --- */
  window.addEventListener('keydown', (e) => {
    if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    const map = { '1': 'hero', '2': 'front', '3': 'top', '4': 'alley' };
    if (map[e.key]) {
      viewButtons.forEach((x) => x.classList.toggle('active', x.dataset.view === map[e.key]));
      onView(map[e.key]);
    }
    if (e.key === 'h' || e.key === 'H') {
      collapsed = !collapsed;
      root.classList.toggle('ui-collapsed', collapsed);
    }
  });

  syncLabels();

  return {
    syncLabels,
    setAutoRotate(on) {
      const b = actionButtons.find((x) => x.dataset.action === 'auto');
      if (b) b.classList.toggle('active', on);
    },
    reset() {
      // 把控件恢复为默认值
      const defaults = {
        fpsLimit: 40,
        shadowQuality: 2,
        renderScale: 100,
        outline: 1,
        rainAmount: 100,
      };
      els.fpsLimit.value = defaults.fpsLimit;
      els.shadowQuality.value = defaults.shadowQuality;
      els.renderScale.value = defaults.renderScale;
      els.outline.value = defaults.outline;
      els.rainAmount.value = defaults.rainAmount;
      for (const el of [els.reflection, els.wetShine, els.splash, els.autoDoor, els.flicker]) {
        el.checked = true;
      }
      els.rainAmountVal.textContent = `${defaults.rainAmount}%`;
      push({
        fpsLimit: defaults.fpsLimit,
        shadowQuality: defaults.shadowQuality,
        renderScale: defaults.renderScale,
        outline: true,
        reflection: true,
        wetShine: true,
        rainAmount: defaults.rainAmount,
        splash: true,
        autoDoor: true,
        flicker: true,
      });
    },
    set(key, value) {
      const el = els[key];
      if (!el) return;
      if (el.type === 'range') el.value = value;
      syncLabels();
    },
    setStats(text) {
      stats.textContent = text;
    },
  };
}