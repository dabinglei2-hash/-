(function (root) {
  'use strict';
  const listName = (type) => ({ study: 'studies', finance: 'finances' })[type];
  function linkedLog(personal, type, id) {
    const key = type === 'study' ? 'studyRecordId' : 'financeRecordId';
    return (personal.dailyLogs || []).find((log) => log[key] === id) || null;
  }
  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function prepare(current, personal, options) {
    const { type, id, expected, fields, newId, createdAt } = options;
    const key = listName(type);
    if (!key) return { error: '记录类型无效。' };
    const existing = id ? current[key].find((record) => record.id === id) : null;
    if (id && !existing) return { error: '这条记录已被删除，请取消编辑并重新查看。' };
    if (existing) {
      const log = linkedLog(personal, type, id);
      if (log) return { error: '这条明细关联今日记录，请进入对应日期统一编辑。', redirectDate: log.date };
      if (!expected || JSON.stringify(existing) !== JSON.stringify(expected)) return { error: '这条记录已发生变化，请取消编辑后重新打开，避免覆盖新内容。' };
    }
    if (!validDate(fields.date)) return { error: '请选择有效的记录日期。' };
    let values;
    if (type === 'study') {
      const content = String(fields.content || '').trim();
      const duration = Number(fields.duration);
      const minimum = existing?.duration === 0 ? 0 : 1;
      if (!content || content.length > 100) return { error: '请填写 1–100 字的学习内容。' };
      if (String(fields.duration).trim() === '' || !Number.isInteger(duration) || duration < minimum || duration > 1440) return { error: `学习时长应为 ${minimum}–1440 的整数分钟。` };
      values = { date: fields.date, content, duration };
    } else {
      const income = fields.income === '' ? 0 : Number(fields.income);
      const expense = fields.expense === '' ? 0 : Number(fields.expense);
      const note = String(fields.note || '').trim();
      if ([income, expense].some((value) => !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER / 100 || Math.abs(value * 100 - Math.round(value * 100)) > 1e-7)) return { error: '金额应为非负数，最多保留两位小数。' };
      if (!existing && !options.allowZero && income === 0 && expense === 0) return { error: '新增流水时，请至少填写一项大于 0 的收入或支出。' };
      if (note.length > 120) return { error: '备注最多填写 120 字。' };
      values = { date: fields.date, income: Math.round(income * 100) / 100, expense: Math.round(expense * 100) / 100, note };
    }
    const record = existing ? { ...existing, ...values } : { id: newId, ...values, createdAt };
    const nextData = { ...current, [key]: existing ? current[key].map((item) => item.id === id ? record : item) : [...current[key], record] };
    return { data: nextData, record, edited: Boolean(existing), error: '' };
  }
  const api = { prepare, linkedLog };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LifeRecordEditor = api;
})(typeof window === 'undefined' ? globalThis : window);
