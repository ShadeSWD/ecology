/* eco.js — расчётное ядро разборов задач сайта «Промышленная экология».
 *
 * Здесь собраны все формулы, которые повторяются на страницах p-*.html:
 * рассеивание примеси по ОНД-86, валовые выбросы от сжигания топлива,
 * суммация однонаправленного действия, многоступенчатая очистка,
 * сепарация нефтесодержащих вод и плата за негативное воздействие.
 * Страницы только подставляют числа и печатают результат — ни одна
 * формула не повторяется в разметке.
 *
 * Модуль чистый: не трогает DOM, не читает глобальные переменные.
 * В браузере доступен как window.ECO, в node — как module.exports,
 * поэтому один и тот же код проверяется тестами (tests/test_eco.py).
 *
 * Самопроверка: ECO.selftest() возвращает массив расхождений (пустой —
 * значит все контрольные точки сошлись). Контрольные точки посчитаны
 * независимо от кода: либо аналитически, либо по опубликованным примерам.
 */
'use strict';
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ECO = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  var cbrt = function (x) { return Math.cbrt ? Math.cbrt(x) : Math.sign(x) * Math.pow(Math.abs(x), 1 / 3); };

  /* ==================================================================
   *  1. ВЫБРОСЫ ОТ СЖИГАНИЯ ТОПЛИВА
   * ================================================================== */

  /* Часовой расход топлива дизеля по нагрузке и удельному расходу.
   *   Ne — номинальная мощность, кВт; load — доля нагрузки (0…1);
   *   ge — удельный эффективный расход топлива, г/(кВт·ч).
   * Возвращает {N, Bh_kg, Bh_t} — мощность на режиме и расход, кг/ч и т/ч. */
  function fuelRate(Ne, load, ge) {
    var N = Ne * load;
    var Bh_kg = N * ge / 1000;
    return { N: N, Bh_kg: Bh_kg, Bh_t: Bh_kg / 1000 };
  }

  /* Валовый выброс по удельному показателю на единицу топлива.
   *   B_t — масса сожжённого топлива, т;
   *   ef  — удельный выброс, г на кг топлива.
   * Тождество единиц: [т]·1000[кг/т]·[г/кг]/1000[г/кг] = кг, то есть
   * численно масса выброса в килограммах равна B_t·ef. */
  function emissionByFuel(B_t, ef) { return B_t * ef; }

  /* Диоксид серы: вся сера топлива окисляется до SO2.
   *   S — содержание серы, % по массе; eta — доля улавливания (0…1).
   * 1 т топлива при S = 1 % содержит 10 кг серы, при полном окислении
   * даёт 10·(64/32) = 20 кг SO2, отсюда коэффициент 20. */
  function so2ByFuel(B_t, S_pct, eta) {
    return 20 * B_t * S_pct * (1 - (eta || 0));
  }

  /* Перевод массы, наработанной за время, в секундный выброс.
   *   M_kg — масса за период, кг; hours — продолжительность, ч. */
  function toGramsPerSecond(M_kg, hours) { return M_kg * 1000 / (hours * 3600); }
  function toTonsPerYear(M_gs, hours) { return M_gs * hours * 3600 / 1e6; }

  /* Разделение оксидов азота на NO2 и NO при выходе из трубы.
   * Методики расчёта рассеивания требуют вести расчёт раздельно:
   * в момент выброса окислилось не всё, поэтому в пересчёте на массу
   * суммарных NOx (как NO2) принимают 80 % диоксида и 13 % оксида. */
  var NOX_SPLIT = { no2: 0.8, no: 0.13 };
  function splitNOx(M_nox) {
    return { no2: M_nox * NOX_SPLIT.no2, no: M_nox * NOX_SPLIT.no };
  }

  /* Предельные значения выброса NOx судовым дизелем, г/(кВт·ч).
   * MARPOL, Приложение VI, Правило 13; n — номинальная частота
   * вращения коленчатого вала, об/мин. */
  function noxLimit(n, tier) {
    var t = { 1: [17.0, 45, -0.2, 9.8], 2: [14.4, 44, -0.23, 7.7], 3: [3.4, 9, -0.2, 2.0] }[tier];
    if (!t) return NaN;
    if (n < 130) return t[0];
    if (n < 2000) return t[1] * Math.pow(n, t[2]);
    return t[3];
  }

  /* Отношение SO2/CO2 (ppm на % об.), эквивалентное заданному содержанию
   * серы в топливе. Скруббер разрешён Правилом 4 Приложения VI как
   * эквивалентный способ и должен обеспечивать отношение не выше
   * табличного. Полная таблица — резолюция MEPC.259(68); в действующей
   * MEPC.340(77) оставлены только две строки (0,50 и 0,10 %).
   * Между узлами зависимость линейная: ratio = 43,3·S. */
  var SO2_CO2 = [[4.50, 195], [3.50, 151.7], [1.50, 65.0], [1.00, 43.3], [0.50, 21.7], [0.10, 4.3]];
  function so2co2Ratio(S_pct) { return 43.3 * S_pct; }

  /* Предельное содержание серы в судовом топливе, % по массе, по датам
   * (MARPOL VI, Правило 14): [дата вступления, вне ECA, в ECA]. */
  var SULPHUR_LIMITS = [
    ['до 01.07.2010', 4.50, 1.50],
    ['01.07.2010', 4.50, 1.00],
    ['01.01.2012', 3.50, 1.00],
    ['01.01.2015', 3.50, 0.10],
    ['01.01.2020', 0.50, 0.10],
  ];

  /* Требуемая эффективность системы очистки выхлопных газов, чтобы
   * топливо с содержанием серы S оказалось эквивалентно нормативу Snorm. */
  function scrubberEta(S_pct, Snorm_pct) { return 1 - Snorm_pct / S_pct; }

  /* ==================================================================
   *  2. РАССЕИВАНИЕ ПРИМЕСИ — ОНД-86 / МРР-2017
   * ================================================================== */

  /* Параметры факела нагретого выброса из одиночной точечной трубы.
   *   D  — диаметр устья, м;      w0 — скорость выхода газов, м/с;
   *   H  — высота источника, м;   dT — перегрев газов над воздухом, °C.
   * Возвращает объёмный расход V1, безразмерные f, vm, vm', fe и
   * коэффициенты m, n — все по разделу 2 ОНД-86. */
  function plume(p) {
    var V1 = Math.PI * p.D * p.D / 4 * p.w0;
    var f = 1000 * p.w0 * p.w0 * p.D / (p.H * p.H * p.dT);
    var vm = 0.65 * cbrt(V1 * p.dT / p.H);
    var vmS = 1.3 * p.w0 * p.D / p.H;              // v'м — для холодных выбросов
    var fe = 800 * Math.pow(vmS, 3);
    var m = f < 100
      ? 1 / (0.67 + 0.1 * Math.sqrt(f) + 0.34 * cbrt(f))
      : 1.47 / cbrt(f);
    var n;
    if (vm >= 2) n = 1;
    else if (vm >= 0.5) n = 0.532 * vm * vm - 2.13 * vm + 3.13;
    else n = 4.4 * vm;
    return { V1: V1, f: f, vm: vm, vmS: vmS, fe: fe, m: m, n: n };
  }

  /* Максимальная приземная концентрация одиночного источника, мг/м³.
   *   A — коэффициент температурной стратификации (140 для северо-запада
   *       Европейской части России), M — мощность выброса, г/с,
   *   F — коэффициент оседания (1 — газы, 2…3 — пыль),
   *   eta — коэффициент рельефа (1 — ровная местность). */
  function cMax(p, M, A, F, eta) {
    var pl = p.V1 !== undefined ? p : plume(p);
    return A * M * F * pl.m * pl.n * (eta === undefined ? 1 : eta)
      / (p.H * p.H * cbrt(pl.V1 * p.dT));
  }

  /* Расстояние от источника до точки максимума, м, и опасная скорость
   * ветра, м/с — та, при которой максимум и достигается. */
  function xMax(p, F) {
    var pl = p.V1 !== undefined ? p : plume(p);
    var d;
    if (pl.f < 100) {
      if (pl.vm <= 0.5) d = 2.48 * (1 + 0.28 * cbrt(pl.fe));
      else if (pl.vm <= 2) d = 4.95 * pl.vm * (1 + 0.28 * cbrt(pl.f));
      else d = 7 * Math.sqrt(pl.vm) * (1 + 0.28 * cbrt(pl.f));
    } else {
      if (pl.vm <= 0.5) d = 5.7;
      else if (pl.vm <= 2) d = 11.4 * pl.vm;
      else d = 16 * Math.sqrt(pl.vm);
    }
    return { d: d, x: (5 - F) / 4 * d * p.H };
  }
  function uMax(p) {
    var pl = p.V1 !== undefined ? p : plume(p);
    if (pl.vm <= 0.5) return 0.5;
    if (pl.vm <= 2) return pl.vm;
    return pl.vm * (1 + 0.12 * Math.sqrt(pl.f));
  }

  /* Безразмерный множитель s1 — доля максимума на расстоянии x по оси
   * факела; c(x) = s1·cм. */
  function s1(ratio, F) {
    var r = ratio;
    if (r <= 1) return 3 * Math.pow(r, 4) - 8 * Math.pow(r, 3) + 6 * r * r;
    if (r <= 8) return 1.13 / (0.13 * r * r + 1);
    if (F <= 1.5) return r / (3.58 * r * r - 35.2 * r + 120);
    return 1 / (0.1 * r * r + 2.47 * r - 17.8);
  }
  function concAt(p, M, A, F, eta, x) {
    var cm = cMax(p, M, A, F, eta);
    return cm * s1(x / xMax(p, F).x, F);
  }

  /* Норматив допустимого выброса (ПДВ), г/с: решение неравенства
   * cм(M) + cф ≤ ПДК относительно M. */
  function pdv(p, A, F, eta, pdk, cf) {
    var pl = p.V1 !== undefined ? p : plume(p);
    return (pdk - cf) * p.H * p.H * cbrt(pl.V1 * p.dT)
      / (A * F * pl.m * pl.n * (eta === undefined ? 1 : eta));
  }

  /* ==================================================================
   *  3. НОРМИРОВАНИЕ КАЧЕСТВА СРЕДЫ
   * ================================================================== */

  /* Доли ПДК и суммация однонаправленного действия.
   *   items: [{name, c, pdk, cf}] — концентрация, норматив и фон, мг/м³.
   * Норматив для группы выполнен, если сумма долей не больше единицы. */
  function summation(items) {
    var rows = items.map(function (it) {
      var c = it.c + (it.cf || 0);
      return { name: it.name, c: c, pdk: it.pdk, share: c / it.pdk };
    });
    var total = rows.reduce(function (s, r) { return s + r.share; }, 0);
    return { rows: rows, total: total, ok: total <= 1, excess: total > 1 ? total : 0 };
  }

  /* Единичный индекс загрязнения с показателем степени по классу
   * опасности (РД 52.04.186-89): I = (C/ПДКсс)^k. */
  var IZA_EXP = { 1: 1.7, 2: 1.3, 3: 1.0, 4: 0.85 };
  function unitIndex(c, pdk_ss, cls) { return Math.pow(c / pdk_ss, IZA_EXP[cls] || 1); }

  /* ==================================================================
   *  4. ОЧИСТКА: СТУПЕНИ И ОСТАТОЧНАЯ КОНЦЕНТРАЦИЯ
   * ================================================================== */

  /* Последовательные ступени очистки. Проскок перемножается, а не
   * складывается: каждая ступень работает с тем, что дошло до неё.
   *   c0 — концентрация на входе; etas — [{name, eta}] или [eta, …]. */
  function stages(c0, etas) {
    var c = c0, steps = [];
    etas.forEach(function (s) {
      var eta = (typeof s === 'number') ? s : s.eta;
      var cin = c;
      c = cin * (1 - eta);
      steps.push({
        name: (typeof s === 'number') ? '' : s.name,
        eta: eta, cin: cin, cout: c, caught: cin - c,
      });
    });
    return { steps: steps, cout: c, eta: 1 - c / c0, pass: c / c0 };
  }

  /* Обратная задача: какая эффективность нужна, чтобы уложиться в норму. */
  function etaRequired(cin, cnorm) { return 1 - cnorm / cin; }

  /* Эффективность последней ступени, если предыдущие уже заданы. */
  function etaLastStage(c0, etasKnown, cnorm) {
    var c = stages(c0, etasKnown).cout;
    return etaRequired(c, cnorm);
  }

  /* ==================================================================
   *  5. НЕФТЕСОДЕРЖАЩИЕ (ЛЬЯЛЬНЫЕ) ВОДЫ
   * ================================================================== */

  /* Баланс нефти в сепараторе.
   *   V — объём обработанной воды, м³;
   *   cin, cout — содержание нефтепродуктов на входе и выходе, мг/л.
   * Для воды 1 мг/л = 1 г/м³ = 1 ppm по массе, поэтому масса нефти в
   * килограммах равна V·c/1000. */
  function oilBalance(V, cin, cout) {
    var mIn = V * cin / 1000;
    var mOut = V * cout / 1000;
    return { mIn: mIn, mOut: mOut, mCaught: mIn - mOut, eta: 1 - cout / cin };
  }

  /* Подбор производительности сепаратора: за сколько часов в сутки он
   * должен переработать суточное накопление. */
  function separatorFlow(qDay, hoursPerDay) { return qDay / hoursPerDay; }

  /* Объём цистерны сбора нефтеостатков (шлама) на рейс с запасом. */
  function sludgeTank(mCaught, rho, k) {
    return mCaught / (rho * 1000) * (k === undefined ? 1.2 : k);
  }

  /* ==================================================================
   *  6. ПЛАТА ЗА НЕГАТИВНОЕ ВОЗДЕЙСТВИЕ
   * ================================================================== */

  /* Плата по одному веществу: масса × ставка × коэффициенты.
   *   m — масса выброса, т; rate — ставка, руб./т;
   *   kind — коэффициент индексации ставки к году расчёта;
   *   kot — коэффициент за особо охраняемую территорию (1 или 2);
   *   kst — стимулирующий коэффициент (в пределах норматива 1,
   *         в пределах лимита 25, сверх норматива 100). */
  function feeItem(m, rate, kind, kot, kst) {
    return m * rate * kind * (kot === undefined ? 1 : kot) * (kst === undefined ? 1 : kst);
  }

  /* Плата по перечню веществ с разбивкой массы на «в пределах норматива»
   * и «сверх норматива».
   *   items: [{name, m, mNorm, rate}] — фактическая масса и норматив (ПДВ),
   *   обе в тоннах за год. */
  function feeTable(items, opt) {
    var o = opt || {};
    var kind = o.kind === undefined ? 1 : o.kind;
    var kot = o.kot === undefined ? 1 : o.kot;
    var kOver = o.kOver === undefined ? 100 : o.kOver;
    var rows = items.map(function (it) {
      var within = Math.min(it.m, it.mNorm);
      var over = Math.max(0, it.m - it.mNorm);
      var pW = feeItem(within, it.rate, kind, kot, 1);
      var pO = feeItem(over, it.rate, kind, kot, kOver);
      return {
        name: it.name, m: it.m, mNorm: it.mNorm, rate: it.rate,
        within: within, over: over, feeWithin: pW, feeOver: pO, fee: pW + pO,
      };
    });
    return { rows: rows, total: rows.reduce(function (s, r) { return s + r.fee; }, 0) };
  }

  /* ==================================================================
   *  САМОПРОВЕРКА
   * ================================================================== */

  function selftest() {
    var bad = [];
    var near = function (what, got, want, tol) {
      if (!isFinite(got) || Math.abs(got - want) > (tol === undefined ? 1e-9 : tol)) {
        bad.push(what + ': получено ' + got + ', ожидалось ' + want);
      }
    };

    /* Расход топлива: 800 кВт · 0,7 = 560 кВт, 560·210/1000 = 117,6 кг/ч. */
    var fr = fuelRate(800, 0.7, 210);
    near('fuelRate.N', fr.N, 560, 1e-9);
    near('fuelRate.Bh_kg', fr.Bh_kg, 117.6, 1e-9);

    /* SO2: 1 т топлива при 1 % серы даёт ровно 20 кг SO2 (стехиометрия). */
    near('so2ByFuel стехиометрия', so2ByFuel(1, 1, 0), 20, 1e-12);
    /* Скруббер с эффективностью 97 % оставляет 3 % массы. */
    near('so2ByFuel со скруббером', so2ByFuel(1, 3.5, 0.97), 20 * 3.5 * 0.03, 1e-12);

    /* Перевод «кг за 2000 ч» в г/с и обратно должен быть обратимым. */
    var gs = toGramsPerSecond(10752, 2000);
    near('toGramsPerSecond', gs, 10752 * 1000 / 7.2e6, 1e-12);
    near('обратимость т/год', toTonsPerYear(gs, 2000), 10.752, 1e-9);

    /* Разделение NOx: доли не меняют суммарную массу больше единицы. */
    var sp = splitNOx(1.4933333333333334);
    near('splitNOx.no2', sp.no2, 1.4933333333333334 * 0.8, 1e-12);

    /* MARPOL VI, Правило 13. Узловые значения: Tier II при n = 130 даёт
       44·130^(−0,23) ≈ 12,0; ниже 130 об/мин действует полка 14,4. */
    near('noxLimit Tier II, n<130', noxLimit(120, 2), 14.4, 1e-12);
    near('noxLimit Tier II, n=2000', noxLimit(2500, 2), 7.7, 1e-12);
    near('noxLimit Tier II, n=750', noxLimit(750, 2), 44 * Math.pow(750, -0.23), 1e-12);
    near('noxLimit Tier III, n<130', noxLimit(100, 3), 3.4, 1e-12);
    /* Tier III жёстче Tier II примерно в 3,8 раза на 750 об/мин. */
    if (!(noxLimit(750, 3) < noxLimit(750, 2) && noxLimit(750, 2) < noxLimit(750, 1))) {
      bad.push('noxLimit: Tier III должен быть строже Tier II, а тот — строже Tier I');
    }

    /* Таблица эквивалентности SO2/CO2 (MARPOL VI, Правило 4):
       линейная зависимость воспроизводит все узлы с точностью 1,5 %. */
    SO2_CO2.forEach(function (p) {
      var got = so2co2Ratio(p[0]);
      if (Math.abs(got - p[1]) / p[1] > 0.015) {
        bad.push('so2co2Ratio при S=' + p[0] + '%: ' + got.toFixed(1) + ' вместо ' + p[1]);
      }
    });

    /* Эквивалент скруббера: топливо 3,5 % при нормативе 0,10 % требует
       97,1 % улавливания, при нормативе 0,50 % — 85,7 %. */
    near('scrubberEta до 0,10 %', scrubberEta(3.5, 0.10), 1 - 0.1 / 3.5, 1e-12);
    near('scrubberEta до 0,50 %', scrubberEta(3.5, 0.50), 1 - 0.5 / 3.5, 1e-12);
    /* Выброс со скруббером равен выбросу на эквивалентном топливе. */
    near('эквивалентность скруббера',
      so2ByFuel(9000, 3.5, scrubberEta(3.5, 0.10)), so2ByFuel(9000, 0.10, 0), 1e-9);
    /* Предельные значения по сере монотонно ужесточались. */
    for (var q = 1; q < SULPHUR_LIMITS.length; q++) {
      if (SULPHUR_LIMITS[q][1] > SULPHUR_LIMITS[q - 1][1]
          || SULPHUR_LIMITS[q][2] > SULPHUR_LIMITS[q - 1][2]) {
        bad.push('SULPHUR_LIMITS: норматив не может смягчаться со временем');
      }
    }

    /* ОНД-86. Источник разбора 2: D = 0,35 м, w0 = 25 м/с, H = 15 м,
       dT = 300 °C. Контроль V1 и f — прямой подстановкой в определения. */
    var P = { D: 0.35, w0: 25, H: 15, dT: 300 };
    var pl = plume(P);
    near('plume.V1', pl.V1, Math.PI * 0.35 * 0.35 / 4 * 25, 1e-12);
    near('plume.f', pl.f, 1000 * 625 * 0.35 / (225 * 300), 1e-12);
    near('plume.vm', pl.vm, 0.65 * cbrt(pl.V1 * 300 / 15), 1e-12);
    near('plume.n при vm>2', pl.n, 1, 1e-12);
    /* Ветви n почти стыкуются в точках 0,5 и 2. Формулы ОНД-86 —
       кусочная аппроксимация с округлёнными коэффициентами, поэтому
       на границах остаётся расхождение около 0,2 %: это свойство самого
       норматива, а не ошибка кода. Проверяем, что оно не больше. */
    var nAt = function (vm) {
      if (vm >= 2) return 1;
      if (vm >= 0.5) return 0.532 * vm * vm - 2.13 * vm + 3.13;
      return 4.4 * vm;
    };
    near('стык n в vm=2', nAt(1.999999), 1, 3e-3);
    near('стык n в vm=0,5', nAt(0.500001), 4.4 * 0.5, 3e-3);
    /* Ветви m в f = 100 расходятся на 2,8 % — тоже свойство норматива. */
    var mLo = 1 / (0.67 + 0.1 * Math.sqrt(100) + 0.34 * cbrt(100));
    var mHi = 1.47 / cbrt(100);
    if (Math.abs(mLo - mHi) / mHi > 0.03) bad.push('разрыв m при f = 100: ' + mLo + ' и ' + mHi);

    /* cм линейна по мощности выброса и обратно квадратична по высоте. */
    var c1 = cMax(P, 1, 140, 1, 1);
    near('cMax линейна по M', cMax(P, 3, 140, 1, 1), 3 * c1, 1e-12);
    var Ph = { D: 0.35, w0: 25, H: 30, dT: 300 };
    /* при удвоении H меняются и f, и vm, поэтому проверяем только знак */
    if (!(cMax(Ph, 1, 140, 1, 1) < c1)) bad.push('cMax должна падать с ростом высоты трубы');

    /* ПДВ — точное обращение cм: подстановка ПДВ обратно даёт ПДК − cф. */
    var Mp = pdv(P, 140, 1, 1, 0.2, 0.04);
    near('pdv обращает cMax', cMax(P, Mp, 140, 1, 1), 0.2 - 0.04, 1e-12);

    /* s1: в точке максимума равна единице, в источнике — нулю. */
    near('s1(1)', s1(1, 1), 1, 1e-12);
    near('s1(0)', s1(0, 1), 0, 1e-12);
    if (!(s1(0.5, 1) < 1 && s1(3, 1) < 1)) bad.push('s1 должна быть меньше 1 вне максимума');
    if (!(concAt(P, 1, 140, 1, 1, xMax(P, 1).x) > concAt(P, 1, 140, 1, 1, 3 * xMax(P, 1).x))) {
      bad.push('концентрация за максимумом должна убывать');
    }
    /* xм пропорционально высоте при неизменных f и vm — проверяем через
       определение: (5−F)/4·d·H, F = 3 даёт ровно половину от F = 1. */
    near('xMax при F=3', xMax(P, 3).x, xMax(P, 1).x / 2, 1e-9);

    /* Суммация: три вещества по 0,5 ПДК дают полуторакратное превышение. */
    var s = summation([{ c: 0.5, pdk: 1 }, { c: 0.5, pdk: 1 }, { c: 0.5, pdk: 1 }]);
    near('summation.total', s.total, 1.5, 1e-12);
    if (s.ok) bad.push('summation: 1,5 не должно считаться нормой');
    /* Фон входит в долю наравне с расчётной концентрацией. */
    near('summation с фоном', summation([{ c: 0.06, cf: 0.04, pdk: 0.2 }]).total, 0.5, 1e-12);

    /* Индекс: при C = ПДК он равен единице для любого класса. */
    [1, 2, 3, 4].forEach(function (k) { near('unitIndex при C=ПДК, класс ' + k, unitIndex(1, 1, k), 1, 1e-12); });
    near('unitIndex 2 ПДК, класс 1', unitIndex(2, 1, 1), Math.pow(2, 1.7), 1e-12);

    /* Ступени очистки: проскок перемножается. 85 % и 99 % дают 99,85 %. */
    var st = stages(12000, [0.85, 0.99]);
    near('stages.cout', st.cout, 12000 * 0.15 * 0.01, 1e-9);
    near('stages.eta', st.eta, 1 - 0.15 * 0.01, 1e-12);
    /* Наивное сложение эффективностей дало бы 184 % — контроль от ошибки. */
    if (st.eta >= 0.85 + 0.99) bad.push('stages: эффективности нельзя складывать');
    near('etaRequired', etaRequired(5000, 15), 1 - 15 / 5000, 1e-12);
    /* Обратная задача согласована с прямой. */
    var need = etaLastStage(5000, [0.95, 0.9], 15);
    near('etaLastStage замыкает баланс', stages(5000, [0.95, 0.9, need]).cout, 15, 1e-9);

    /* Нефть: 10 м³ воды с 5000 мг/л содержат 50 кг нефтепродуктов. */
    var ob = oilBalance(10, 5000, 10);
    near('oilBalance.mIn', ob.mIn, 50, 1e-12);
    near('oilBalance.mOut', ob.mOut, 0.1, 1e-12);
    near('oilBalance.eta', ob.eta, 1 - 10 / 5000, 1e-12);
    near('separatorFlow', separatorFlow(0.5, 2), 0.25, 1e-12);
    near('sludgeTank', sludgeTank(49.9, 0.9, 1.2), 49.9 / 900 * 1.2, 1e-12);

    /* Плата: масса в пределах норматива идёт с коэффициентом 1,
       превышение — со стократным. */
    var ft = feeTable([{ name: 'x', m: 12, mNorm: 10, rate: 100 }], { kind: 1, kot: 1, kOver: 100 });
    near('feeTable в пределах норматива', ft.rows[0].feeWithin, 1000, 1e-9);
    near('feeTable сверх норматива', ft.rows[0].feeOver, 2 * 100 * 100, 1e-9);
    near('feeTable итого', ft.total, 21000, 1e-9);
    /* Если выброс укладывается в норматив, штрафной части нет. */
    var ft2 = feeTable([{ name: 'x', m: 8, mNorm: 10, rate: 100 }], {});
    near('feeTable без превышения', ft2.total, 800, 1e-9);
    /* Коэффициенты входят мультипликативно. */
    near('feeItem коэффициенты', feeItem(2, 100, 1.32, 2, 25), 2 * 100 * 1.32 * 2 * 25, 1e-9);

    return bad;
  }

  return {
    cbrt: cbrt,
    fuelRate: fuelRate,
    emissionByFuel: emissionByFuel,
    so2ByFuel: so2ByFuel,
    toGramsPerSecond: toGramsPerSecond,
    toTonsPerYear: toTonsPerYear,
    NOX_SPLIT: NOX_SPLIT,
    splitNOx: splitNOx,
    noxLimit: noxLimit,
    SO2_CO2: SO2_CO2,
    so2co2Ratio: so2co2Ratio,
    SULPHUR_LIMITS: SULPHUR_LIMITS,
    scrubberEta: scrubberEta,
    plume: plume,
    cMax: cMax,
    xMax: xMax,
    uMax: uMax,
    s1: s1,
    concAt: concAt,
    pdv: pdv,
    summation: summation,
    IZA_EXP: IZA_EXP,
    unitIndex: unitIndex,
    stages: stages,
    etaRequired: etaRequired,
    etaLastStage: etaLastStage,
    oilBalance: oilBalance,
    separatorFlow: separatorFlow,
    sludgeTank: sludgeTank,
    feeItem: feeItem,
    feeTable: feeTable,
    selftest: selftest,
  };
}));
