# -*- coding: utf-8 -*-
"""Проверка расчётного ядра site/assets/eco.js.

Модуль eco.js — единственное место, где живут формулы разборов задач
(p-*.html). Ошибка в нём не поймается ни проверкой ссылок, ни разбором
HTML: страницы останутся валидными, а числа станут неверными. Поэтому
здесь проверяется сама арифметика, причём двумя независимыми способами:

  * встроенная самопроверка ECO.selftest() — контрольные точки, посчитанные
    аналитически (стехиометрия SO2, обратимость перевода единиц, точное
    обращение cм ⇄ ПДВ, непрерывность ветвей ОНД-86);
  * пересчёт ключевых величин на Python по формулам, выписанным здесь
    заново из ОНД-86 и МАРПОЛ, — так опечатка в JS не может «подтвердить
    сама себя».

Дополнительно проверяется, что числа, напечатанные на страницах разборов,
совпадают с тем, что выдаёт модуль: страница и модуль не должны разъезжаться.
"""
import json
import math
import os
import shutil
import subprocess

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ECO_JS = os.path.join(ROOT, 'site', 'assets', 'eco.js')
SITE = os.path.join(ROOT, 'site')

pytestmark = [
    pytest.mark.skipif(not os.path.isfile(ECO_JS), reason='нет site/assets/eco.js'),
    pytest.mark.skipif(not shutil.which('node'), reason='node не установлен'),
]


def eco(expr):
    """Выполнить выражение в node с загруженным модулем и вернуть результат."""
    src = 'const E = require(%s); console.log(JSON.stringify(%s));' % (
        json.dumps(ECO_JS), expr)
    r = subprocess.run(['node', '-e', src], capture_output=True, text=True)
    assert r.returncode == 0, 'node упал: %s' % r.stderr.strip()[:400]
    return json.loads(r.stdout.strip())


# ---------------------------------------------------------------- самопроверка

def test_selftest_passes():
    bad = eco('E.selftest()')
    assert bad == [], 'самопроверка модуля нашла расхождения:\n' + '\n'.join(bad)


# ------------------------------------------- независимый пересчёт на Python

#: параметры источника из разбора 2 (выхлопная труба дизель-генератора)
SRC = {'D': 0.35, 'w0': 25.0, 'H': 15.0, 'dT': 300.0}
A_STRAT = 140.0          # коэффициент стратификации, Санкт-Петербург


def py_plume(p):
    """Формулы ОНД-86, выписанные заново — независимо от кода eco.js."""
    v1 = math.pi * p['D'] ** 2 / 4 * p['w0']
    f = 1000 * p['w0'] ** 2 * p['D'] / (p['H'] ** 2 * p['dT'])
    vm = 0.65 * (v1 * p['dT'] / p['H']) ** (1 / 3)
    m = (1 / (0.67 + 0.1 * math.sqrt(f) + 0.34 * f ** (1 / 3))
         if f < 100 else 1.47 / f ** (1 / 3))
    if vm >= 2:
        n = 1.0
    elif vm >= 0.5:
        n = 0.532 * vm ** 2 - 2.13 * vm + 3.13
    else:
        n = 4.4 * vm
    return v1, f, vm, m, n


def test_plume_matches_python():
    v1, f, vm, m, n = py_plume(SRC)
    js = eco('E.plume(%s)' % json.dumps(SRC))
    assert js['V1'] == pytest.approx(v1, rel=1e-12)
    assert js['f'] == pytest.approx(f, rel=1e-12)
    assert js['vm'] == pytest.approx(vm, rel=1e-12)
    assert js['m'] == pytest.approx(m, rel=1e-12)
    assert js['n'] == pytest.approx(n, rel=1e-12)


def test_cmax_matches_python():
    v1, f, vm, m, n = py_plume(SRC)
    m_no2 = 1.16978                       # г/с, из разбора 1
    cm = A_STRAT * m_no2 * 1 * m * n / (SRC['H'] ** 2 * (v1 * SRC['dT']) ** (1 / 3))
    js = eco('E.cMax(%s, 1.16978, 140, 1, 1)' % json.dumps(SRC))
    assert js == pytest.approx(cm, rel=1e-12)
    # контрольное значение из разбора 2
    assert js == pytest.approx(0.0600, abs=5e-5)


def test_xmax_and_umax():
    v1, f, vm, m, n = py_plume(SRC)
    d = 7 * math.sqrt(vm) * (1 + 0.28 * f ** (1 / 3))     # ветвь vm > 2
    assert eco('E.xMax(%s, 1).x' % json.dumps(SRC)) == pytest.approx(d * SRC['H'], rel=1e-12)
    assert eco('E.xMax(%s, 1).x' % json.dumps(SRC)) == pytest.approx(228.3, abs=0.5)
    assert eco('E.uMax(%s)' % json.dumps(SRC)) == pytest.approx(
        vm * (1 + 0.12 * math.sqrt(f)), rel=1e-12)


