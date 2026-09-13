import * as THREE from 'three';
import { canvasTexture, japaneseFont, random, imageMaterial } from './kit.js';

export const asphalt = canvasTexture(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#39495f'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 26000; i++) {
    const v = random();
    ctx.fillStyle = v > .5 ? `rgba(181,199,211,${random() * .1})` : `rgba(7,19,40,${random() * .13})`;
    ctx.fillRect(random() * w, random() * h, random() * 1.8 + .4, .7);
  }
  for (let i = 0; i < 20; i++) {
    let x = random() * w, y = random() * h;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let j = 0; j < 5; j++) { x += random() * 18 - 8; y += random() * 14; ctx.lineTo(x, y); }
    ctx.strokeStyle = '#2d3c501a'; ctx.lineWidth = .8; ctx.stroke();
  }
});
asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
asphalt.repeat.set(4, 4);

export const brand = canvasTexture(2048, 224, (ctx, w, h) => {
  ctx.fillStyle = '#fff2d9'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#3b9690'; ctx.fillRect(0, 0, w, 21); ctx.fillRect(0, h - 25, w, 25);
  ctx.fillStyle = '#eeaf81'; ctx.fillRect(0, 23, w, 7); ctx.fillRect(0, h - 34, w, 6);
  ctx.strokeStyle = '#267d78'; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(133, 116, 65, Math.PI, 2 * Math.PI); ctx.lineTo(68, 116); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(133, 111); ctx.lineTo(133, 161); ctx.quadraticCurveTo(133, 187, 163, 170); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(133, 50); ctx.quadraticCurveTo(90, 80, 94, 116); ctx.moveTo(133, 50); ctx.quadraticCurveTo(169, 80, 172, 116); ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = '#276e69'; ctx.textBaseline = 'middle';
  ctx.font = `800 130px ${japaneseFont}`; ctx.fillText('雨宿り', 260, 119);
  ctx.font = '600 49px "Trebuchet MS", sans-serif';
  let x = 776; for (const c of 'AMAYORI') { ctx.fillText(c, x, 109); x += ctx.measureText(c).width + 12; }
  ctx.font = `400 24px ${japaneseFont}`; ctx.fillText('あなたの街の、ちいさな灯り。', 782, 159);
  ctx.fillStyle = '#4a8f86'; ctx.fillRect(1520, 56, 2, 115);
  ctx.font = '800 105px "Arial", sans-serif'; ctx.fillText('24', 1580, 110);
  ctx.font = '600 33px "Arial", sans-serif'; ctx.fillText('HOURS', 1734, 95); ctx.fillText('OPEN', 1734, 138);
});

