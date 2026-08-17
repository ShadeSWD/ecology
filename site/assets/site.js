/* Общий каркас страниц сайта «Промышленная экология»: шапка, навигация,
 * подвал, общие SVG-маркеры. Пути относительные — сайт работает под любым
 * префиксом (например /ecology/). Требует common.js (onReady). */
'use strict';
(function () {
  const me = document.currentScript;
  const root = (me && me.dataset.root) || './';
  const page = (me && me.dataset.page) || '';

  const logoSvg = `
  <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
    <rect x="1" y="1" width="28" height="28" rx="6" fill="#15803d"/>
    <text x="15" y="22" text-anchor="middle" style="font-size:17px">🌿</text>
  </svg>`;

  /* href — чистый URL без .html; key — значение data-page для подсветки */
  const nav = [
    { h: '', k: 'index', t: 'Обзор' },
    { t: 'Теория', h: 'theory', drop: [
      { h: 'theory', k: 'theory', t: 'Оглавление курса' },
      { h: 't-air', k: 't-air', t: '1. Атмосфера' },
      { h: 't-water', k: 't-water', t: '2. Гидросфера' },
      { h: 't-waste', k: 't-waste', t: '3. Отходы' },
      { h: 't-marine', k: 't-marine', t: '4. Судно как источник' },
    ] },
    { t: 'Задачи', h: 'air', drop: [
      { h: 'air', k: 'air', t: 'Качество воздуха' },
      { h: 'transport', k: 'transport', t: 'Выбросы транспорта' },
      { h: 'marine', k: 'marine', t: 'Судовое загрязнение' },
    ] },
    { h: 'sources', k: 'sources', t: 'Источники' },
  ];
  const navLink = (it) =>
    `<a href="${root}${it.h}" class="${page === it.k ? 'on' : ''}">${it.t}</a>`;
  const navHtml = nav.map((g) => {
    if (!g.drop) return navLink(g);
    const on = g.drop.some((it) => page === it.k) ? 'on' : '';
    return `<span class="nav-drop"><a href="${root}${g.h}" class="${on}">${g.t} ▾</a>`
      + `<span class="drop">${g.drop.map(navLink).join('')}</span></span>`;
  }).join('');

  const header = document.createElement('header');
  header.className = 'site';
  header.innerHTML = `<div class="wrap">
    <a class="logo" href="${root}">${logoSvg}<span>Промышленная экология</span></a>
    <nav class="top">${navHtml}</nav>
  </div>`;
  document.body.prepend(header);
  const footer = document.createElement('footer');
  footer.className = 'site';
  footer.innerHTML = `<div class="wrap">
    <div>Учебный сайт по курсу «Промышленная экология» · нормирование выбросов
      и сбросов, живые расчёты в браузере</div>
    <div><a href="${root}sources">источники и нормативы</a></div>
  </div>`;
  onReady(() => document.body.appendChild(footer));

  /* маркеры стрелок для размерных линий — один раз на страницу */
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
  defs.style.position = 'absolute';
  defs.innerHTML = `<defs>
    <marker id="arrE" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 z" fill="#16161a"/></marker>
    <marker id="arrS" markerWidth="10" markerHeight="8" refX="1" refY="4" orient="auto">
      <path d="M10,0 L0,4 L10,8 z" fill="#16161a"/></marker>
  </defs>`;
  onReady(() => document.body.appendChild(defs));
})();
