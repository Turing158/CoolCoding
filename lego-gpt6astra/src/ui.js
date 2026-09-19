export function bindUi(state, actions) {
  const byId = id => document.getElementById(id);
  let toastTimer = 0;
  let photoUrl = null;
  const photoDialog = byId('photo-dialog');
  byId('photo-close').addEventListener('click', () => photoDialog.close());
  photoDialog.addEventListener('close', () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = null;
    byId('photo-preview').removeAttribute('src');
    byId('photo-download').removeAttribute('href');
    actions.closeCapture();
  });
  const ranges = ['detail', 'glass', 'explode', 'speed'];
  const rangeLabels = {
    detail: value => ['简约', '标准', '丰富'][value],
    glass: value => `${value}%`,
    explode: value => `${value}%`,
    speed: value => `${Number(value).toFixed(Number(value) % .5 === 0 ? 1 : 2)}×`,
  };
  const setRange = (id, value) => {
    const input = byId(id);
    input.value = String(value);
    const fill = (Number(value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100;
    input.style.setProperty('--fill', `${fill}%`);
    byId(`${id}-value`).textContent = rangeLabels[id](value);
  };
  const update = () => {
    ranges.forEach(id => setRange(id, state[id]));
    byId('fps').value = String(state.fps);
    for (const id of ['shell', 'particles', 'shadows', 'rotate', 'solo']) byId(id).checked = state[id];
    byId('solo').disabled = state.selected === 'all';
    document.querySelectorAll('[data-preset]').forEach(button => {
      const active = button.dataset.preset === state.preset;
      button.classList.toggle('selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('[data-floor]').forEach(button => {
      const active = button.dataset.floor === String(state.selected);
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    byId('preset-note').textContent = { eco: '轻轻运行，慢慢欣赏', balanced: '流畅与细节，刚刚好', fine: '近一点，再近一点', custom: '按你喜欢的样子' }[state.preset];
    byId('pause').setAttribute('aria-pressed', String(state.paused));
    byId('pause').setAttribute('aria-label', state.paused ? '继续小城' : '暂停小城');
    byId('pause-text').textContent = state.paused ? '继续时光' : '暂停时光';
    byId('pause-icon').innerHTML = state.paused ? '<path d="m8 4 11 8-11 8V4Z"/>' : '<path d="M8 5v14M16 5v14"/>';
    byId('live-state').textContent = state.paused ? 'PAUSED' : 'LIVE';
    byId('control-panel').classList.toggle('collapsed', !state.panel);
    byId('control-panel').inert = !state.panel;
    byId('panel-toggle').setAttribute('aria-expanded', String(state.panel));
    document.body.classList.toggle('zen', state.zen);
    byId('exit-zen').hidden = !state.zen;
  };
  const toast = message => {
    clearTimeout(toastTimer);
    byId('toast').textContent = message;
    byId('toast').classList.add('visible');
    toastTimer = setTimeout(() => byId('toast').classList.remove('visible'), 2700);
  };
  ranges.forEach(id => byId(id).addEventListener('input', event => actions.setting(id, Number(event.target.value))));
  byId('fps').addEventListener('change', event => actions.setting('fps', Number(event.target.value)));
  for (const id of ['shell', 'particles', 'shadows', 'rotate', 'solo']) byId(id).addEventListener('change', event => actions.setting(id, event.target.checked));
  document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => actions.preset(button.dataset.preset)));
  document.querySelectorAll('[data-floor]').forEach(button => button.addEventListener('click', () => actions.floor(button.dataset.floor)));
  byId('pause').addEventListener('click', actions.pause);
  byId('reset').addEventListener('click', actions.reset);
  byId('capture').addEventListener('click', actions.capture);
  byId('zen').addEventListener('click', actions.zen);
  byId('exit-zen').addEventListener('click', actions.zen);
  byId('panel-toggle').addEventListener('click', () => actions.setting('panel', !state.panel));
  update();
  return {
    update, toast,
    showCapture(blob, filename) {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      photoUrl = URL.createObjectURL(blob);
      byId('photo-preview').src = photoUrl;
      byId('photo-download').href = photoUrl;
      byId('photo-download').download = filename;
      photoDialog.showModal();
    },
    caption(message) { byId('scene-caption').textContent = message; },
    stats(fps, frameMs, stopped) {
      byId('actual-fps').textContent = stopped ? '—' : String(Math.round(fps));
      byId('fps-unit').textContent = stopped ? '静止' : 'FPS';
      byId('render-info').textContent = `${frameMs.toFixed(1)} ms · ${['简约', '标准', '丰富'][state.detail]}细节`;
      byId('live-state').textContent = stopped ? 'RESTING' : state.paused ? 'PAUSED' : 'LIVE';
      byId('performance-dot').style.background = stopped || fps > state.fps * .82 ? '#94a67b' : '#bc9659';
    },
    ready() {
      byId('loading').classList.add('done');
      setTimeout(() => { byId('loading').hidden = true; }, 450);
    },
  };
}
