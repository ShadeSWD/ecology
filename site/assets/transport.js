/* Воздействие автотранспортного потока на городскую экосистему:
 * выброс участка дороги, приземная концентрация, приведённая масса и ущерб.
 * Все исходные данные редактируются, расчёт пересчитывается целиком. */
'use strict';
(function () {
  const { fmt, fmtA, fmtE, row, esc, num, drawBars, colors } = window.EC;
  const $ = id => document.getElementById(id);

  /* ---------- вещества: ПДК по СанПиН 1.2.3685-21, r_V — по методике ---------- */
  const SUB = [
    { id: 'co',   name: 'CO — оксид углерода',      mr: 5,    ss: 3,    cls: 4, rv: 0.6, col: '#155e75' },
    { id: 'no2',  name: 'NO₂ — диоксид азота',      mr: 0.2,  ss: 0.04, cls: 3, rv: 1.0, col: '#b3382e' },
    { id: 'ch',   name: 'CH — углеводороды',        mr: 5,    ss: 1.5,  cls: 4, rv: 0.6, col: '#1a7f37' },
    { id: 'soot', name: 'C — сажа (углерод)',       mr: 0.15, ss: 0.05, cls: 3, rv: 0.6, col: '#16161a' },
    { id: 'so2',  name: 'SO₂ — диоксид серы',       mr: 0.5,  ss: 0.05, cls: 3, rv: 0.6, col: '#6b6b74' },
    { id: 'form', name: 'HCHO — формальдегид',      mr: 0.05, ss: 0.01, cls: 2, rv: 0.6, col: '#7a3fa0' },
  ];

  /* ---------- типы транспортных средств: пробеговые выбросы, г/км ---------- */
  const VEH = [
    { name: 'Легковые бензиновые', n: 420, e: { co: 0.9,  no2: 0.33, ch: 0.26, soot: 0.0055, so2: 0.0066, form: 0.0015 } },
    { name: 'Легковые дизельные',  n: 60,  e: { co: 0.75, no2: 0.15, ch: 0.035, soot: 0.015, so2: 0.02,   form: 0.00075 } },
    { name: 'Грузовые дизельные',  n: 40,  e: { co: 2.5,  no2: 5.0,  ch: 0.6,  soot: 0.25,   so2: 0.15,   form: 0.01 } },
    { name: 'Автобусы',            n: 14,  e: { co: 2.0,  no2: 4.5,  ch: 0.5,  soot: 0.2,    so2: 0.12,   form: 0.008 } },
  ];

  /* ---------- разметка таблиц ---------- */
  function buildVehTable() {
    const th = ['Тип транспортного средства', 'Число за период <i>G<sub>k</sub></i>, шт']
      .concat(SUB.map(s => `<span title="${esc(s.name)}">M<sub>${s.id}</sub></span>, г/км`));
    let h = '<div class="scroll-x"><table class="el edit"><tr>' + th.map((t, i) =>
      `<th class="${i ? 'num' : ''}">${t}</th>`).join('') + '</tr>';
    VEH.forEach((v, k) => {
      h += `<tr><td><input class="wide" type="text" id="vn${k}" value="${esc(v.name)}"></td>` +
        `<td class="num"><input type="number" min="0" step="1" id="vg${k}" value="${v.n}"></td>` +
        SUB.map(s => `<td class="num"><input type="number" min="0" step="any" id="ve${k}_${s.id}" value="${v.e[s.id]}"></td>`).join('') +
        '</tr>';
    });
    h += '</table></div>';
    return h;
  }

  function buildSubTable() {
    let h = '<div class="scroll-x"><table class="el edit"><tr><th>Вещество</th>' +
      '<th class="num">ПДК<sub>м.р.</sub>, мг/м³</th><th class="num">ПДК<sub>с.с.</sub>, мг/м³</th>' +
      '<th class="num">Класс</th><th class="num">r<sub>V</sub></th></tr>';
    SUB.forEach(s => {
      h += `<tr><td>${s.name}</td>` +
        `<td class="num"><input type="number" min="0" step="any" id="pm_${s.id}" value="${s.mr}"></td>` +
        `<td class="num"><input type="number" min="0" step="any" id="ps_${s.id}" value="${s.ss}"></td>` +
        `<td class="num"><input type="number" min="1" max="4" step="1" id="cl_${s.id}" value="${s.cls}"></td>` +
        `<td class="num"><input type="number" min="0" step="any" id="rv_${s.id}" value="${s.rv}"></td></tr>`;
    });
    h += '</table></div>';
    return h;
  }

  /* ---------- расчёт ---------- */
  function read() {
    const p = {
      L: num($('inL'), 0.45),          // длина участка, км
      T: num($('inT'), 1200),          // период учёта, с
      V: num($('inV'), 45),            // средняя скорость потока, км/ч
      u: num($('inU'), 2),             // скорость ветра, м/с
      H: num($('inH'), 10),            // высота слоя перемешивания, м
      hd: num($('inHd'), 16),          // часов активного движения в сутки
      dy: num($('inDy'), 365),         // дней в году
      gam: num($('inGam'), 500),       // удельный ущерб, руб/усл.т
      sig: num($('inSig'), 8),         // показатель относительной опасности территории
      f: num($('inF'), 1),             // поправка на характер рассеивания
    };
    p.veh = VEH.map((v, k) => ({
      name: ($('vn' + k) || {}).value || v.name,
      n: num($('vg' + k), 0),
      e: SUB.reduce((a, s) => (a[s.id] = num($('ve' + k + '_' + s.id), 0), a), {}),
    }));
    p.sub = SUB.map(s => ({
      id: s.id, name: s.name, col: s.col,
      mr: num($('pm_' + s.id), s.mr),
      ss: num($('ps_' + s.id), s.ss),
      cls: num($('cl_' + s.id), s.cls),
      rv: num($('rv_' + s.id), s.rv),
    }));
    return p;
  }

  /* показатель относительной агрессивности, усл.т/т: нормируется по CO */
  function aggr(sub, co) {
    if (!(sub.mr > 0 && sub.ss > 0)) return NaN;
    const base = Math.sqrt(1 / (co.ss * co.mr));
    return Math.sqrt(1 / (sub.ss * sub.mr)) / base;
  }

  function compute(p) {
    const co = p.sub[0];
    const res = p.sub.map(s => {
      // сумма по типам ТС: Σ M_k,i · G_k
      const sum = p.veh.reduce((a, v) => a + v.e[s.id] * v.n, 0);
      const ms = p.L / p.T * sum * s.rv;               // г/с
      const mts = ms / 1e6;                            // т/с
      const mty = ms * p.hd * 3600 * p.dy / 1e6;       // т/год
      const qL = p.L > 0 ? ms / (p.L * 1000) : 0;      // г/(м·с)
      const c = (p.u > 0 && p.H > 0) ? qL / (p.u * p.H) * 1000 : NaN; // мг/м³
      const A = aggr(s, co);
      return { s, sum, ms, mts, mty, qL, c,
        siMR: s.mr > 0 ? c / s.mr : NaN,
        siSS: s.ss > 0 ? c / s.ss : NaN,
        A, P: A * mty };
    });
    const Ptot = res.reduce((a, r) => a + (isFinite(r.P) ? r.P : 0), 0);
    const Mtot = res.reduce((a, r) => a + r.mty, 0);
    const damage = p.gam * p.sig * p.f * Ptot;
    // характеристики потока
    const Nh = p.T > 0 ? p.veh.reduce((a, v) => a + v.n, 0) * 3600 / p.T : 0; // авт/ч
    const dens = p.V > 0 ? Nh / p.V : 0;              // авт/км
    const onSec = dens * p.L;                          // авт на участке
    return { res, Ptot, Mtot, damage, Nh, dens, onSec };
  }

  /* ---------- вывод ---------- */
  function render() {
    const p = read(), r = compute(p);

    /* сводка по потоку */
    $('flow').innerHTML =
      row('N<sub>ч</sub> = ΣG<sub>k</sub> · 3600 / T',
        `${fmt(p.veh.reduce((a, v) => a + v.n, 0), 0)} · 3600 / ${fmt(p.T, 0)}`,
        `${fmt(r.Nh, 0)} авт/ч`) +
      row('ρ = N<sub>ч</sub> / V<sub>ср</sub>', `${fmt(r.Nh, 0)} / ${fmt(p.V, 0)}`,
        `${fmt(r.dens, 1)} авт/км`) +
      row('n<sub>уч</sub> = ρ · L', `${fmt(r.dens, 1)} · ${fmt(p.L, 2)}`,
        `${fmt(r.onSec, 1)} авт. одновременно на участке`);

    /* таблица результатов */
    let h = '<table class="el"><tr><th>Вещество</th>' +
      '<th class="num">Σ M<sub>k</sub>·G<sub>k</sub>, г/км</th>' +
      '<th class="num">M<sub>L</sub>, г/с</th><th class="num">M·V, т/с</th><th class="num">M·V, т/год</th>' +
      '<th class="num">C, мг/м³</th><th class="num">C / ПДК<sub>м.р.</sub></th>' +
      '<th class="num">A<sub>i</sub>, усл.т/т</th><th class="num">П<sub>i</sub>, усл.т/год</th></tr>';
    r.res.forEach(x => {
      const over = x.siMR > 1;
      h += `<tr><td>${x.s.name}</td><td class="num">${fmtA(x.sum)}</td>` +
        `<td class="num">${fmtA(x.ms)}</td><td class="num">${fmtE(x.mts, 2)}</td>` +
        `<td class="num">${fmtA(x.mty)}</td><td class="num">${fmtA(x.c)}</td>` +
        `<td class="num" style="color:${over ? '#b3382e' : '#1a7f37'}">${fmtA(x.siMR)}</td>` +
        `<td class="num">${fmtA(x.A)}</td><td class="num">${fmtA(x.P)}</td></tr>`;
    });
    h += `<tr class="tot"><td>Итого</td><td class="num">—</td><td class="num">—</td><td class="num">—</td>` +
      `<td class="num">${fmtA(r.Mtot)}</td><td class="num">—</td><td class="num">—</td>` +
      `<td class="num">—</td><td class="num">${fmtA(r.Ptot)}</td></tr></table>`;
    $('tabRes').innerHTML = h;

    /* подробный вывод по выбранному веществу */
    const selId = $('selSub').value;
    const x = r.res.find(y => y.s.id === selId) || r.res[0];
    const terms = p.veh.map(v => `${fmtA(v.e[x.s.id])} · ${fmt(v.n, 0)}`).join(' + ');
    $('detail').innerHTML =
      row(`M<sub>L</sub> = (L / T) · Σ<sub>k</sub> M<sub>k</sub> · G<sub>k</sub> · r<sub>V</sub>`,
        `(${fmt(p.L, 2)} / ${fmt(p.T, 0)}) · (${terms}) · ${fmtA(x.s.rv)}`,
        `${fmtA(x.ms)} г/с`) +
      row('M·V = M<sub>L</sub> · 10⁻⁶', `${fmtA(x.ms)} · 10⁻⁶`, `${fmtE(x.mts, 2)} т/с`) +
      row('M·V<sub>год</sub> = M<sub>L</sub> · t<sub>сут</sub> · 3600 · N<sub>дн</sub> · 10⁻⁶',
        `${fmtA(x.ms)} · ${fmt(p.hd, 0)} · 3600 · ${fmt(p.dy, 0)} · 10⁻⁶`,
        `${fmtA(x.mty)} т/год`) +
      row('q<sub>L</sub> = M<sub>L</sub> / (L · 1000)', `${fmtA(x.ms)} / (${fmt(p.L, 2)} · 1000)`,
        `${fmtE(x.qL, 2)} г/(м·с)`) +
      row('C = q<sub>L</sub> / (u · H) · 1000',
        `${fmtE(x.qL, 2)} / (${fmt(p.u, 1)} · ${fmt(p.H, 0)}) · 1000`, `${fmtA(x.c)} мг/м³`) +
      row('C / ПДК<sub>м.р.</sub>', `${fmtA(x.c)} / ${fmtA(x.s.mr)}`, `${fmtA(x.siMR)}`) +
      row('A<sub>i</sub> = √(1 / (ПДК<sub>с.с.</sub> · ПДК<sub>м.р.</sub>)) : √(1 / (ПДК<sub>с.с.,CO</sub> · ПДК<sub>м.р.,CO</sub>))',
        `√(1 / (${fmtA(x.s.ss)} · ${fmtA(x.s.mr)})) : √(1 / (${fmtA(p.sub[0].ss)} · ${fmtA(p.sub[0].mr)}))`,
        `${fmtA(x.A)} усл.т/т`) +
      row('П<sub>i</sub> = A<sub>i</sub> · M·V<sub>год</sub>', `${fmtA(x.A)} · ${fmtA(x.mty)}`,
        `${fmtA(x.P)} усл.т/год`);

    /* ущерб */
    $('damage').innerHTML =
      row('П = Σ A<sub>i</sub> · m<sub>i</sub>',
        r.res.map(y => `${fmtA(y.A)}·${fmtA(y.mty)}`).join(' + '),
        `${fmtA(r.Ptot)} усл.т/год`) +
      row('У = γ · σ · f · П',
        `${fmt(p.gam, 0)} · ${fmt(p.sig, 1)} · ${fmt(p.f, 2)} · ${fmtA(r.Ptot)}`,
        `${fmt(r.damage, 0)} руб/год`);

    /* диаграмма вкладов в приведённую массу */
    drawBars($('svgP'), r.res.map(y => ({
      name: y.s.name.split(' —')[0], value: isFinite(y.P) ? y.P : 0, color: y.s.col,
      label: fmtA(y.P),
    })), { title: 'Вклад веществ в приведённую массу выброса П, усл.т/год', unit: 'усл.т/год' });

    /* диаграмма долей по массе */
    drawBars($('svgM'), r.res.map(y => ({
      name: y.s.name.split(' —')[0], value: y.mty, color: y.s.col, label: fmtA(y.mty),
    })), { title: 'Масса выброса по веществам, т/год', unit: 'т/год' });

    /* живые подписи на схеме участка */
    const setT = (id, v) => { const e = $(id); if (e) e.textContent = v; };
    setT('svgL', `L = ${fmt(p.L, 2)} км`);
    setT('svgH', `H = ${fmt(p.H, 0)} м`);
    setT('svgU', `u = ${fmt(p.u, 1)} м/с`);
    setT('svgN', `${fmt(r.Nh, 0)} авт/ч, V = ${fmt(p.V, 0)} км/ч`);
    setT('svgC', `C(CO) ≈ ${fmtA(r.res[0].c)} мг/м³`);

    /* ссылка на расчёт ИЗА с полученными концентрациями */
    const q = r.res.filter(y => isFinite(y.c)).map(y => `${y.s.id}=${y.c.toPrecision(4)}`).join('&');
    const a = $('toAir');
    if (a) a.href = 'air?' + q;
  }

  /* ---------- инициализация ---------- */
  function build() {
    $('tabVeh').innerHTML = buildVehTable();
    $('tabSub').innerHTML = buildSubTable();
    $('selSub').innerHTML = SUB.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  }
  function init() {
    build();
    document.addEventListener('input', render);
    document.addEventListener('change', render);
    const btn = $('btnReset');
    if (btn) btn.addEventListener('click', () => {
      document.querySelectorAll('form#src input').forEach(el => { el.value = el.defaultValue; });
      build();
      render();
    });
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