def test_pdv_is_exact_inverse_of_cmax():
    """ПДВ обязан быть точным решением уравнения cм(M) + cф = ПДК."""
    pdv = eco('E.pdv(%s, 140, 1, 1, 0.2, 0.04)' % json.dumps(SRC))
    assert pdv == pytest.approx(3.121, abs=0.002)
    back = eco('E.cMax(%s, %r, 140, 1, 1)' % (json.dumps(SRC), pdv))
    assert back + 0.04 == pytest.approx(0.2, rel=1e-12)


def test_s1_shape():
    """Профиль вдоль оси факела: ноль в источнике, единица в максимуме,
    монотонное убывание за ним."""
    assert eco('E.s1(0, 1)') == pytest.approx(0.0, abs=1e-12)
    assert eco('E.s1(1, 1)') == pytest.approx(1.0, rel=1e-12)
    vals = eco('[1.5, 2, 3, 5, 8].map(r => E.s1(r, 1))')
    assert all(a > b for a, b in zip(vals, vals[1:])), 'профиль не убывает'
    # контрольная точка разбора 2: x/xм = 2,63
    assert eco('E.s1(600/228.3, 1)') == pytest.approx(0.595, abs=0.002)


def test_nox_tier_limits():
    """MAРПОЛ VI, Правило 13 — предельные значения по трём диапазонам."""
    assert eco('E.noxLimit(750, 1)') == pytest.approx(45 * 750 ** -0.2, rel=1e-12)
    assert eco('E.noxLimit(750, 2)') == pytest.approx(44 * 750 ** -0.23, rel=1e-12)
    assert eco('E.noxLimit(750, 2)') == pytest.approx(9.60, abs=0.01)
    assert eco('E.noxLimit(750, 3)') == pytest.approx(9 * 750 ** -0.2, rel=1e-12)
    # полки на краях диапазонов
    assert eco('E.noxLimit(100, 1)') == 17.0
    assert eco('E.noxLimit(100, 2)') == 14.4
    assert eco('E.noxLimit(100, 3)') == 3.4
    assert eco('E.noxLimit(2200, 1)') == 9.8
    assert eco('E.noxLimit(2200, 2)') == 7.7
    assert eco('E.noxLimit(2200, 3)') == 2.0


def test_so2_stoichiometry():
    """Одна тонна топлива с 1 % серы даёт ровно 20 кг SO2."""
    assert eco('E.so2ByFuel(1, 1, 0)') == pytest.approx(20.0, rel=1e-12)
    # разбор 1: 235,2 т топлива, 0,10 % серы
    assert eco('E.so2ByFuel(235.2, 0.10, 0)') == pytest.approx(470.4, rel=1e-12)
    # разбор 7: скруббер на эквивалент 0,10 % при топливе 3,5 %
    both = eco('[E.so2ByFuel(9000, 3.5, E.scrubberEta(3.5, 0.10)),'
               ' E.so2ByFuel(9000, 0.10, 0)]')
    assert both[0] == pytest.approx(both[1], rel=1e-9)
    assert both[1] == pytest.approx(18000.0, rel=1e-12)


def test_so2_co2_table():
    """Линейная аппроксимация воспроизводит таблицу эквивалентности."""
    table = eco('E.SO2_CO2')
    for s, ratio in table:
        got = eco('E.so2co2Ratio(%r)' % s)
        assert got == pytest.approx(ratio, rel=0.015), (
            'S = %s %%: получено %.1f вместо %.1f' % (s, got, ratio))


def test_stages_multiply_not_add():
    """Проскоки перемножаются; наивное сложение эффективностей неверно."""
    r = eco('E.stages(5000, [0.95, 0.90, 0.60])')
    assert r['cout'] == pytest.approx(10.0, rel=1e-12)
    assert r['eta'] == pytest.approx(1 - 0.05 * 0.10 * 0.40, rel=1e-12)
    r2 = eco('E.stages(6000, [0.85, 0.99])')
    assert r2['cout'] == pytest.approx(9.0, rel=1e-12)
    assert r2['eta'] == pytest.approx(0.9985, rel=1e-12)


def test_eta_required_and_last_stage():
    assert eco('E.etaRequired(5000, 15)') == pytest.approx(0.997, rel=1e-12)
    need = eco('E.etaLastStage(5000, [0.95, 0.90], 15)')
    closed = eco('E.stages(5000, [0.95, 0.90, %r]).cout' % need)
    assert closed == pytest.approx(15.0, rel=1e-9)