export function posterTexture(kind = 'onigiri') {
  return canvasTexture(384, 512, (ctx, w, h) => {
    const colors = { onigiri: ['#f6ecd2', '#da7859'], coffee: ['#f0dbc0', '#694d47'], soda: ['#d6eceb', '#387e8c'], community: ['#ece6cc', '#326d65'] };
    const [bg, accent] = colors[kind];
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = accent; ctx.fillRect(18, 18, w - 36, 58);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = bg;
    ctx.font = `700 29px ${japaneseFont}`; ctx.fillText(kind === 'onigiri' ? 'できたての、おいしさ。' : kind === 'coffee' ? 'ほっと、ひと息。' : kind === 'soda' ? '夏の、ひとしずく。' : 'まちのお知らせ', w / 2, 46);
    if (kind === 'onigiri') {
      ctx.fillStyle = '#d2be94'; ctx.beginPath(); ctx.ellipse(192, 302, 119, 21, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fffcdf'; ctx.beginPath(); ctx.moveTo(182, 129); ctx.quadraticCurveTo(194, 111, 207, 132); ctx.lineTo(304, 282); ctx.quadraticCurveTo(316, 308, 280, 314); ctx.lineTo(108, 314); ctx.quadraticCurveTo(69, 309, 91, 278); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#293c3d'; ctx.fillRect(154, 238, 77, 86);
      ctx.fillStyle = '#cc7857'; ctx.beginPath(); ctx.arc(191, 198, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = accent; ctx.font = `800 51px ${japaneseFont}`; ctx.fillText('おにぎり', 192, 374);
      ctx.font = '700 56px sans-serif'; ctx.fillText('¥120', 192, 445);
    } else if (kind === 'coffee') {
      ctx.fillStyle = '#a78268'; ctx.beginPath(); ctx.ellipse(192, 313, 105, 17, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fbf3dd'; ctx.beginPath(); ctx.moveTo(101, 178); ctx.lineTo(280, 178); ctx.lineTo(260, 313); ctx.lineTo(121, 313); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fbf3dd'; ctx.lineWidth = 18; ctx.beginPath(); ctx.arc(280, 226, 36, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      ctx.fillStyle = '#61483d'; ctx.beginPath(); ctx.ellipse(190, 180, 89, 19, 0, 0, 2 * Math.PI); ctx.fill();
      ctx.strokeStyle = '#a78268'; ctx.lineWidth = 6;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(152 + i * 40, 148); ctx.bezierCurveTo(129 + i * 40, 121, 175 + i * 40, 113, 156 + i * 40, 91); ctx.stroke(); }
      ctx.fillStyle = accent; ctx.font = '800 48px sans-serif'; ctx.fillText('COFFEE', 192, 379); ctx.font = '600 42px sans-serif'; ctx.fillText('¥100', 192, 446);
    } else if (kind === 'soda') {
      for (let i = 0; i < 32; i++) { ctx.strokeStyle = '#ffffff77'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(random() * 340 + 22, random() * 200 + 100, random() * 14 + 3, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = '#539b9c'; ctx.fillRect(147, 149, 90, 169); ctx.fillRect(166, 117, 52, 44);
      ctx.fillStyle = '#e9eecf'; ctx.fillRect(147, 216, 90, 68); ctx.font = '800 26px sans-serif'; ctx.fillStyle = '#377f7d'; ctx.fillText('RAMUNE', 192, 250);
      ctx.fillStyle = accent; ctx.font = `800 44px ${japaneseFont}`; ctx.fillText('ひんやり。', 192, 375); ctx.font = '700 50px sans-serif'; ctx.fillText('¥140', 192, 447);
    } else {
      ctx.fillStyle = accent; ctx.font = `700 43px ${japaneseFont}`; ctx.fillText('あめの日も', 192, 153); ctx.fillText('この街で。', 192, 210);
      ctx.strokeStyle = '#a2b2a3'; ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(50, 290 + i * 28); ctx.lineTo(334 - (i % 2) * 45, 290 + i * 28); ctx.stroke(); }
      ctx.font = `500 26px ${japaneseFont}`; ctx.fillText('商店街だより　09 / 13', 192, 468);
    }
    ctx.strokeStyle = '#ffffff70'; ctx.lineWidth = 3; ctx.strokeRect(8, 8, w - 16, h - 16);
  });
}

export const posters = Object.fromEntries(['onigiri', 'coffee', 'soda', 'community'].map(key => [key, imageMaterial(posterTexture(key), .22)]));

export const magazineTextures = ['#bf705e', '#5d8798', '#94a28c', '#caaf6f'].map((color, i) => canvasTexture(192, 256, (ctx, w, h) => {
  ctx.fillStyle = '#e8e5d4'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = color; ctx.fillRect(9, 42, w - 18, 160);
  ctx.fillStyle = '#f3ebcf'; ctx.beginPath(); ctx.arc(98, 111, 36, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = '#425761'; ctx.beginPath(); ctx.moveTo(12, 190); ctx.lineTo(70, 102); ctx.lineTo(119, 152); ctx.lineTo(145, 129); ctx.lineTo(182, 190); ctx.fill();
  ctx.fillStyle = '#344b4e'; ctx.font = `800 27px ${japaneseFont}`; ctx.textAlign = 'center'; ctx.fillText(['暮らし', 'TRIP', 'POPEYE', '喫茶時間'][i], 96, 31);
  ctx.fillStyle = '#56676a'; ctx.fillRect(15, 218, 158, 4); ctx.fillRect(15, 230, 117, 3);
}));

export const floorTexture = canvasTexture(512, 512, ctx => {
  ctx.fillStyle = '#dfd2b4'; ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = '#b9b29d'; ctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 128) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke(); }
  for (let i = 0; i < 1800; i++) { ctx.fillStyle = '#a8997b0c'; ctx.fillRect(random() * 512, random() * 512, 2, 2); }
});
floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
floorTexture.repeat.set(3, 2.3);

export const manholeTexture = canvasTexture(256, 256, ctx => {
  ctx.fillStyle = '#3d5165'; ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#7b8d98'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(128, 128, 115, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(128, 128, 100, 0, Math.PI * 2); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.arc(128, 128, 94, 0, Math.PI * 2); ctx.clip(); ctx.lineWidth = 3;
  for (let i = -100; i < 400; i += 22) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 256, 256); ctx.moveTo(i, 0); ctx.lineTo(i - 256, 256); ctx.stroke(); }
  ctx.restore(); ctx.fillStyle = '#3d5165'; ctx.beginPath(); ctx.arc(128, 128, 36, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8c9da4'; ctx.font = `700 24px ${japaneseFont}`; ctx.textAlign = 'center'; ctx.fillText('雨水', 128, 137);
});
