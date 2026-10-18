(function (root) {
  'use strict';
  const blank = () => ({ assignments: [] });
  const normalize = (value) => String(value || '').trim().replace(/^#+/, '').trim().normalize('NFC');
  const key = (value) => normalize(value).toLocaleLowerCase();
  function unique(values) {
    const seen = new Set();
    return values.map(normalize).filter((tag) => tag && !seen.has(key(tag)) && seen.add(key(tag)));
  }
  function validate(value, notes) {
    if (!value || Object.keys(value).join() !== 'assignments' || !Array.isArray(value.assignments)) return '妙想标签格式无效。';
    const ids = new Set(), noteIds = notes ? new Set(notes.map((note) => note.id)) : null;
    for (const row of value.assignments) {
      if (!row || Object.keys(row).sort().join() !== 'recordId,tags' || typeof row.recordId !== 'string' || !row.recordId.trim() || ids.has(row.recordId) || !Array.isArray(row.tags) || row.tags.length > 20) return '妙想标签关联无效或重复。';
      if (row.tags.some((tag) => typeof tag !== 'string' || tag !== normalize(tag) || !tag || Array.from(tag).length > 30 || /[\u0000-\u001f\u007f]/.test(tag)) || unique(row.tags).length !== row.tags.length) return '标签应为1–30字，一条妙想最多20个不重复标签。';
      if (noteIds && !noteIds.has(row.recordId)) return '标签关联的妙想不存在。';
      ids.add(row.recordId);
    }
    return '';
  }
  const tagsFor = (value, id) => (value.assignments.find((row) => row.recordId === id)?.tags || []).slice();
  const allTags = (value) => unique(value.assignments.flatMap((row) => row.tags)).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  function assign(value, id, tags) {
    return { assignments: [...value.assignments.filter((row) => row.recordId !== id), { recordId: id, tags: unique(tags) }] };
  }
  function merge(current, incoming) {
    const error = validate(current) || validate(incoming);
    if (error) return { error, merged: null };
    let merged = JSON.parse(JSON.stringify(current));
    for (const row of incoming.assignments) merged = assign(merged, row.recordId, [...tagsFor(merged, row.recordId), ...row.tags]);
    return { error: validate(merged), merged };
  }
  function filterNotes(notes, tags, options) {
    const query = String(options.query || '').trim().toLocaleLowerCase();
    return notes.filter((note) => (!options.date || note.date === options.date)
      && (!query || (note.title + '\n' + note.content).toLocaleLowerCase().includes(query))
      && (!options.tag || tagsFor(tags, note.id).some((tag) => key(tag) === key(options.tag))))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }
  function search(data, personal, tags, categories, options = {}) {
    const query = String(options.query || '').trim().toLocaleLowerCase();
    if (!query) return [];
    const rows = [], add = (type, id, title, content, date, dates = []) => rows.push({ type, id, title, content, date: date || '', dates });
    personal.diary.forEach((note) => add('note', note.id, note.title || note.content.slice(0, 45), note.content + ' ' + tagsFor(tags, note.id).map((tag) => '#' + tag).join(' '), note.date));
    data.tasks.forEach((task) => add('task', task.id, task.title, (task.completed ? '已完成' : '待完成') + ' ' + task.start + ' ' + task.end, task.date));
    data.studies.forEach((study) => add('study', study.id, study.content, study.duration + ' 分钟', study.date));
    data.finances.forEach((bill) => {
      const labels = (categories?.assignments || []).filter((row) => row.recordId === bill.id).map((row) => row.label).join(' ');
      add('finance', bill.id, bill.note || '收支记录', '收入 USD ' + bill.income.toFixed(2) + ' · 支出 USD ' + bill.expense.toFixed(2) + ' ' + labels, bill.date);
    });
    personal.habits.forEach((habit) => add('habit', habit.id, habit.name, '习惯 · 已打卡 ' + habit.checkedDates.length + ' 天', '', habit.checkedDates));
    personal.goals.forEach((goal) => add('goal', goal.id, goal.title, goal.description + ' ' + (goal.completed ? '已完成' : '进行中'), goal.targetDate));
    const profile = Object.values(personal.profile).filter((value) => value.trim());
    if (profile.length) add('profile', 'profile', personal.profile.nickname || profile[0], profile.join(' · '), '');
    return rows.filter((row) => (!options.type || row.type === options.type)
      && (!options.date || row.date === options.date || row.dates.includes(options.date))
      && (row.title + '\n' + row.content).toLocaleLowerCase().includes(query))
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  const api = { blank, normalize, unique, validate, tagsFor, allTags, assign, merge, filterNotes, search };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LifeContent = api;
})(typeof window === 'undefined' ? globalThis : window);
