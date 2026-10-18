(function (root) {
  'use strict';

  // Categories are stored beside the original ledger. Ledger records stay intact.
  const TYPES = ['income', 'expense'];
  const DEFAULTS = [
    ['income-delivery', 'income', '外卖'],
    ['income-part-time', 'income', '兼职'],
    ['income-other', 'income', '其他'],
    ['expense-food', 'expense', '餐饮'],
    ['expense-transport', 'expense', '交通'],
    ['expense-study', 'expense', '学习'],
    ['expense-living', 'expense', '生活'],
    ['expense-other', 'expense', '其他'],
  ];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const exactKeys = (value, keys) => isObject(value)
    && Object.keys(value).sort().join('|') === keys.slice().sort().join('|');
  const validId = (value) => typeof value === 'string' && Boolean(value.trim()) && value.length <= 200;
  const validLabel = (value) => typeof value === 'string' && Boolean(value.trim()) && value.length <= 50;
  const assignmentKey = (recordId, type) => JSON.stringify([recordId, type]);
  const sameRecord = (left, right, keys) => keys.every((key) => left[key] === right[key]);

  function blank() {
    return {
      categories: DEFAULTS.map(([id, type, name]) => ({ id, type, name, active: true, createdAt: 0 })),
      assignments: [],
    };
  }

  function validate(value, finances) {
    if (!exactKeys(value, ['categories', 'assignments']) || !Array.isArray(value.categories) || !Array.isArray(value.assignments)) {
      return '分类数据结构不正确。';
    }
    const byId = new Map();
    for (const [index, category] of value.categories.entries()) {
      if (!exactKeys(category, ['id', 'type', 'name', 'active', 'createdAt'])) return `第 ${index + 1} 项分类字段无效。`;
      if (!validId(category.id) || byId.has(category.id)) return `第 ${index + 1} 项分类 ID 无效或重复。`;
      if (!TYPES.includes(category.type) || !validLabel(category.name) || typeof category.active !== 'boolean') return `第 ${index + 1} 项分类内容无效。`;
      if (!Number.isFinite(category.createdAt) || category.createdAt < 0) return `第 ${index + 1} 项分类创建时间无效。`;
      byId.set(category.id, category);
    }
    let financeIds = null;
    if (finances !== undefined) {
      if (!Array.isArray(finances)) return '检查分类关联时，收支记录必须是数组。';
      financeIds = new Set(finances.map((item) => item?.id));
    }
    const assigned = new Set();
    for (const [index, assignment] of value.assignments.entries()) {
      if (!exactKeys(assignment, ['recordId', 'type', 'categoryId', 'label'])) return `第 ${index + 1} 项账单分类字段无效。`;
      if (!validId(assignment.recordId) || !TYPES.includes(assignment.type) || !validId(assignment.categoryId) || !validLabel(assignment.label)) return `第 ${index + 1} 项账单分类内容无效。`;
      const category = byId.get(assignment.categoryId);
      if (!category || category.type !== assignment.type) return `第 ${index + 1} 项账单分类引用不存在或类型不符。`;
      const key = assignmentKey(assignment.recordId, assignment.type);
      if (assigned.has(key)) return `第 ${index + 1} 项账单存在重复分类，无法安全合并。`;
      assigned.add(key);
      if (financeIds && !financeIds.has(assignment.recordId)) return `第 ${index + 1} 项分类关联的账单不存在。`;
    }
    return '';
  }

  function assignmentFor(value, recordId, type) {
    if (!TYPES.includes(type)) return null;
    return value?.assignments?.find((item) => item.recordId === recordId && item.type === type) || null;
  }

  function categoryLabel(value, recordId, type) {
    return assignmentFor(value, recordId, type)?.label || '未分类';
  }

  function summarize(finances, value, type) {
    if (!Array.isArray(finances) || !TYPES.includes(type)) return [];
    const categories = new Map((value?.categories || []).map((category) => [category.id, category]));
    const assignments = new Map((value?.assignments || []).map((assignment) => [assignmentKey(assignment.recordId, assignment.type), assignment]));
    const groups = new Map();
    for (const record of finances) {
      const amount = Number(record?.[type]);
      if (!Number.isFinite(amount) || amount < 0) continue;
      const cents = Math.round(amount * 100);
      if (!Number.isSafeInteger(cents)) throw new RangeError('收支金额超出可安全统计范围。');
      const assignment = assignments.get(assignmentKey(record.id, type));
      // A zero amount without a direction assignment is not a recorded transaction.
      if (cents === 0 && !assignment) continue;
      const category = assignment && categories.get(assignment.categoryId);
      const categoryId = category?.type === type ? category.id : null;
      const key = categoryId === null ? 'uncategorized' : JSON.stringify(categoryId);
      if (!groups.has(key)) groups.set(key, { categoryId, label: categoryId === null ? '未分类' : category.name, cents: 0, count: 0 });
      const group = groups.get(key);
      if (!Number.isSafeInteger(group.cents + cents)) throw new RangeError('分类合计超出可安全统计范围。');
      group.cents += cents;
      group.count += 1;
    }
    return [...groups.values()].sort((left, right) => right.cents - left.cents || left.label.localeCompare(right.label, 'zh-CN') || String(left.categoryId).localeCompare(String(right.categoryId)));
  }

  function safeMerge(current, incoming) {
    const result = { error: '', merged: null, additions: { categories: [], assignments: [] }, duplicates: 0 };
    const currentError = validate(current);
    const incomingError = validate(incoming);
    if (currentError || incomingError) {
      result.error = `${currentError ? '现有分类' : '备份分类'}无法安全合并：${currentError || incomingError}`;
      return result;
    }
    const merged = clone(current);
    const byId = new Map(merged.categories.map((category) => [category.id, category]));
    for (const category of incoming.categories) {
      const existing = byId.get(category.id);
      if (!existing) {
        const added = clone(category);
        result.additions.categories.push(added);
        merged.categories.push(added);
        byId.set(added.id, added);
      } else if (sameRecord(existing, category, ['id', 'type', 'name', 'active', 'createdAt'])) result.duplicates += 1;
      else {
        result.error = `分类“${existing.name}”在现有数据和备份中的名称、类型或停用状态不同。为避免覆盖，本次导入已停止。`;
        return result;
      }
    }
    const assigned = new Map(merged.assignments.map((assignment) => [assignmentKey(assignment.recordId, assignment.type), assignment]));
    for (const assignment of incoming.assignments) {
      const key = assignmentKey(assignment.recordId, assignment.type);
      const existing = assigned.get(key);
      if (!existing) {
        const added = clone(assignment);
        result.additions.assignments.push(added);
        merged.assignments.push(added);
        assigned.set(key, added);
      } else if (sameRecord(existing, assignment, ['recordId', 'type', 'categoryId', 'label'])) result.duplicates += 1;
      else {
        result.error = `账单“${assignment.recordId}”的分类或历史分类名称与备份不同。为避免覆盖，本次导入已停止。`;
        return result;
      }
    }
    result.merged = merged;
    return result;
  }

  const api = { blank, validate, assignmentFor, categoryLabel, summarize, safeMerge };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LifeCategories = api;
})(typeof window === 'undefined' ? globalThis : window);
