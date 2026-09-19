import * as THREE from 'three';
import { seededRandom } from './kit.js';

function canvasTexture(width, height, draw, repeat = [1, 1]) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = 4;
  return texture;
}

function tileTexture() {
  return canvasTexture(256, 512, (ctx, w, h) => {
    const random = seededRandom(882);
    ctx.fillStyle = '#225485';
    ctx.fillRect(0, 0, w, h);
    for (let y = -64; y < h; y += 64) {
      for (let x = 0; x < w; x += 64) {
        const light = 25 + random() * 9;
        const glaze = ctx.createLinearGradient(x, 0, x + 64, 0);
        glaze.addColorStop(0, `hsl(211 58% ${light - 12}%)`);
        glaze.addColorStop(.18, `hsl(209 55% ${light + 4}%)`);
        glaze.addColorStop(.5, `hsl(210 51% ${light + 1}%)`);
        glaze.addColorStop(1, `hsl(212 58% ${light - 7}%)`);
        ctx.fillStyle = glaze;
        ctx.fillRect(x, y, 64, 64);
        ctx.fillStyle = '#103450b8';
        ctx.fillRect(x, y + 61, 64, 3);
        ctx.fillStyle = '#76adbf65';
        ctx.fillRect(x + 2, y + 58, 59, 2);
        ctx.strokeStyle = '#122f564a';
        ctx.lineWidth = .8;
        for (let line = 0; line < 4; line++) {
          const xx = x + random() * 64;
          ctx.beginPath(); ctx.moveTo(xx, y + 5); ctx.lineTo(xx + random() * 3, y + 57); ctx.stroke();
        }
      }
    }
    for (let i = 0; i < 6500; i++) {
      ctx.fillStyle = random() > .5 ? '#b2dce110' : '#02132a10';
      ctx.fillRect(random() * w, random() * h, 1 + random(), 1 + random() * 2);
    }
  });
}

function paintedTexture() {
  return canvasTexture(1024, 256, (ctx, w, h) => {
    ctx.fillStyle = '#163e60'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#297b76'; ctx.fillRect(0, 32, w, 192);
    ctx.strokeStyle = '#caac60'; ctx.lineWidth = 4;
    [8, 24, 43, 211, 230, 248].forEach((y) => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); });
    for (let tile = 0; tile < 4; tile++) {
      const x = tile * 256;
      ctx.fillStyle = '#123c65';
      ctx.beginPath(); ctx.moveTo(x + 10, 128); ctx.lineTo(x + 75, 57); ctx.lineTo(x + 182, 57); ctx.lineTo(x + 246, 128); ctx.lineTo(x + 182, 199); ctx.lineTo(x + 75, 199); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.translate(x + 128, 128);
      ctx.strokeStyle = '#f0d58a'; ctx.lineWidth = 2.2;
      for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-28, -19, -19, -47, 0, -54); ctx.bezierCurveTo(19, -47, 28, -19, 0, 0); ctx.stroke();
      }
      ctx.fillStyle = '#b17b39'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      for (const direction of [-1, 1]) {
        ctx.save(); ctx.translate(x + 128 + direction * 85, 128); ctx.scale(direction, 1);
        ctx.strokeStyle = '#ddc577'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-27, 0); ctx.bezierCurveTo(0, -27, 34, -22, 23, -2); ctx.bezierCurveTo(8, 18, -8, -8, 9, -10); ctx.stroke(); ctx.restore();
      }
      ctx.strokeStyle = '#9cb994'; ctx.lineWidth = 2;
      for (let k = 0; k < 8; k++) { ctx.strokeRect(x + k * 32 + 3, 11, 23, 10); ctx.strokeRect(x + k * 32 + 3, 234, 23, 10); }
    }
  });
}

function marbleTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    const random = seededRandom(434);
    ctx.fillStyle = '#e4e1d5'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 12000; i++) {
      const alpha = random() * .065;
      ctx.fillStyle = `rgba(95, 105, 104, ${alpha})`;
      ctx.fillRect(random() * w, random() * h, random() * 3 + 1, random() * 2 + 1);
    }
    ctx.lineWidth = .65;
    for (let i = 0; i < 18; i++) {
      ctx.strokeStyle = '#7e938416';
      const y = random() * h;
      ctx.beginPath(); ctx.moveTo(-10, y); ctx.bezierCurveTo(140, y + 50, 340, y - 35, 530, y + 25); ctx.stroke();
    }
    ctx.strokeStyle = '#a5aa9c70'; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 510, 510);
  }, [4, 1]);
}

function shutterTexture() {
  return canvasTexture(256, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#832e24'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1b3234'; ctx.fillRect(22, 42, 212, 570);
    ctx.save(); ctx.beginPath(); ctx.rect(25, 45, 206, 565); ctx.clip();
    ctx.strokeStyle = '#c48d54'; ctx.lineWidth = 6;
    for (let y = -220; y < 900; y += 48) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y + 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(256, y); ctx.lineTo(0, y + 256); ctx.stroke();
    }
    ctx.strokeStyle = '#d8ad6b'; ctx.lineWidth = 2;
    for (let y = 100; y < 570; y += 96) { ctx.strokeRect(73, y, 110, 55); }
    ctx.restore();
    ctx.strokeStyle = '#caa464'; ctx.lineWidth = 5; ctx.strokeRect(17, 32, 222, 591);
    ctx.strokeStyle = '#572119'; ctx.lineWidth = 8; ctx.strokeRect(20, 662, 216, 328);
    ctx.strokeStyle = '#bd7744'; ctx.lineWidth = 3; ctx.strokeRect(32, 674, 192, 304);
    ctx.fillStyle = '#a13e28'; ctx.fillRect(49, 699, 158, 251);
    ctx.strokeStyle = '#cfaa65'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(128, 721); ctx.lineTo(191, 821); ctx.lineTo(128, 925); ctx.lineTo(66, 821); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.arc(128, 821, 31, 0, Math.PI * 2); ctx.stroke();
  });
}

function plaqueTexture() {
  return canvasTexture(1024, 384, (ctx, w, h) => {
    ctx.fillStyle = '#112c4c'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d5b568'; ctx.lineWidth = 17; ctx.strokeRect(13, 13, w - 26, h - 26);
    ctx.lineWidth = 3; ctx.strokeRect(37, 35, w - 74, h - 70);
    ctx.fillStyle = '#efd493'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '228px STKaiti, KaiTi, SimSun, serif';
    ctx.fillText('祈 年 殿', w / 2, h / 2 + 4, 810);
    for (let x = 64; x < w; x += 44) { ctx.fillRect(x, 21, 11, 5); ctx.fillRect(x, h - 27, 11, 5); }
  });
}

function dragonTexture() {
  return canvasTexture(256, 768, (ctx, w, h) => {
    ctx.fillStyle = '#c4c6b9'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#f1eee0'; ctx.lineWidth = 4; ctx.strokeRect(10, 10, w - 20, h - 20);
    for (let y = 50; y < h; y += 72) {
      for (let x = 40; x < w; x += 92) {
        ctx.strokeStyle = '#ecebdc'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(x, y, 21, .3, Math.PI * 1.8); ctx.bezierCurveTo(x + 31, y + 9, x + 45, y - 25, x + 10, y - 35); ctx.stroke();
      }
    }
    ctx.strokeStyle = '#8d9c8b'; ctx.lineWidth = 19;
    ctx.beginPath(); ctx.moveTo(133, 690); ctx.bezierCurveTo(230, 590, 17, 480, 138, 388); ctx.bezierCurveTo(222, 303, 45, 203, 126, 89); ctx.stroke();
    ctx.strokeStyle = '#eeeddf'; ctx.lineWidth = 12; ctx.stroke();
    ctx.lineWidth = 6;
    for (let i = 0; i < 11; i++) {
      const y = 120 + i * 49; const x = 128 + Math.sin(i * .9) * 39;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 29, y + 22); ctx.lineTo(x - 42, y + 9); ctx.stroke();
    }
    ctx.fillStyle = '#edeada'; ctx.beginPath(); ctx.ellipse(124, 77, 23, 33, -.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(115, 60); ctx.lineTo(87, 33); ctx.lineTo(96, 63); ctx.moveTo(137, 63); ctx.lineTo(163, 36); ctx.stroke();
  });
}

