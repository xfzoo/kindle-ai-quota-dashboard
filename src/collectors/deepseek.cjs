'use strict';

const fs = require('node:fs');

const {
  failedBalance,
  fetchJson,
  isoBeijing,
  round1,
} = require('../lib/common.cjs');

function readUsageFile(filePath) {
  if (!filePath) return { daily: [] };
  try {
    const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const rows = Array.isArray(payload) ? payload : payload.daily || payload.usage || [];
    return { daily: rows.map((item) => ({
      date: String(item.date || item.day || item.startDate || '').slice(0, 10),
      tokens: Number(item.tokens || item.total_tokens || item.totalTokens || 0),
    })).filter((item) => item.date && Number.isFinite(item.tokens)) };
  } catch {
    return { daily: [] };
  }
}

async function collectDeepSeek(config = {}) {
  const fetchedAt = isoBeijing();
  if (!config.enabled) {
    return { ...failedBalance('DeepSeek', '未启用', fetchedAt), disabled: true };
  }
  const envName = String(config.apiKeyEnv || 'DEEPSEEK_API_KEY');
  const key = String(process.env[envName] || '').trim();
  if (!key) return failedBalance('DeepSeek', `没有设置环境变量 ${envName}`, fetchedAt);
  try {
    const payload = await fetchJson('https://api.deepseek.com/user/balance', {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    });
    const rows = Array.isArray(payload && payload.balance_infos) ? payload.balance_infos : [];
    const row = rows.find((item) => item && item.currency === 'CNY') || rows[0];
    const balance = Number(row && row.total_balance);
    if (!Number.isFinite(balance)) throw new Error('余额响应缺少 total_balance');
    const currency = String(row.currency || 'CNY');
    return {
      ok: true,
      label: 'DeepSeek',
      balance: round1(balance * 100) / 100,
      currency,
      detail: `余额 ${currency === 'CNY' ? '¥' : `${currency} `}${balance.toFixed(2)}`,
      usage: readUsageFile(config.usageFile),
      fetchedAt,
      error: null,
    };
  } catch (error) {
    return failedBalance('DeepSeek', error, fetchedAt);
  }
}

module.exports = { collectDeepSeek };
