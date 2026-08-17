/* Общие помощники живых расчётов: форматирование чисел, строка
 * «формула = подстановка = результат», столбчатые SVG-диаграммы и обёртки
 * над DOM. Подключается первым, до site.js и скриптов конкретных страниц. */
'use strict';

const $ = (id) => document.getElementById(id);

/* Подпись на схеме: заменить текст элемента, если он есть на странице. */
const setT = (id, v) => { const e = $(id); if (e) e.textContent = v; };

/* Выполнить действие, когда разметка страницы полностью разобрана. */
const onReady = (fn) => (document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', fn) : fn());

/* палитра диаграмм */
const AX = '#6b6b74', INK = '#16161a', ACC = '#155e75';

/* ---------- числа ---------- */
function fmt(v, d = 2) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return v.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
}
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
function sup(n) {
  return String(n).replace(/-/g, '⁻').replace(/\d/g, c => SUP[+c]);
}
/* научная запись: 2,65·10⁻⁵ */
function fmtE(v, d = 2) {
  if (!isFinite(v)) return '—';
  if (v === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(v)));
  const m = v / Math.pow(10, e);
  return fmt(m, d) + '·10' + sup(e);
}
/* автоматический выбор: обычная запись для «человеческих» величин,
   научная — для очень малых и очень больших */
function fmtA(v, d = 3) {
  if (!isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a !== 0 && (a < 1e-3 || a >= 1e6)) return fmtE(v, d - 1);
  if (a === 0) return '0';
  if (a < 0.01) return fmt(v, 5);
  if (a < 1) return fmt(v, 4);
  if (a < 100) return fmt(v, d);
  return fmt(v, Math.max(0, d - 2));
}

/* ---------- строка расчёта ---------- */
/* «формула = <span серым>подстановка</span> = <b>результат</b>» */
function row(formula, subst, result, id) {
  return `<div class="calc"><span>${formula}</span>` +
    (subst ? ` = <span class="sub">${subst}</span>` : '') +
    ` = <b${id ? ` id="${id}"` : ''}>${result}</b></div>`;
}
function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function num(el, dflt = 0) {
  const v = parseFloat(String(el && el.value).replace(',', '.'));
  return isFinite(v) ? v : dflt;
}

/* ---------- SVG ---------- */
/* горизонтальная столбчатая диаграмма вкладов.
   items: [{name, value, color}], возвращает разметку внутренностей <svg>,
   размеры подобраны под viewBox="0 0 640 H" */
function barsH(items, opt) {
  const o = Object.assign({ W: 640, padL: 212, padR: 80, padT: 26, rowH: 26, title: '', unit: '' }, opt || {});
  const n = items.length;
  const H = o.padT + n * o.rowH + 30;
  const max = Math.max(1e-12, ...items.map(i => Math.abs(i.value)));
  const x0 = o.padL, x1 = o.W - o.padR;
  let s = '';
  if (o.title) s += `<text x="14" y="17" style="font:13px system-ui;fill:${AX}">${esc(o.title)}</text>`;
  items.forEach((it, k) => {
    const y = o.padT + k * o.rowH;
    const w = Math.max(1, (x1 - x0) * Math.abs(it.value) / max);
    const col = it.color || ACC;
    const nm = String(it.name).length > 27 ? String(it.name).slice(0, 26) + '…' : String(it.name);
    s += `<text x="${x0 - 8}" y="${y + 14}" text-anchor="end" style="font:12px system-ui;fill:${INK}">${esc(nm)}</text>`;
    s += `<rect x="${x0}" y="${y + 3}" width="${w.toFixed(1)}" height="14" rx="3" fill="${col}" opacity="0.82"/>`;
    s += `<text x="${Math.min(x1 + 6, x0 + w + 6)}" y="${y + 14}" style="font:12px system-ui;fill:${AX}">${esc(it.label !== undefined ? it.label : fmtA(it.value))}</text>`;
  });
  const yB = o.padT + n * o.rowH + 2;
  s += `<line x1="${x0}" y1="${o.padT - 4}" x2="${x0}" y2="${yB}" stroke="${AX}" stroke-width="1"/>`;
  s += `<text x="${x0}" y="${yB + 15}" style="font:11.5px system-ui;fill:${AX}">0</text>`;
  s += `<text x="${x1}" y="${yB + 15}" text-anchor="end" style="font:11.5px system-ui;fill:${AX}">${esc(fmtA(max))}${o.unit ? ' ' + esc(o.unit) : ''}</text>`;
  return { markup: s, H };
}

/* отрисовать диаграмму в существующий <svg id=...>, подогнав viewBox */
function drawBars(svgEl, items, opt) {
  if (!svgEl) return;
  const { markup, H } = barsH(items, opt);
  svgEl.setAttribute('viewBox', `0 0 640 ${H}`);
  svgEl.innerHTML = markup;
}