export function createGroundTexture() {
  return canvasTexture(1024, 1024, (ctx, w, h) => {
    const random = seededRandom(672);
    ctx.fillStyle = '#a9afa3'; ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 16; row++) {
      for (let col = -1; col < 9; col++) {
        const value = 68 + random() * 7;
        ctx.fillStyle = `hsl(69, 8%, ${value}%)`;
        const x = col * 128 + row % 2 * 64;
        const y = row * 64;
        ctx.fillRect(x + 1.3, y + 1.3, 125.4, 61.4);
        ctx.fillStyle = '#edf0da25'; ctx.fillRect(x + 3, y + 3, 121, 1);
      }
    }
    for (let i = 0; i < 28000; i++) {
      ctx.fillStyle = random() > .5 ? '#ffffff12' : '#40513d12';
      ctx.fillRect(random() * w, random() * h, 1, 1);
    }
  }, [20, 20]);
}

export function createSkyTexture() {
  return canvasTexture(1024, 512, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#529bc8'); gradient.addColorStop(.28, '#7fb5d3'); gradient.addColorStop(.48, '#9abbd5'); gradient.addColorStop(.53, '#9abbd5'); gradient.addColorStop(1, '#9abbd5');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    const random = seededRandom(81);
    for (let i = 0; i < 36; i++) {
      const x = random() * w; const y = 50 + random() * 145;
      ctx.save(); ctx.translate(x, y); ctx.scale(4.5, .55);
      const cloud = ctx.createRadialGradient(0, 0, 0, 0, 0, 15);
      cloud.addColorStop(0, '#ffffff75'); cloud.addColorStop(1, '#ffffff00');
      ctx.fillStyle = cloud; ctx.fillRect(-16, -16, 32, 32); ctx.restore();
    }
    const sun = ctx.createRadialGradient(210, 138, 0, 210, 138, 95);
    sun.addColorStop(0, '#fff9d5c0'); sun.addColorStop(.15, '#ffffed42'); sun.addColorStop(1, '#ffffee00');
    ctx.fillStyle = sun; ctx.fillRect(100, 25, 230, 230);
  });
}

export function createMaterials() {
  const tiles = tileTexture();
  const paint = paintedTexture();
  paint.repeat.set(6, 1);
  const marble = marbleTexture();
  const shutter = shutterTexture();
  const dragon = dragonTexture();
  const standard = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .72, ...extra });
  return {
    roof: standard('#ffffff', { map: tiles, roughness: .31, metalness: .2, bumpMap: tiles, bumpScale: .045 }),
    roofRib: standard('#326a96', { roughness: .29, metalness: .22 }),
    roofEdge: standard('#153e68', { roughness: .31, metalness: .22 }),
    underRoof: standard('#214b59', { roughness: .72 }),
    red: standard('#922c20', { roughness: .49 }),
    deepRed: standard('#68251f'),
    gold: standard('#d7ae53', { roughness: .3, metalness: .72 }),
    mutedGold: standard('#c5ab69', { roughness: .46, metalness: .4 }),
    jade: standard('#2c786d'),
    blue: standard('#224764'),
    paint: standard('#ffffff', { map: paint, roughness: .59 }),
    marble: standard('#fffbee', { map: marble, bumpMap: marble, bumpScale: .025, roughness: .84 }),
    white: standard('#eeeade', { roughness: .73 }),
    marbleShade: standard('#c9cbbb'),
    shutter: standard('#ffffff', { map: shutter, roughness: .62 }),
    plaque: standard('#ffffff', { map: plaqueTexture(), roughness: .52, metalness: .1 }),
    carving: standard('#ebeadd', { map: dragon, bumpMap: dragon, bumpScale: .1 }),
    foliage: standard('#52684a'),
    trunk: standard('#69523d'),
    grass: standard('#929b6d'),
    paving: standard('#eeeadd', { map: createGroundTexture(), roughness: .93 }),
    dark: standard('#253e36'),
  };
}
