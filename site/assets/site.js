/* Общий каркас страниц сайта «Промышленная экология»: шапка, навигация,
 * подвал, общие SVG-маркеры. Пути относительные — сайт работает под любым
 * префиксом (например /ecology/). */
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
    { href: '', key: 'index', title: 'Обзор' },
    { href: 'theory', key: 'theory', title: 'Теория', sub: [
      ['t-air', 'Атмосфера'],
      ['t-water', 'Гидросфера'],
      ['t-waste', 'Отходы'],
      ['t-marine', 'Судно как источник'],
    ] },
    { href: 'air', key: 'air', title: 'Качество воздуха' },
    { href: 'transport', key: 'transport', title: 'Выбросы транспорта' },
    { href: 'marine', key: 'marine', title: 'Судовое загрязнение' },
    { href: 'sources', key: 'sources', title: 'Источники' },
  ];

  const header = document.createElement('header');
  header.className = 'site';
  header.innerHTML = `<div class="wrap">
    <a class="logo" href="${root}">${logoSvg}<span>Промышленная экология</span></a>
    <nav class="top">${nav.map(({ href, key, title, sub }) => {
      const on = page === key ||
        (key === 'theory' && sub && sub.some(([h]) => h === page));
      const link = `<a href="${root}${href}" class="${on ? 'on' : ''}">${title}${sub ? ' ▾' : ''}</a>`;
      if (!sub) return link;
      return `<div class="nav-drop">${link}<div class="drop">${sub.map(([h, t]) =>
        `<a href="${root}${h}" class="${page === h ? 'on' : ''}">${t}</a>`).join('')}</div></div>`;
    }).join('')}</nav>
  </div>`;
  document.body.prepend(header);

  const footer = document.createElement('footer');
  footer.className = 'site';
  footer.innerHTML = `<div class="wrap">
    <div>Учебный сайт по курсу «Промышленная экология» · нормирование выбросов
      и сбросов, живые расчёты в браузере</div>
    <div><a href="${root}sources">источники и нормативы</a></div>
  </div>`;
  document.body.appendChild(footer);

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
  document.body.appendChild(defs);
})();
