(function (root) {
  'use strict';

  const DAY_MS = 24 * 60 * 60 * 1000;
  const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  function parseDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
  }

  function dateKey(value) {
    const key = value.toISOString().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : '';
  }

  function shiftedDate(date, days) {
    return new Date(date.getTime() + days * DAY_MS);
  }

  function range(period, anchor) {
    const result = { period, anchor, start: '', end: '', label: '', buckets: [], error: '' };
    if (!['week', 'month', 'year'].includes(period)) {
      result.error = '请选择周、月或年。';
      return result;
    }
    const date = parseDate(anchor);
    if (!date) {
      result.error = '请选择有效日期。';
      return result;
    }
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    if (period === 'week') {
      const first = shiftedDate(date, -((date.getUTCDay() + 6) % 7));
      result.start = dateKey(first);
      result.end = dateKey(shiftedDate(first, 6));
      result.label = `${result.start} 至 ${result.end}`;
      for (let index = 0; index < 7; index += 1) {
        const key = dateKey(shiftedDate(first, index));
        result.buckets.push({ key, start: key, end: key, label: WEEKDAYS[index] });
      }
    } else if (period === 'month') {
      const first = new Date(date.getTime());
      first.setUTCDate(1);
      const last = new Date(first.getTime());
      last.setUTCMonth(month + 1, 0);
      result.start = dateKey(first);
      result.end = dateKey(last);
      result.label = `${year} 年 ${month + 1} 月`;
      for (let day = 1; day <= last.getUTCDate(); day += 1) {
        const key = dateKey(shiftedDate(first, day - 1));
        result.buckets.push({ key, start: key, end: key, label: `${day}日` });
      }
    } else {
      const yearText = String(year).padStart(4, '0');
      result.start = `${yearText}-01-01`;
      result.end = `${yearText}-12-31`;
      result.label = `${year} 年`;
      for (let index = 0; index < 12; index += 1) {
        const key = `${yearText}-${String(index + 1).padStart(2, '0')}`;
        const last = new Date(`${key}-01T00:00:00.000Z`);
        last.setUTCMonth(index + 1, 0);
        result.buckets.push({ key, start: `${key}-01`, end: dateKey(last), label: `${index + 1}月` });
      }
    }
    if (!result.start || !result.end || result.buckets.some((bucket) => !bucket.start || !bucket.end)) {
      return { ...result, start: '', end: '', label: '', buckets: [], error: '日期超出支持范围。' };
    }
    return result;
  }

  function emptyTotals() {
    return {
      incomeCents: 0, expenseCents: 0, balanceCents: 0,
      studyMinutes: 0, studyDays: 0, studyCount: 0, financeCount: 0,
      taskCount: 0, completedTasks: 0, taskRate: 0,
    };
  }

  // Blank fields are not transactions; an explicit numeric zero is still a record.
  function nonnegativeNumber(value) {
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    if (typeof value === 'string' && !value.trim()) return null;
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
  }

  function moneyCents(value) {
    const amount = nonnegativeNumber(value);
    if (amount === null || amount > Number.MAX_SAFE_INTEGER / 100) return null;
    return Math.round(amount * 100);
  }

  function finalize(totals, studyDates) {
    totals.balanceCents = totals.incomeCents - totals.expenseCents;
    totals.studyDays = studyDates.size;
    totals.taskRate = totals.taskCount ? Math.round(totals.completedTasks / totals.taskCount * 100) : 0;
    return totals;
  }

  function summarize(data, period, anchor) {
    const selected = range(period, anchor);
    const totals = emptyTotals();
    const buckets = selected.buckets.map((bucket) => ({ ...bucket, ...emptyTotals() }));
    const result = { ...selected, buckets, totals, hasData: false, hasFinancialRecords: false };
    if (selected.error) return result;

    const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    const studyDates = new Set();
    const bucketStudyDates = new Map(buckets.map((bucket) => [bucket.key, new Set()]));
    const source = data && typeof data === 'object' ? data : {};
    function bucketFor(record) {
      if (!record || typeof record !== 'object' || !parseDate(record.date)
        || record.date < selected.start || record.date > selected.end) return null;
      return byKey.get(period === 'year' ? record.date.slice(0, 7) : record.date) || null;
    }
    function add(bucket, field, amount) {
      if (field === 'incomeCents' || field === 'expenseCents') {
        if (!Number.isSafeInteger(bucket[field] + amount) || !Number.isSafeInteger(totals[field] + amount)) {
          result.error = '金额总和超出可精确统计的范围。';
          return;
        }
      }
      bucket[field] += amount;
      totals[field] += amount;
    }

    // Read only the existing canonical record arrays. Daily log references are
    // deliberately not added again, because their records already live here.
    (Array.isArray(source.studies) ? source.studies : []).forEach((record) => {
      const bucket = bucketFor(record);
      if (!bucket) return;
      const minutes = nonnegativeNumber(record.duration);
      if (minutes === null) return;
      add(bucket, 'studyMinutes', minutes);
      add(bucket, 'studyCount', 1);
      studyDates.add(record.date);
      bucketStudyDates.get(bucket.key).add(record.date);
    });
    (Array.isArray(source.finances) ? source.finances : []).forEach((record) => {
      const bucket = bucketFor(record);
      if (!bucket) return;
      const income = moneyCents(record.income);
      const expense = moneyCents(record.expense);
      if (income === null && expense === null) return;
      add(bucket, 'incomeCents', income === null ? 0 : income);
      add(bucket, 'expenseCents', expense === null ? 0 : expense);
      add(bucket, 'financeCount', 1);
    });
    (Array.isArray(source.tasks) ? source.tasks : []).forEach((record) => {
      const bucket = bucketFor(record);
      if (!bucket) return;
      add(bucket, 'taskCount', 1);
      if (record.completed === true) add(bucket, 'completedTasks', 1);
    });

    buckets.forEach((bucket) => finalize(bucket, bucketStudyDates.get(bucket.key)));
    finalize(totals, studyDates);
    result.hasData = totals.studyCount + totals.financeCount + totals.taskCount > 0;
    result.hasFinancialRecords = totals.financeCount > 0 && !result.error;
    return result;
  }

  const api = { range, summarize };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LifeInsights = api;
})(typeof window === 'undefined' ? globalThis : window);