def test_oil_balance():
    """Для воды 1 мг/л = 1 г/м³, поэтому масса в кг равна V·c/1000."""
    r = eco('E.oilBalance(9, 5000, 10)')
    assert r['mIn'] == pytest.approx(45.0, rel=1e-12)
    assert r['mOut'] == pytest.approx(0.09, rel=1e-12)
    assert r['mCaught'] == pytest.approx(44.91, rel=1e-12)
    assert r['eta'] == pytest.approx(0.998, rel=1e-12)


def test_summation():
    """Три вещества по 0,5 ПДК дают полуторакратное превышение группы."""
    r = eco('E.summation([{c:0.5,pdk:1},{c:0.5,pdk:1},{c:0.5,pdk:1}])')
    assert r['total'] == pytest.approx(1.5, rel=1e-12)
    assert r['ok'] is False
    # фон учитывается наравне с расчётной концентрацией
    r2 = eco('E.summation([{c:0.06, cf:0.04, pdk:0.2}])')
    assert r2['total'] == pytest.approx(0.5, rel=1e-12)
    assert r2['ok'] is True


def test_fee_table_penalty():
    """Масса сверх норматива идёт со стократным коэффициентом."""
    r = eco('E.feeTable([{name:"x", m:12, mNorm:10, rate:100}], {kOver:100})')
    row = r['rows'][0]
    assert row['within'] == 10 and row['over'] == 2
    assert row['feeWithin'] == pytest.approx(1000.0)
    assert row['feeOver'] == pytest.approx(20000.0)
    assert r['total'] == pytest.approx(21000.0)
    # коэффициенты входят мультипликативно
    assert eco('E.feeItem(2, 100, 1.32, 2, 25)') == pytest.approx(
        2 * 100 * 1.32 * 2 * 25)


# --------------------------------------- согласование страниц и модуля

#: (файл разбора, строка, которая должна на нём присутствовать)
PAGE_NUMBERS = [
    ('p-diesel.html', '117,6 кг/ч'),
    ('p-diesel.html', '235,2 т/год'),
    ('p-diesel.html', '8,42 т/год'),
    ('p-disp.html', '2,405 м³/с'),
    ('p-disp.html', '0,0600 мг/м³'),
    ('p-disp.html', '228 м'),
    ('p-disp.html', '3,12 г/с'),
    ('p-bilge.html', '99,80 %'),
    ('p-bilge.html', '44,9 кг'),
    ('p-clean.html', '99,85 %'),
    ('p-clean.html', '93,7 %'),
    ('p-sulphur.html', '68,4 т'),
    ('p-sulphur.html', '97,1 %'),
]


@pytest.mark.parametrize('page,needle', PAGE_NUMBERS,
                         ids=['%s:%s' % (p, n) for p, n in PAGE_NUMBERS])
def test_page_shows_computed_number(page, needle):
    """Числа, полученные модулем, должны стоять и в тексте разбора."""
    path = os.path.join(SITE, page)
    if not os.path.isfile(path):
        pytest.skip('страница %s ещё не создана' % page)
    with open(path, encoding='utf-8') as fh:
        html = fh.read()
    assert needle in html, 'на странице %s нет значения «%s»' % (page, needle)


def test_key_page_values_are_reproducible():
    """Ключевые ответы разборов пересчитываются модулем «с нуля»."""
    got = eco("""(() => {
      const fr = E.fuelRate(800, 0.70, 210);
      const B = fr.Bh_t * 2000;
      const nox = fr.N * 9.4 / 3600;
      const sp = E.splitNOx(nox);
      const P = {D:0.35, w0:25, H:15, dT:300};
      return {
        Bh: fr.Bh_kg,
        Byear: B,
        no2_gs: sp.no2,
        no2_year: E.toTonsPerYear(sp.no2, 2000),
        so2_year: E.so2ByFuel(B, 0.10, 0) / 1000,
        cm: E.cMax(P, sp.no2, 140, 1, 1),
        xm: E.xMax(P, 1).x,
        pdv: E.pdv(P, 140, 1, 1, 0.2, 0.04),
        share: sp.no2 / E.pdv(P, 140, 1, 1, 0.2, 0.04),
      };
    })()""")
    assert got['Bh'] == pytest.approx(117.6, abs=0.05)
    assert got['Byear'] == pytest.approx(235.2, abs=0.05)
    assert got['no2_gs'] == pytest.approx(1.170, abs=0.001)
    assert got['no2_year'] == pytest.approx(8.42, abs=0.01)
    assert got['so2_year'] == pytest.approx(0.470, abs=0.001)
    assert got['cm'] == pytest.approx(0.0600, abs=0.0001)
    assert got['xm'] == pytest.approx(228, abs=1)
    assert got['pdv'] == pytest.approx(3.12, abs=0.01)
    assert got['share'] == pytest.approx(0.375, abs=0.002)
