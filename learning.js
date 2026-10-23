/* Optional learning metadata and timestamp calculations. No storage writes or clock reads. */
(function (root) {
  'use strict';
  const key = 'my-life-dashboard-learning-meta-v1';
  const blank = () => ({ version: 1, dailyGoals: [], plans: [], focusSessions: [] });
  const clone = value => JSON.parse(JSON.stringify(value));
  const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('|') === keys.slice().sort().join('|');
  const id = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
  const stamp = value => Number.isSafeInteger(value) && value >= 0;
  const minutes = value => Number.isInteger(value) && value >= 1 && value <= 1440;
  const dateValid = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const time = new Date(value + 'T00:00:00Z');
    return Number.isFinite(time.getTime()) && time.toISOString().slice(0, 10) === value;
  };
  const unresolved = session => ['running', 'paused', 'ended'].includes(session.status);
  const active = meta => meta.focusSessions.find(unresolved) || null;
  const hasData = meta => meta.dailyGoals.length + meta.plans.length + meta.focusSessions.length > 0;
  function validate(meta, data, importing = false) {
    if (!exact(meta, ['version', 'dailyGoals', 'plans', 'focusSessions']) || meta.version !== 1
      || !['dailyGoals', 'plans', 'focusSessions'].every(name => Array.isArray(meta[name]))) return '学习扩展格式无效。';
    const tasks = new Set((data?.tasks || []).map(row => row.id));
    const studies = new Set((data?.studies || []).map(row => row.id));
    const unique = values => values.length === new Set(values).size;
    for (const row of meta.dailyGoals) {
      if (!exact(row, ['date', 'minutes']) || !dateValid(row.date) || !minutes(row.minutes)) return '学习目标日期或分钟无效。';
    }
    if (!unique(meta.dailyGoals.map(row => row.date))) return '同一天有重复学习目标。';
    for (const row of meta.plans) {
      if (!exact(row, ['taskId', 'estimatedMinutes', 'archived']) || !id(row.taskId) || !minutes(row.estimatedMinutes)
        || typeof row.archived !== 'boolean' || data && !row.archived && !tasks.has(row.taskId)) return '学习计划或日程引用无效。';
    }
    if (!unique(meta.plans.map(row => row.taskId))) return '学习计划有重复日程引用。';
    for (const row of meta.focusSessions) {
      if (!exact(row, ['id', 'taskId', 'title', 'date', 'status', 'accumulatedMs', 'startedAt', 'endedAt', 'studyRecordId', 'recordDeleted', 'createdAt', 'updatedAt'])
        || !id(row.id) || !(row.taskId === null || id(row.taskId)) || !id(row.studyRecordId)
        || typeof row.title !== 'string' || !row.title.trim() || row.title.length > 100 || !dateValid(row.date)
        || !['running', 'paused', 'ended', 'saved', 'cancelled'].includes(row.status)
        || !stamp(row.accumulatedMs) || !stamp(row.createdAt) || !stamp(row.updatedAt) || row.updatedAt < row.createdAt
        || typeof row.recordDeleted !== 'boolean'
        || (row.status === 'running' ? !stamp(row.startedAt) : row.startedAt !== null)
        || (['ended', 'saved', 'cancelled'].includes(row.status) ? !stamp(row.endedAt) : row.endedAt !== null)
        || row.recordDeleted && row.status !== 'saved'
        || data && row.status === 'saved' && !row.recordDeleted && !studies.has(row.studyRecordId)) return '专注计时状态、时间或记录引用无效。';
      if (importing && row.status === 'running') return '备份中的运行计时尚未冻结为暂停，请重新导出完整 v8。';
    }
    if (!unique(meta.focusSessions.map(row => row.id)) || !unique(meta.focusSessions.map(row => row.studyRecordId))) return '计时或预留学习记录 ID 重复。';
    if (meta.focusSessions.filter(unresolved).length > 1) return '存在多个未处理计时，请先处理当前计时；不自动覆盖。';
    return '';
  }
  function read(storage, data) {
    try {
      const raw = storage.getItem(key), value = raw === null ? blank() : JSON.parse(raw);
      const error = validate(value, data);
      return { data: error ? blank() : value, error, raw };
    } catch (error) { return { data: blank(), error: '无法读取学习扩展：' + error.message, raw: null }; }
  }
  function elapsed(session, now) {
    if (!stamp(now)) return { error: '设备时间无效，已保留计时。', ms: 0 };
    if (session.status === 'running' && now < session.startedAt) return { error: '设备时钟早于计时起点，请校正时间后继续；未生成学习记录。', ms: session.accumulatedMs };
    const ms = session.accumulatedMs + (session.status === 'running' ? now - session.startedAt : 0);
    return Number.isSafeInteger(ms) ? { ms, error: '' } : { ms: 0, error: '计时超出安全范围，已保留原数据。' };
  }
  function transition(session, action, now) {
    const value = elapsed(session, now);
    if (value.error) return { error: value.error };
    const allowed = { pause: ['running'], resume: ['paused', 'ended'], end: ['running', 'paused'], cancel: ['running', 'paused', 'ended'] };
    if (!allowed[action]?.includes(session.status)) return { error: '当前计时状态不能执行此操作，请刷新状态。' };
    const row = { ...session, accumulatedMs: value.ms, updatedAt: now, startedAt: null, endedAt: null };
    if (action === 'resume') { row.status = 'running'; row.startedAt = now; }
    if (action === 'pause') row.status = 'paused';
    if (action === 'end') { row.status = 'ended'; row.endedAt = now; }
    if (action === 'cancel') { row.status = 'cancelled'; row.endedAt = now; }
    return { row, error: '' };
  }
  function freeze(meta, now) {
    const result = clone(meta);
    for (let index = 0; index < result.focusSessions.length; index += 1) {
      const row = result.focusSessions[index];
      if (row.status !== 'running') continue;
      const paused = transition(row, 'pause', now);
      if (paused.error) return { error: paused.error };
      result.focusSessions[index] = paused.row;
    }
    return { data: result, error: '' };
  }
  function reconcile(meta, data) {
    const result = clone(meta), tasks = new Set(data.tasks.map(row => row.id)), studies = new Set(data.studies.map(row => row.id));
    result.plans.forEach(row => { if (!tasks.has(row.taskId)) row.archived = true; });
    result.focusSessions.forEach(row => { if (row.status === 'saved' && !studies.has(row.studyRecordId)) row.recordDeleted = true; });
    return result;
  }
  function merge(current, incoming, data) {
    const result = clone(current), conflicts = [], additions = { dailyGoals: 0, plans: 0, focusSessions: 0 };
    for (const [name, identity] of [['dailyGoals', 'date'], ['plans', 'taskId'], ['focusSessions', 'id']]) {
      for (const row of incoming[name]) {
        const old = result[name].find(value => value[identity] === row[identity]);
        if (!old) { result[name].push(clone(row)); additions[name] += 1; }
        else if (Object.keys(row).some(field => row[field] !== old[field])) conflicts.push('学习扩展冲突：' + name + ' / ' + row[identity]);
      }
    }
    const error = validate(result, data);
    if (error) conflicts.push(error);
    return { merged: result, conflicts, additions };
  }
  const api = { key, blank, clone, minutes, dateValid, unresolved, active, hasData, validate, read, elapsed, transition, freeze, reconcile, merge };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LifeLearning = api;
})(typeof window !== 'undefined' ? window : globalThis);
