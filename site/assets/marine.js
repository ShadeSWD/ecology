/* Судовое загрязнение: объёмы нефтесодержащих, сточных вод и мусора,
 * подбор природоохранного оборудования, выбросы SOx/NOx/CO2 главного
 * двигателя и проверка соответствия требованиям МАРПОЛ 73/78. */
'use strict';
(function () {
  const { fmt, fmtA, fmtE, row, esc, num, drawBars } = window.EC;
  const $ = id => document.getElementById(id);

  /* типоразмерный ряд производительности оборудования */
  const SEP_ROW = [0.25, 0.5, 1.0, 2.5, 5.0, 10.0];        // м³/ч, сепараторы
  const STP_ROW = [1, 2, 4, 6, 10, 15, 25, 40];            // м³/сут, установки обработки сточных вод
  const INC_ROW = [10, 20, 30, 50, 80, 120];               // кг/ч, инсинераторы

  const pick = (v, ryad) => ryad.find(x => x >= v) || ryad[ryad.length - 1];

  /* предел выброса NOx по МАРПОЛ, приложение VI, правило 13, г/(кВт·ч) */
  function tierLimit(tier, n) {
    if (tier === 'I')   return n < 130 ? 17.0 : (n < 2000 ? 45 * Math.pow(n, -0.2)  : 9.8);
    if (tier === 'II')  return n < 130 ? 14.4 : (n < 2000 ? 44 * Math.pow(n, -0.23) : 7.7);
    return               n < 130 ?  3.4 : (n < 2000 ?  9 * Math.pow(n, -0.2)  : 1.96);
  }

  function read() {
    return {
      crew: num($('inCrew'), 24),
      auto: num($('inAuto'), 30),
      qlv:  num($('inQlv'), 1.2),
      tsep: num($('inTsep'), 4),
      c0:   num($('inC0'), 2000),
      qw:   num($('inQw'), 150),
      bod:  num($('inBod'), 60),
      ss:   num($('inSs'), 65),
      gar:  num($('inGar'), 1.5),
      rhoG: num($('inRhoG'), 120),
      ne:   num($('inNe'), 6000),
      load: num($('inLoad'), 85) / 100,
      be:   num($('inBe'), 190),
      s:    num($('inS'), 2.5),
      rpm:  num($('inRpm'), 500),
      tier: ($('selTier') || {}).value || 'II',
      gnox: num($('inGnox'), 12.5),
      cf:   num($('inCf'), 3.114),
      eta:  num($('inEta'), 97) / 100,
      hrs:  num($('inHrs'), 20),
      eca:  ($('selZone') || {}).value === 'eca',
    };
  }

  function compute(p) {
    const r = {};

    /* --- нефтесодержащие (льяльные) воды --- */
    r.Vlv = p.qlv * p.auto;                              // м³ за автономность
    r.Qsep = p.tsep > 0 ? p.qlv / p.tsep : NaN;          // требуемая подача, м³/ч
    r.QsepStd = pick(r.Qsep, SEP_ROW);
    r.mOilOut = 15e-6 * 1000 * r.Vlv;                    // кг нефтепродуктов при 15 ppm
    r.mOilIn = p.c0 * 1e-6 * 1000 * r.Vlv;               // кг нефтепродуктов до очистки
    r.etaSep = p.c0 > 0 ? 1 - 15 / p.c0 : NaN;           // требуемая степень очистки
    r.mOilCatch = r.mOilIn - r.mOilOut;                  // масса шлама (нефтеостатков)

    /* --- сточные воды --- */
    r.Qst = p.crew * p.qw / 1000;                        // м³/сут
    r.Vst = r.Qst * p.auto;                              // м³ за автономность
    r.QstpStd = pick(r.Qst, STP_ROW);
    r.mBod = p.crew * p.bod / 1000;                      // кг БПК₅ в сутки
    r.mSs  = p.crew * p.ss / 1000;                       // кг взвешенных в сутки
    r.cBod = r.Qst > 0 ? r.mBod * 1000 / r.Qst : NaN;    // мг/л на входе
    r.cSs  = r.Qst > 0 ? r.mSs * 1000 / r.Qst : NaN;
    r.etaBod = r.cBod > 0 ? 1 - 25 / r.cBod : NaN;       // норматив MEPC.227(64): БПК₅ ≤ 25 мг/л
    r.etaSs  = r.cSs > 0 ? 1 - 35 / r.cSs : NaN;         // взвешенные ≤ 35 мг/л

    /* --- мусор --- */
    r.mGar = p.crew * p.gar;                             // кг/сут
    r.Vgar = p.rhoG > 0 ? r.mGar / p.rhoG : NaN;         // м³/сут
    r.VgarA = r.Vgar * p.auto;
    r.Qinc = r.mGar / 8;                                 // кг/ч при 8 ч работы инсинератора
    r.QincStd = pick(r.Qinc, INC_ROW);

    /* --- выбросы главного двигателя --- */
    r.Pe = p.ne * p.load;                                // кВт на эксплуатационном режиме
    r.Bh = r.Pe * p.be / 1e6;                            // т/ч
    r.Bd = r.Bh * p.hrs;                                 // т/сут
    r.Ba = r.Bd * p.auto;                                // т за автономность
    r.so2 = 2 * r.Ba * p.s / 100;                        // т SO₂ за автономность
    r.co2 = r.Ba * p.cf;                                 // т CO₂
    r.nox = p.gnox * r.Pe * p.hrs * p.auto / 1e6;        // т NOx
    r.lim = tierLimit(p.tier, p.rpm);
    r.noxOk = p.gnox <= r.lim;
    r.sLim = p.eca ? 0.10 : 0.50;
    r.sOk = p.s <= r.sLim;
    r.sScrub = p.s * (1 - p.eta);                        // эквивалентное содержание серы со скруббером
    r.scrubOk = r.sScrub <= r.sLim;
    /* варианты топлива */
    r.varSO2 = [
      { name: 'Текущее топливо', s: p.s, m: 2 * r.Ba * p.s / 100, col: '#b3382e' },
      { name: 'Низкосернистое 0,50 %', s: 0.5, m: 2 * r.Ba * 0.5 / 100, col: '#155e75' },
      { name: 'Топливо ECA 0,10 %', s: 0.1, m: 2 * r.Ba * 0.1 / 100, col: '#1a7f37' },
      { name: 'Текущее + скруббер', s: r.sScrub, m: 2 * r.Ba * r.sScrub / 100, col: '#6b6b74' },
    ];
    return r;
  }

  function render() {
    const p = read(), r = compute(p);
    const badge = (ok, t, f) => `<span class="badge ${ok ? 'ok' : 'bad'}">${ok ? t : f}</span>`;

    /* нефтесодержащие воды */
    $('calcOil').innerHTML =
      row('V<sub>лв</sub> = q<sub>лв</sub> · A', `${fmtA(p.qlv)} · ${fmt(p.auto, 0)}`, `${fmtA(r.Vlv)} м³`) +
      row('Q<sub>сеп</sub> = q<sub>лв</sub> / t<sub>раб</sub>', `${fmtA(p.qlv)} / ${fmt(p.tsep, 1)}`,
        `${fmtA(r.Qsep)} м³/ч → типоразмер ${fmt(r.QsepStd, 2)} м³/ч`) +
      row('m<sub>нп,вход</sub> = C₀ · 10⁻⁶ · ρ · V<sub>лв</sub>',
        `${fmt(p.c0, 0)} · 10⁻⁶ · 1000 · ${fmtA(r.Vlv)}`, `${fmtA(r.mOilIn)} кг`) +
      row('m<sub>нп,сброс</sub> = 15 · 10⁻⁶ · ρ · V<sub>лв</sub>',
        `15 · 10⁻⁶ · 1000 · ${fmtA(r.Vlv)}`, `${fmtA(r.mOilOut)} кг`) +
      row('η<sub>сеп</sub> = 1 − 15 / C₀', `1 − 15 / ${fmt(p.c0, 0)}`,
        `${fmt(r.etaSep * 100, 2)} % — требуемая степень очистки`) +
      row('m<sub>шлам</sub> = m<sub>вход</sub> − m<sub>сброс</sub>',
        `${fmtA(r.mOilIn)} − ${fmtA(r.mOilOut)}`, `${fmtA(r.mOilCatch)} кг в танк нефтеостатков`);

    /* сточные воды */
    $('calcSew').innerHTML =
      row('Q<sub>ст</sub> = n · q<sub>в</sub> / 1000', `${fmt(p.crew, 0)} · ${fmt(p.qw, 0)} / 1000`,
        `${fmtA(r.Qst)} м³/сут`) +
      row('V<sub>ст</sub> = Q<sub>ст</sub> · A', `${fmtA(r.Qst)} · ${fmt(p.auto, 0)}`, `${fmtA(r.Vst)} м³`) +
      row('Производительность установки', `ближайший типоразмер ≥ ${fmtA(r.Qst)} м³/сут`,
        `${fmt(r.QstpStd, 0)} м³/сут`) +
      row('C<sub>БПК,вход</sub> = n · g<sub>БПК</sub> / Q<sub>ст</sub>',
        `${fmt(p.crew, 0)} · ${fmt(p.bod, 0)} / ${fmtA(r.Qst)}`, `${fmt(r.cBod, 0)} мг/л`) +
      row('η<sub>БПК</sub> = 1 − 25 / C<sub>БПК,вход</sub>', `1 − 25 / ${fmt(r.cBod, 0)}`,
        `${fmt(r.etaBod * 100, 1)} %`) +
      row('C<sub>взв,вход</sub> = n · g<sub>взв</sub> / Q<sub>ст</sub>',
        `${fmt(p.crew, 0)} · ${fmt(p.ss, 0)} / ${fmtA(r.Qst)}`, `${fmt(r.cSs, 0)} мг/л`) +
      row('η<sub>взв</sub> = 1 − 35 / C<sub>взв,вход</sub>', `1 − 35 / ${fmt(r.cSs, 0)}`,
        `${fmt(r.etaSs * 100, 1)} %`);

    /* мусор */
    $('calcGar').innerHTML =
      row('m<sub>мус</sub> = n · g<sub>мус</sub>', `${fmt(p.crew, 0)} · ${fmtA(p.gar)}`, `${fmtA(r.mGar)} кг/сут`) +
      row('V<sub>мус</sub> = m<sub>мус</sub> / ρ<sub>мус</sub>', `${fmtA(r.mGar)} / ${fmt(p.rhoG, 0)}`,
        `${fmtA(r.Vgar)} м³/сут, за рейс ${fmtA(r.VgarA)} м³`) +
      row('Q<sub>инс</sub> = m<sub>мус</sub> / 8 ч', `${fmtA(r.mGar)} / 8`,
        `${fmtA(r.Qinc)} кг/ч → типоразмер ${fmt(r.QincStd, 0)} кг/ч`);

    /* двигатель */
    $('calcEng').innerHTML =
      row('P<sub>э</sub> = N<sub>e</sub> · x', `${fmt(p.ne, 0)} · ${fmt(p.load, 2)}`, `${fmt(r.Pe, 0)} кВт`) +
      row('B<sub>ч</sub> = P<sub>э</sub> · b<sub>e</sub> · 10⁻⁶', `${fmt(r.Pe, 0)} · ${fmt(p.be, 0)} · 10⁻⁶`,
        `${fmtA(r.Bh)} т/ч`) +
      row('B<sub>сут</sub> = B<sub>ч</sub> · t<sub>сут</sub>', `${fmtA(r.Bh)} · ${fmt(p.hrs, 0)}`, `${fmtA(r.Bd)} т/сут`) +
      row('B<sub>рейс</sub> = B<sub>сут</sub> · A', `${fmtA(r.Bd)} · ${fmt(p.auto, 0)}`, `${fmtA(r.Ba)} т`) +
      row('m<sub>SO₂</sub> = 2 · B · S / 100', `2 · ${fmtA(r.Ba)} · ${fmtA(p.s)} / 100`, `${fmtA(r.so2)} т за рейс`) +
      row('m<sub>CO₂</sub> = B · C<sub>F</sub>', `${fmtA(r.Ba)} · ${fmtA(p.cf)}`, `${fmtA(r.co2)} т за рейс`) +
      row('m<sub>NOx</sub> = g<sub>NOx</sub> · P<sub>э</sub> · t<sub>сут</sub> · A · 10⁻⁶',
        `${fmtA(p.gnox)} · ${fmt(r.Pe, 0)} · ${fmt(p.hrs, 0)} · ${fmt(p.auto, 0)} · 10⁻⁶`, `${fmtA(r.nox)} т за рейс`);

    /* проверки по МАРПОЛ */
    const tierFormula = p.rpm < 130 ? 'постоянный предел' :
      (p.rpm < 2000 ? (p.tier === 'I' ? '45 · n<sup>−0,2</sup>' : p.tier === 'II' ? '44 · n<sup>−0,23</sup>' : '9 · n<sup>−0,2</sup>')
        : 'постоянный предел');
    $('calcMarpol').innerHTML =
      row(`Предел NOx (Tier ${p.tier}, n = ${fmt(p.rpm, 0)} об/мин)`, tierFormula,
        `${fmt(r.lim, 2)} г/(кВт·ч)`) +
      row('Проверка: g<sub>NOx</sub> ≤ предел', `${fmtA(p.gnox)} ≤ ${fmt(r.lim, 2)}`,
        badge(r.noxOk, 'соответствует', 'не соответствует')) +
      row(`Предел серы (${p.eca ? 'район контроля выбросов ECA' : 'вне районов контроля'})`, '',
        `${fmt(r.sLim, 2)} % m/m`) +
      row('Проверка: S ≤ предел', `${fmtA(p.s)} ≤ ${fmt(r.sLim, 2)}`,
        badge(r.sOk, 'соответствует', 'не соответствует')) +
      row('Эквивалент со скруббером S<sub>экв</sub> = S · (1 − η)',
        `${fmtA(p.s)} · (1 − ${fmt(p.eta, 2)})`,
        `${fmtA(r.sScrub)} % → ` + badge(r.scrubOk, 'соответствует', 'не соответствует')) +
      row('Сокращение выброса SO₂ скруббером',
        `${fmtA(r.so2)} − ${fmtA(2 * r.Ba * r.sScrub / 100)}`,
        `${fmtA(r.so2 - 2 * r.Ba * r.sScrub / 100)} т за рейс (−${fmt(p.eta * 100, 0)} %)`);

    /* сводка */
    $('sum').innerHTML = `<div class="live-sum">
      <div class="cell"><span class="k">Нефтесодержащие воды за рейс</span><span class="v">${fmtA(r.Vlv)} м³</span></div>
      <div class="cell"><span class="k">Сточные воды за рейс</span><span class="v">${fmtA(r.Vst)} м³</span></div>
      <div class="cell"><span class="k">Мусор за рейс</span><span class="v">${fmtA(r.mGar * p.auto)} кг</span></div>
      <div class="cell"><span class="k">SO₂ за рейс</span><span class="v">${fmtA(r.so2)} т</span></div>
      <div class="cell"><span class="k">NOx за рейс</span><span class="v">${fmtA(r.nox)} т</span></div>
      <div class="cell"><span class="k">CO₂ за рейс</span><span class="v">${fmtA(r.co2)} т</span></div>
    </div>`;

    /* диаграмма вариантов по сере */
    drawBars($('svgS'), r.varSO2.map(v => ({
      name: v.name, value: v.m, color: v.col,
      label: `${fmtA(v.m)} т (S = ${fmtA(v.s)} %)`,
    })), { title: 'Выброс SO₂ за рейс при разном содержании серы в топливе', unit: 'т', padR: 150 });

    /* живые подписи на схемах */
    const setT = (id, v) => { const e = $(id); if (e) e.textContent = v; };
    setT('svgVlv', `${fmtA(r.Vlv)} м³ за рейс`);
    setT('svgQsep', `${fmt(r.QsepStd, 2)} м³/ч`);
    setT('svgVst', `${fmtA(r.Vst)} м³ за рейс`);
    setT('svgQstp', `${fmt(r.QstpStd, 0)} м³/сут`);
    setT('svgSO2', `SO₂ после очистки ${fmtA(2 * r.Ba * r.sScrub / 100)} т/рейс`);
    setT('svgSeq', `эквивалент по сере ${fmtA(r.sScrub)} % (было ${fmtA(p.s)} %)`);
  }

  function init() {
    document.addEventListener('input', render);
    document.addEventListener('change', render);
    const b = $('btnReset');
    if (b) b.addEventListener('click', () => {
      document.querySelectorAll('#src input').forEach(el => { el.value = el.defaultValue; });
      document.querySelectorAll('#src select').forEach(el => {
        const d = el.querySelector('option[selected]');
        el.value = d ? d.value : el.options[0].value;
      });
      render();
    });
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
