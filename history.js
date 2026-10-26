(function (root) {
  'use strict';

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }

  function select(records, options) {
    const { anchor, range = 'selected', type = 'study' } = options;
    let start = '', end = '', error = '', label = '全部日期';
    if (range !== 'all' && range !== 'custom' && !validDate(anchor)) error = '请先选择有效的查看日期。';
    if (!error && range === 'selected') { start = end = anchor; label = anchor; }
    if (!error && range === 'week') {
      const first = new Date(`${anchor}T12:00:00Z`);
      first.setUTCDate(first.getUTCDate() - 6);
      start = first.toISOString().slice(0, 10); end = anchor;
      label = `${start} 至 ${end}`;
    }
    if (!error && range === 'month') {
      start = `${anchor.slice(0, 7)}-01`;
      const last = new Date(`${start}T12:00:00Z`);
      last.setUTCMonth(last.getUTCMonth() + 1, 0);
      end = last.toISOString().slice(0, 10); label = `${anchor.slice(0, 7)} 全月`;
    }
    if (range === 'custom') {
      start = options.start || ''; end = options.end || '';
      if (!validDate(start) || !validDate(end)) error = '请选择完整的开始和结束日期。';
      else if (start > end) error = '开始日期不能晚于结束日期。';
      label = `${start} 至 ${end}`;
    }
    const query = String(options.query || '').trim().toLocaleLowerCase();
    const matches = error ? [] : records.filter((item) => {
      const text = type === 'study' ? item.content : item.note;
      return (!start || item.date >= start) && (!end || item.date <= end)
        && (!query || String(text || '').toLocaleLowerCase().includes(query));
    }).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    // Continuous finance lists use the exact same query, ordering and totals.
    // Learning and older callers keep their ten-record pagination.
    const pageSize = options.paginate === false ? Math.max(1, matches.length) : 10;
    const pages = Math.max(1, Math.ceil(matches.length / pageSize));
    const page = Math.min(pages, Math.max(1, Math.floor(Number(options.page) || 1)));
    const totals = matches.reduce((sum, item) => {
      sum.minutes += Number(item.duration) || 0;
      sum.income += Math.round((Number(item.income) || 0) * 100);
      sum.expense += Math.round((Number(item.expense) || 0) * 100);
      return sum;
    }, { minutes: 0, income: 0, expense: 0 });
    return { items: matches.slice((page - 1) * pageSize, page * pageSize), count: matches.length,
      page, pages, start, end, label, error, totals };
  }

  const api = { select };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LifeHistory = api;
})(typeof window === 'undefined' ? globalThis : window);
