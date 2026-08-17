/* Качество атмосферного воздуха: комплексный индекс загрязнения атмосферы,
 * стандартный индекс и эффект суммации по данным станции мониторинга.
 * Таблица веществ редактируется: строки добавляются и удаляются. */
'use strict';
(function () {

  /* ---------- справочник ПДК (СанПиН 1.2.3685-21, атмосферный воздух
   * городских и сельских поселений). Прочерк — норматив не установлен. ---------- */
  const CAT = {
    co:    { name: 'Оксид углерода (CO)',          mr: 5,     ss: 3,      cls: 4, col: '#155e75' },
    no2:   { name: 'Диоксид азота (NO₂)',          mr: 0.2,   ss: 0.04,   cls: 3, col: '#b3382e' },
    no:    { name: 'Оксид азота (NO)',             mr: 0.4,   ss: 0.06,   cls: 3, col: '#c2683f' },
    so2:   { name: 'Диоксид серы (SO₂)',           mr: 0.5,   ss: 0.05,   cls: 3, col: '#6b6b74' },
    h2s:   { name: 'Сероводород (H₂S)',            mr: 0.008, ss: 0,      cls: 2, col: '#8a8a92' },
    nh3:   { name: 'Аммиак (NH₃)',                 mr: 0.2,   ss: 0.04,   cls: 4, col: '#4a7fa0' },
    pm:    { name: 'Взвешенные вещества',          mr: 0.5,   ss: 0.15,   cls: 3, col: '#7a6a55' },
    pm10:  { name: 'Взвешенные частицы PM₁₀',      mr: 0.3,   ss: 0.06,   cls: 3, col: '#8a6d3b' },
    pm25:  { name: 'Взвешенные частицы PM₂,₅',     mr: 0.16,  ss: 0.035,  cls: 3, col: '#a8814a' },
    soot:  { name: 'Сажа (углерод)',               mr: 0.15,  ss: 0.05,   cls: 3, col: '#16161a' },
    form:  { name: 'Формальдегид (HCHO)',          mr: 0.05,  ss: 0.01,   cls: 2, col: '#7a3fa0' },
    bap:   { name: 'Бенз(а)пирен',                 mr: 0,     ss: 1e-6,   cls: 1, col: '#5b2a86' },
    phenol:{ name: 'Фенол',                        mr: 0.01,  ss: 0.003,  cls: 2, col: '#9a4f6a' },
    o3:    { name: 'Озон (O₃)',                    mr: 0.16,  ss: 0.03,   cls: 1, col: '#2b8fa0' },
    benz:  { name: 'Бензол',                       mr: 0.3,   ss: 0.1,    cls: 2, col: '#5f7a3f' },
    ch:    { name: 'Углеводороды (по бензину)',    mr: 5,     ss: 1.5,    cls: 4, col: '#1a7f37' },
    pb:    { name: 'Свинец и его соединения',      mr: 0.001, ss: 0.0003, cls: 1, col: '#3a3a42' },
  };

  /* показатель степени в ИЗА по классу опасности вещества */
  const EXP = { 1: 1.7, 2: 1.3, 3: 1.0, 4: 0.85 };

  /* числовой пример: сутки наблюдений на городской станции мониторинга */
  const DEF = [
    { id: 'co',   c: 1.8,    cm: 3.4,   grp: '' },
    { id: 'no2',  c: 0.062,  cm: 0.24,  grp: 'А' },
    { id: 'pm10', c: 0.085,  cm: 0.32,  grp: '' },
    { id: 'pm25', c: 0.048,  cm: 0.17,  grp: '' },
    { id: 'so2',  c: 0.021,  cm: 0.14,  grp: 'А' },
    { id: 'form', c: 0.012,  cm: 0.038, grp: '' },
    { id: 'bap',  c: 2.6e-6, cm: 0,     grp: '' },
  ];

  let rows = [];   // {key, id, name, c, cm, mr, ss, cls, grp, col}
  let seq = 0;

  function mkRow(d) {
    const cat = CAT[d.id] || {};
    return {
      key: 'r' + (seq++),
      id: d.id || '',
      name: d.name || cat.name || 'Вещество',
      c: d.c !== undefined ? d.c : 0,
      cm: d.cm !== undefined ? d.cm : 0,
      mr: d.mr !== undefined ? d.mr : (cat.mr || 0),
      ss: d.ss !== undefined ? d.ss : (cat.ss || 0),
      cls: d.cls !== undefined ? d.cls : (cat.cls || 3),
      grp: d.grp || '',
      col: cat.col || '#155e75',
    };
  }

  /* ---------- таблица ---------- */
  function drawTable() {
    let h = '<div class="scroll-x"><table class="el edit"><tr>' +
      '<th>Вещество</th><th class="num">C<sub>с.с.</sub>, мг/м³</th>' +
      '<th class="num">ПДК<sub>с.с.</sub>, мг/м³</th><th class="num">Класс</th>' +
      '<th class="num">C<sub>макс</sub>, мг/м³</th><th class="num">ПДК<sub>м.р.</sub>, мг/м³</th>' +
      '<th>Группа суммации</th><th></th></tr>';
    rows.forEach(r => {
      h += `<tr data-k="${r.key}">` +
        `<td><input class="wide" type="text" data-f="name" value="${esc(r.name)}"></td>` +
        `<td class="num"><input type="number" step="any" min="0" data-f="c" value="${r.c}"></td>` +
        `<td class="num"><input type="number" step="any" min="0" data-f="ss" value="${r.ss}"></td>` +
        `<td class="num"><input type="number" step="1" min="1" max="4" data-f="cls" value="${r.cls}" style="width:56px"></td>` +
        `<td class="num"><input type="number" step="any" min="0" data-f="cm" value="${r.cm}"></td>` +
        `<td class="num"><input type="number" step="any" min="0" data-f="mr" value="${r.mr}"></td>` +
        `<td><input type="text" data-f="grp" value="${esc(r.grp)}" style="width:70px"></td>` +
        `<td class="del"><button type="button" data-del="${r.key}" title="удалить строку">✕</button></td>` +
        '</tr>';
    });
    h += '</table></div>';
    $('tabSub').innerHTML = h;
  }

  function readTable() {
    $('tabSub').querySelectorAll('tr[data-k]').forEach(tr => {
      const r = rows.find(x => x.key === tr.dataset.k);
      if (!r) return;
      tr.querySelectorAll('[data-f]').forEach(el => {
        const f = el.dataset.f;
        r[f] = (f === 'name' || f === 'grp') ? el.value : num(el, 0);
      });
    });
  }

  /* ---------- расчёт ---------- */
  function compute() {
    const res = rows.map(r => {
      const q = r.ss > 0 ? r.c / r.ss : NaN;                 // кратность ПДК с.с.
      const k = EXP[Math.round(r.cls)] || 1;
      const I = isFinite(q) ? Math.pow(q, k) : NaN;          // единичный индекс
      const si = r.mr > 0 ? r.cm / r.mr : NaN;               // стандартный индекс
      return { r, q, k, I, si };
    });
    const valid = res.filter(x => isFinite(x.I));
    const iza = valid.reduce((a, x) => a + x.I, 0);
    const top = valid.slice().sort((a, b) => b.I - a.I).slice(0, 5);
    const iza5 = top.reduce((a, x) => a + x.I, 0);
    const siMax = res.reduce((a, x) => (isFinite(x.si) && x.si > a.v ? { v: x.si, x } : a), { v: -1, x: null });
    /* группы суммации */
    const groups = {};
    res.forEach(x => {
      const g = (x.r.grp || '').trim();
      if (!g) return;
      (groups[g] = groups[g] || []).push(x);
    });
    return { res, top, iza, iza5, siMax, groups };
  }

  /* градации уровня загрязнения (ИЗА₅ ≤ 4 — низкий, 5–6 — повышенный,
     7–13 — высокий, ≥ 14 — очень высокий; СИ ≤ 1, 2–4, 5–10, > 10) */
  const gradeIZA = v => !isFinite(v) ? '—' : v < 5 ? 'низкий' : v < 7 ? 'повышенный' : v < 14 ? 'высокий' : 'очень высокий';
  const gradeSI = v => !isFinite(v) || v < 0 ? '—' : v <= 1 ? 'низкий' : v < 5 ? 'повышенный' : v <= 10 ? 'высокий' : 'очень высокий';

  /* ---------- вывод ---------- */
  function render() {
    readTable();
    const R = compute();

    /* сводная таблица индексов */
    let h = '<div class="scroll-x"><table class="el"><tr><th>Вещество</th>' +
      '<th class="num">C<sub>с.с.</sub>/ПДК<sub>с.с.</sub></th><th class="num">Показатель k</th>' +
      '<th class="num">I<sub>i</sub> = (C/ПДК)<sup>k</sup></th><th class="num">В ИЗА₅</th>' +
      '<th class="num">СИ = C<sub>макс</sub>/ПДК<sub>м.р.</sub></th></tr>';
    R.res.forEach(x => {
      const inTop = R.top.indexOf(x) >= 0;
      h += `<tr><td>${esc(x.r.name)}</td>` +
        `<td class="num" style="color:${x.q > 1 ? '#b3382e' : '#1a7f37'}">${fmtA(x.q)}</td>` +
        `<td class="num">${fmt(x.k, 2)}</td>` +
        `<td class="num"><b>${fmtA(x.I)}</b></td>` +
        `<td class="num">${inTop ? '✓' : '—'}</td>` +
        `<td class="num" style="color:${x.si > 1 ? '#b3382e' : '#1a7f37'}">${fmtA(x.si)}</td></tr>`;
    });
    h += '</table></div>';
    $('tabRes').innerHTML = h;

    /* пошаговый расчёт */
    const worst = R.top[0];
    let s = '';
    if (worst) {
      s += row(`q = C<sub>с.с.</sub> / ПДК<sub>с.с.</sub> <span class="sub">(${esc(worst.r.name)})</span>`,
        `${fmtA(worst.r.c)} / ${fmtA(worst.r.ss)}`, `${fmtA(worst.q)}`) +
        row('I = q<sup>k</sup> <span class="sub">(класс ' + fmt(worst.r.cls, 0) + ' → k = ' + fmt(worst.k, 2) + ')</span>',
          `${fmtA(worst.q)}<sup>${fmt(worst.k, 2)}</sup>`, `${fmtA(worst.I)}`);
    }
    s += row('ИЗА₅ = Σ<sub>(5 наибольших)</sub> I<sub>i</sub>',
      R.top.map(x => fmtA(x.I)).join(' + '), `${fmtA(R.iza5)} — качество воздуха «${gradeIZA(R.iza5)}»`);
    s += row('ИЗА (по всем веществам) = Σ I<sub>i</sub>',
      R.res.filter(x => isFinite(x.I)).map(x => fmtA(x.I)).join(' + '), `${fmtA(R.iza)}`);
    if (R.siMax.x) {
      s += row('СИ = max (C<sub>макс</sub> / ПДК<sub>м.р.</sub>)',
        `${fmtA(R.siMax.x.r.cm)} / ${fmtA(R.siMax.x.r.mr)} <span class="sub">(${esc(R.siMax.x.r.name)})</span>`,
        `${fmtA(R.siMax.v)} — «${gradeSI(R.siMax.v)}»`);
    }
    $('calcMain').innerHTML = s;

    /* эффект суммации */
    const keys = Object.keys(R.groups);
    if (!keys.length) {
      $('calcSum').innerHTML = '<div class="calc">Группы суммации не заданы: впишите одинаковую ' +
        'метку в столбец «Группа суммации» для веществ однонаправленного действия.</div>';
    } else {
      $('calcSum').innerHTML = keys.map(g => {
        const arr = R.groups[g];
        const sMR = arr.reduce((a, x) => a + (x.r.mr > 0 ? x.r.cm / x.r.mr : 0), 0);
        const sSS = arr.reduce((a, x) => a + (x.r.ss > 0 ? x.r.c / x.r.ss : 0), 0);
        const names = arr.map(x => esc(x.r.name)).join(' + ');
        return `<div class="calc" style="margin-top:10px"><b>Группа «${esc(g)}»:</b> ${names}</div>` +
          row('Σ C<sub>макс</sub>/ПДК<sub>м.р.</sub>',
            arr.map(x => `${fmtA(x.r.cm)}/${fmtA(x.r.mr)}`).join(' + '),
            `${fmtA(sMR)} ${sMR <= 1 ? '≤ 1 — норматив соблюдается' : '&gt; 1 — норматив нарушен'}`) +
          row('Σ C<sub>с.с.</sub>/ПДК<sub>с.с.</sub>',
            arr.map(x => `${fmtA(x.r.c)}/${fmtA(x.r.ss)}`).join(' + '),
            `${fmtA(sSS)} ${sSS <= 1 ? '≤ 1 — норматив соблюдается' : '&gt; 1 — норматив нарушен'}`);
      }).join('');
    }

    /* итоговая оценка */
    $('verdict').innerHTML =
      `<div class="live-sum">
        <div class="cell"><span class="k">ИЗА₅</span><span class="v">${fmtA(R.iza5)}</span></div>
        <div class="cell"><span class="k">Качество воздуха по ИЗА₅</span><span class="v">${gradeIZA(R.iza5)}</span></div>
        <div class="cell"><span class="k">СИ</span><span class="v">${fmtA(R.siMax.v)}</span></div>
        <div class="cell"><span class="k">Качество по СИ</span><span class="v">${R.siMax.x ? gradeSI(R.siMax.v) : '—'}</span></div>
      </div>`;

    /* диаграмма вкладов */
    drawBars($('svgI'), R.res.filter(x => isFinite(x.I)).map(x => ({
      name: x.r.name.replace(/\s*\(.*\)/, '').slice(0, 26),
      value: x.I,
      color: R.top.indexOf(x) >= 0 ? x.r.col : '#b9b9c0',
      label: fmtA(x.I),
    })), { title: 'Единичные индексы I = (C/ПДК)^k; цветом — пять наибольших, входящих в ИЗА₅', unit: '' });
  }

  /* ---------- добавление и удаление строк ---------- */
  function addRow(id) {
    rows.push(mkRow({ id, c: 0, cm: 0 }));
    drawTable(); render();
  }

  /* ---------- параметры из расчёта транспорта ---------- */
  function applyQuery() {
    const q = new URLSearchParams(location.search);
    let used = [];
    q.forEach((v, k) => {
      const val = parseFloat(v);
      if (!isFinite(val) || !CAT[k]) return;
      let r = rows.find(x => x.id === k);
      if (!r) { r = mkRow({ id: k, c: 0, cm: 0 }); rows.push(r); }
      r.cm = Number(val.toPrecision(4));
      used.push(CAT[k].name);
    });
    if (used.length) {
      const b = $('banner');
      b.style.display = '';
      b.innerHTML = '<b>Данные получены из расчёта выбросов транспорта.</b> ' +
        'Оценочные концентрации подставлены в столбец C<sub>макс</sub> (разовая концентрация ' +
        'при заданной скорости ветра): ' + used.map(esc).join(', ') + '. ' +
        'Среднесуточные концентрации задайте отдельно — они усредняются за сутки и ниже разовых.';
    }
  }

  /* ---------- инициализация ---------- */
  function init() {
    rows = DEF.map(mkRow);
    applyQuery();
    drawTable();
    $('selAdd').innerHTML = '<option value="">— выберите вещество —</option>' +
      Object.keys(CAT).map(k => `<option value="${k}">${CAT[k].name}</option>`).join('');
    $('selAdd').addEventListener('change', e => {
      if (e.target.value) { addRow(e.target.value); e.target.value = ''; }
    });
    $('btnReset').addEventListener('click', () => {
      rows = DEF.map(mkRow); drawTable(); render();
    });
    $('tabSub').addEventListener('click', e => {
      const k = e.target && e.target.dataset && e.target.dataset.del;
      if (!k) return;
      readTable();
      rows = rows.filter(r => r.key !== k);
      drawTable(); render();
    });
    document.addEventListener('input', render);
    render();
  }
  onReady(init);
})();
