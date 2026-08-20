'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('../src/lib/config.cjs');

const webDir = path.join(ROOT, 'web');
const stateDir = path.join(ROOT, 'state');
const distDir = path.join(ROOT, 'dist');
const required = ['index.html', 'dashboard-runtime.js'];

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function compact(tokens) {
  const n = Number(tokens || 0);
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

function staticFallback(snapshot) {
  const codex = snapshot.sources && snapshot.sources.codex || {};
  const deepseek = snapshot.sources && snapshot.sources.deepseek || {};
  const windows = (codex.windows || []).map((window) => {
    const used = Math.max(0, Math.min(100, Number(window.usedPct || 0)));
    const remaining = 100 - Math.round(used);
    const reset = window.resetAt ? `重置时间：${String(window.resetAt).slice(0, 16).replace('T', ' ')}` : '重置时间未知';
    return `<div class="window"><div class="quota-top"><span class="quota-remaining">${remaining}%</span><span class="reset">${escapeHtml(reset)}</span></div><div class="bar"><div class="fill" style="width:${used}%"></div></div></div>`;
  }).join('') || '<div class="error">没有可显示的额度窗口</div>';
  const rows = snapshot.usageHistory && snapshot.usageHistory.codex || [];
  const max = Math.max(1, ...rows.map((row) => Number(row.tokens || 0)));
  const chart = rows.map((row) => {
    const tokens = Number(row.tokens || 0);
    const height = tokens ? Math.max(3, Math.round(tokens / max * 100)) : 0;
    return `<div class="col"><div class="bar-v"><i style="height:${height}%"></i></div><div>${escapeHtml(String(row.date || '').slice(5))}</div><div>${escapeHtml(compact(tokens))}</div></div>`;
  }).join('') || '<div class="error">暂无历史 token 数据</div>';
  const balance = deepseek.ok ? `${deepseek.currency === 'CNY' ? '¥ ' : ''}${Number(deepseek.balance || 0).toFixed(2)}` : '¥ --';
  const updated = String(snapshot.updatedAt || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  const updatedText = updated ? `${updated[1]}年${Number(updated[2])}月${Number(updated[3])}日 ${updated[4]}:${updated[5]} 更新` : '更新时间未知';
  return { windows, chart, balance, detail: escapeHtml(deepseek.detail || '实时余额'), updatedText };
}

for (const name of required) {
  const source = path.join(webDir, name);
  if (!fs.existsSync(source)) throw new Error(`缺少网页文件：${source}`);
}
for (const name of ['data.json', 'data.js']) {
  const source = path.join(stateDir, name);
  if (!fs.existsSync(source)) {
    throw new Error(`缺少 ${source}。先运行 npm run demo 或 npm run collect`);
  }
}

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });
const snapshot = JSON.parse(fs.readFileSync(path.join(stateDir, 'data.json'), 'utf8'));
const fallback = staticFallback(snapshot);
for (const name of required) {
  let content = fs.readFileSync(path.join(webDir, name), 'utf8');
  if (name === 'index.html') {
    content = content
      .replace('<div id="codexWindows"></div>', `<div id="codexWindows">${fallback.windows}</div>`)
      .replace('<div class="chart" id="codexChart"></div>', `<div class="chart" id="codexChart">${fallback.chart}</div>`)
      .replace('<div class="balance" id="deepseekBalance">¥ --</div>', `<div class="balance" id="deepseekBalance">${escapeHtml(fallback.balance)}</div>`)
      .replace('<div class="detail" id="deepseekDetail">等待实时余额</div>', `<div class="detail" id="deepseekDetail">${fallback.detail}</div>`)
      .replace('<span id="updated">等待数据</span>', `<span id="updated">${escapeHtml(fallback.updatedText)}</span>`);
  }
  fs.writeFileSync(path.join(distDir, name), content, 'utf8');
}
for (const name of ['data.json', 'data.js']) {
  fs.copyFileSync(path.join(stateDir, name), path.join(distDir, name));
}
const endpoint = process.env.DASHBOARD_URL
  ? process.env.DASHBOARD_URL.replace(/\/+$/, '') + '/data.js'
  : 'data.js';
fs.writeFileSync(path.join(distDir, 'live-endpoint.js'),
  `window.DASH_LIVE_ENDPOINT = '${endpoint}';\n`, 'utf8');
fs.writeFileSync(path.join(distDir, '.nojekyll'), '', 'utf8');
process.stdout.write(`built ${distDir}\n`);
