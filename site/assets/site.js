/* Данные каркаса страниц. Машинерия — assets/shell.js. */
'use strict';
(function () {
  const me = document.currentScript;
  const root = (me && me.dataset.root) || './';
  buildSiteShell({
    root,
    page: (me && me.dataset.page) || '',
    brand: 'Промышленная экология',
    logo: `
  <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
    <rect x="1" y="1" width="28" height="28" rx="6" fill="#15803d"/>
    <text x="15" y="22" text-anchor="middle" style="font-size:17px">🌿</text>
  </svg>`,
    nav: [
      { h: '', k: 'index', t: 'Обзор' },
      { t: 'Теория', h: 'theory', drop: [
        { h: 'theory', k: 'theory', t: 'Оглавление курса' },
        { h: 't-air', k: 't-air', t: '1. Атмосфера' },
        { h: 't-water', k: 't-water', t: '2. Гидросфера' },
        { h: 't-waste', k: 't-waste', t: '3. Отходы' },
        { h: 't-marine', k: 't-marine', t: '4. Судно как источник' },
        { h: 't-norm', k: 't-norm', t: '5. Нормирование' },
        { h: 't-control', k: 't-control', t: '6. Надзор и соответствие' },
      ] },
      { t: 'Разборы', h: 'tasks', drop: [
        { h: 'tasks', k: 'tasks', t: 'Оглавление разборов' },
        { h: 'p-diesel', k: 'tasks', t: '1. Валовый выброс дизеля' },
        { h: 'p-disp', k: 'tasks', t: '2. Рассеивание и ПДВ' },
        { h: 'p-sum', k: 'tasks', t: '3. Суммация' },
        { h: 'p-bilge', k: 'tasks', t: '4. Сепаратор льяльных вод' },
        { h: 'p-clean', k: 'tasks', t: '5. Ступени очистки' },
        { h: 'p-fee', k: 'tasks', t: '6. Плата за воздействие' },
        { h: 'p-sulphur', k: 'tasks', t: '7. Как выполнить серное требование' },
      ] },
      { t: 'Калькуляторы', h: 'air', drop: [
        { h: 'air', k: 'air', t: 'Качество воздуха' },
        { h: 'transport', k: 'transport', t: 'Выбросы транспорта' },
        { h: 'marine', k: 'marine', t: 'Судовое загрязнение' },
      ] },
      { h: 'sources', k: 'sources', t: 'Источники' },
    ],
    footer: `<div>Учебный сайт по курсу «Промышленная экология» · нормирование выбросов
      и сбросов, живые расчёты в браузере</div>
    <div><a href="${root}sources">источники и нормативы</a></div>`,
    markers: `<marker id="arrE" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 z" fill="#16161a"/></marker>
    <marker id="arrS" markerWidth="10" markerHeight="8" refX="1" refY="4" orient="auto">
      <path d="M10,0 L0,4 L10,8 z" fill="#16161a"/></marker>`,
  });
})();
