/* Schedule calculations and optional metadata. No writes, clock reads or UI side effects. */
(function (root) {
  'use strict';
  const key = 'my-life-dashboard-schedule-meta-v1';
  const blank = () => ({ version: 1, taskDetails: [], series: [], occurrences: [] });
  const clone = value => JSON.parse(JSON.stringify(value));
  const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('|') === keys.slice().sort().join('|');
  const idValid = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
  const dateValid = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  const timeValid = value => typeof value === 'string' && (value === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(value));
  const minutes = value => value && timeValid(value) ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : null;
  const addDays = (date, offset) => {
    if (!dateValid(date) || !Number.isInteger(offset)) return '';
    const value = new Date(date + 'T00:00:00Z');
    value.setUTCDate(value.getUTCDate() + offset);
    const result = value.toISOString().slice(0, 10);
    return dateValid(result) ? result : '';
  };
  const dayCount = (start, end) => dateValid(start) && dateValid(end)
    ? Math.round((Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86400000) + 1 : 0;
  const compare = (a, b) => (a.start || '99:99').localeCompare(b.start || '99:99') || a.createdAt - b.createdAt;
  const duration = task => task.start && task.end && minutes(task.end) > minutes(task.start)
    ? minutes(task.end) - minutes(task.start) : null;
  function conflicts(candidate, tasks) {
    if (!duration(candidate) || candidate.completed) return [];
    return tasks.filter(task => task.id !== candidate.id && task.date === candidate.date && !task.completed
      && duration(task) && minutes(candidate.start) < minutes(task.end) && minutes(task.start) < minutes(candidate.end));
  }
  function planError(task) {
    if (!dateValid(task.date)) return '请选择有效的计划日期。';
    if (typeof task.title !== 'string' || !task.title.trim() || task.title.trim().length > 120) return '日程标题需为1–120字。';
    if (!timeValid(task.start) || !timeValid(task.end)) return '请输入有效的计划时间。';
    if (task.start && task.end && minutes(task.end) <= minutes(task.start)) return '结束时间需晚于开始时间；跨天安排请按日期拆分。';
    return '';
  }
  const detailFor = (meta, taskId) => meta.taskDetails.find(row => row.taskId === taskId)
    || { taskId, priority: null, deadline: null, note: '' };
  function validate(meta, tasks) {
    if (!exact(meta, ['version', 'taskDetails', 'series', 'occurrences']) || meta.version !== 1
      || !['taskDetails', 'series', 'occurrences'].every(name => Array.isArray(meta[name]))) return '日程扩展格式无效。';
    const taskIds = new Set((tasks || []).map(task => task.id));
    const references = Array.isArray(tasks);
    const unique = rows => new Set(rows).size === rows.length;
    const priorityValid = value => value === null || ['low', 'medium', 'high'].includes(value);
    const textValid = value => typeof value === 'string' && value.length <= 2000;
    const timestampValid = value => Number.isFinite(value) && value >= 0;
    for (const row of meta.taskDetails) {
      if (!exact(row, ['taskId', 'priority', 'deadline', 'note']) || !idValid(row.taskId)
        || !priorityValid(row.priority) || !(row.deadline === null || dateValid(row.deadline)) || !textValid(row.note)
        || references && !taskIds.has(row.taskId)) return '日程备注、优先级、截止日期或任务引用无效。';
    }
    if (!unique(meta.taskDetails.map(row => row.taskId))) return '日程详情存在重复任务引用。';
    for (const row of meta.series) {
      if (!exact(row, ['id', 'title', 'startDate', 'endDate', 'weekdays', 'start', 'end', 'active', 'priority', 'deadlineOffsetDays', 'note', 'createdAt', 'updatedAt'])
        || !idValid(row.id) || planError({ ...row, date: row.startDate }) || !dateValid(row.endDate)
        || dayCount(row.startDate, row.endDate) < 1 || dayCount(row.startDate, row.endDate) > 366
        || !Array.isArray(row.weekdays) || !row.weekdays.length || !unique(row.weekdays)
        || !row.weekdays.every(day => Number.isInteger(day) && day >= 1 && day <= 7)
        || typeof row.active !== 'boolean' || !priorityValid(row.priority) || !textValid(row.note)
        || !(row.deadlineOffsetDays === null || Number.isInteger(row.deadlineOffsetDays) && row.deadlineOffsetDays >= 0 && row.deadlineOffsetDays <= 366)
        || !timestampValid(row.createdAt) || !timestampValid(row.updatedAt)) return '重复规则无效：请选择星期、有效时间和最多366天的日期范围。';
      if (row.deadlineOffsetDays !== null && !addDays(row.endDate, row.deadlineOffsetDays)) return '重复规则的截止日期超出支持范围。';
    }
    if (!unique(meta.series.map(row => row.id))) return '重复规则ID不唯一。';
    const seriesIds = new Set(meta.series.map(row => row.id));
    for (const row of meta.occurrences) {
      if (!exact(row, ['seriesId', 'date', 'taskId', 'excluded']) || !seriesIds.has(row.seriesId) || !dateValid(row.date)
        || !idValid(row.taskId) || typeof row.excluded !== 'boolean'
        || references && !row.excluded && !taskIds.has(row.taskId)) return '重复实例的日期或关联无效。';
    }
    if (!unique(meta.occurrences.map(row => row.seriesId + '@' + row.date))
      || !unique(meta.occurrences.map(row => row.taskId))) return '重复实例存在重复关联。';
    return '';
  }
  function read(storage, tasks) {
    try {
      const raw = storage.getItem(key);
      if (raw === null) return { data: blank(), raw, error: '' };
      const data = JSON.parse(raw), error = validate(data, tasks);
      return { data: error ? null : data, raw, error: error ? '日程扩展无法安全读取：' + error : '' };
    } catch (error) { return { data: null, raw: null, error: '日程扩展无法安全读取，已停止日程写入与恢复。' }; }
  }
  function merge(current, incoming, tasks) {
    const validation = validate(current, tasks) || validate(incoming, tasks);
    if (validation) return { merged: null, error: validation };
    const output = clone(current);
    const keys = { taskDetails: row => row.taskId, series: row => row.id, occurrences: row => row.seriesId + '@' + row.date };
    for (const name of Object.keys(keys)) {
      const byId = new Map(output[name].map(row => [keys[name](row), row]));
      for (const row of incoming[name]) {
        const id = keys[name](row), existing = byId.get(id);
        if (existing && !Object.keys(row).every(field => JSON.stringify(existing[field]) === JSON.stringify(row[field]))) {
          return { merged: null, error: '日程扩展存在冲突（' + name + '），已停止合并，不覆盖现有内容。' };
        }
        if (!existing) { const added = clone(row); output[name].push(added); byId.set(id, added); }
      }
    }
    const error = validate(output, tasks);
    return { merged: error ? null : output, error };
  }
  function missingDates(meta, seriesId) {
    const series = meta.series.find(row => row.id === seriesId);
    if (!series || !series.active || dayCount(series.startDate, series.endDate) < 1 || dayCount(series.startDate, series.endDate) > 366) return [];
    const existing = new Set(meta.occurrences.filter(row => row.seriesId === seriesId).map(row => row.date));
    const dates = [];
    for (let date = series.startDate; date && date <= series.endDate; date = addDays(date, 1)) {
      const weekday = new Date(date + 'T00:00:00Z').getUTCDay() || 7;
      if (series.weekdays.includes(weekday) && !existing.has(date)) dates.push(date);
    }
    return dates;
  }
  function generate(meta, tasks, seriesId, makeId, now) {
    const validation = validate(meta, tasks);
    if (validation) return { error: validation };
    const next = clone(meta), nextTasks = tasks.slice(), series = next.series.find(row => row.id === seriesId);
    const dates = missingDates(meta, seriesId), ids = new Set(tasks.map(task => task.id));
    for (const date of dates) {
      const taskId = makeId();
      if (!idValid(taskId) || ids.has(taskId)) return { error: '生成的任务ID重复或无效，已停止。' };
      ids.add(taskId);
      nextTasks.push({ id: taskId, date, title: series.title, start: series.start, end: series.end, completed: false, createdAt: now });
      next.taskDetails.push({ taskId, priority: series.priority, note: series.note, deadline: series.deadlineOffsetDays === null ? null : addDays(date, series.deadlineOffsetDays) });
      next.occurrences.push({ seriesId, date, taskId, excluded: false });
    }
    const error = validate(next, nextTasks);
    return { error, meta: error ? null : next, tasks: error ? null : nextTasks, count: dates.length };
  }
  function removeTask(meta, taskId) {
    const next = clone(meta);
    next.taskDetails = next.taskDetails.filter(row => row.taskId !== taskId);
    next.occurrences.forEach(row => { if (row.taskId === taskId) row.excluded = true; });
    return next;
  }
  function calendar(month) {
    if (!dateValid(month + '-01')) return [];
    const first = new Date(month + '-01T00:00:00Z'), offset = (first.getUTCDay() + 6) % 7;
    const end = new Date(month + '-01T00:00:00Z');
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
    const cells = Math.ceil((offset + end.getUTCDate()) / 7) * 7;
    return Array.from({ length: cells }, (_, index) => addDays(month + '-01', index - offset));
  }
  const api = Object.freeze({ key, blank, validate, read, merge, detailFor, missingDates, generate, removeTask,
    calendar, dateValid, addDays, dayCount, minutes, duration, compare, conflicts, planError, clone,
    hasData: meta => ['taskDetails', 'series', 'occurrences'].some(name => meta[name].length > 0) });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LifeSchedule = api;
})(typeof window === 'object' ? window : globalThis);
