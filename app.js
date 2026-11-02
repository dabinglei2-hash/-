(() => {
  'use strict';

  const STORAGE_KEY = 'my-life-dashboard-v1';
  const PERSONAL_STORAGE_KEY = 'my-life-dashboard-personal-v1';
  const CATEGORY_STORAGE_KEY = 'my-life-dashboard-categories-v1';
  const BACKUP_FORMAT = 'my-life-dashboard-backup';
  const BACKUP_VERSION = 5; // Compatibility v5; financial v6; schedule v7; complete learning backup v8.
  let financeMeta = window.LifeFinanceMeta.blank();
  let financeMetaError = '';
  let financeMonthBefore = null;
  const NOTE_TAGS_KEY = 'my-life-dashboard-note-tags-v1';
  const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
  const SKILL_DEFINITIONS = [
    { id: 'webDev', name: '网站开发', icon: 'code' },
    { id: 'aiTools', name: 'AI 工具', icon: 'ai' },
    { id: 'english', name: '英语', icon: 'language' },
    { id: 'finance', name: '财务管理', icon: 'finance' },
    { id: 'delivery', name: '外卖运营', icon: 'delivery' },
  ];
  const $ = (selector) => document.querySelector(selector);
  const icon = (name) => window.LifeIcons.render(name);
  const today = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const blankData = () => ({ studies: [], finances: [], tasks: [] });
  const blankPersonalData = () => ({
    profile: { nickname: '', identity: '', goal: '', motto: '' },
    wealthTarget: null,
    skills: { webDev: 0, aiTools: 0, english: 0, finance: 0, delivery: 0 },
    diary: [], habits: [], goals: [], dailyLogs: [],
  });
  let dataError = '';
  let dataSnapshotRaw = null;
  let data = loadData();
  let scheduleMetaError = '';
  let scheduleSnapshotRaw = null;
  let scheduleMeta = loadScheduleMeta();
  let learningMetaError = '';
  let learningSnapshotRaw = null;
  let learningMeta = loadLearningMeta();
  let learningRouteActive = false;
  let taskEditExpected = null;
  let taskSavePending = false;
  let scheduleGenerationPending = false;
  let personalDataError = '';
  let personalSnapshotRaw = null;
  let personalData = loadPersonalData();
  let profileReturnFocus = null;
  let profileSavePending = false;
  let categoryError = '';
  let categoryData = loadCategoryData();
  let noteTagsError = '';
  let noteTags = readNoteTags().data || window.LifeContent.blank();
  let noteEdit = null;
  let pendingNoteTags = [];
  let noteFormChanged = false;
  let searchPage = 1;
  let dailyFormBaseline = '';
  const dailyDrafts = new Map();
  const otherDraftForms = new Set();
  let pendingBackup = null;
  let activeTaskNavigation = null;
  let activeDailyReturnRoute = null;
  const historyPages = { study: 1, finance: 1 };
  const recordEditors = { study: null, finance: null };
  let diaryPage = 1;
  let insightsPeriod = 'month';
  let trendMetric = 'expense';
  let rankingType = 'expense';
  let categoryEditorExpected = null;
  let categoryIconExpected = null;
  let activeUiReturn = null;
  let billSheetReturnFocus = null;
  let billClosePending = false;
  let confirmationResolve = null;
  let dailyEditSnapshot = null;

  function initializeRecordPages() {
    const main = $('.main-content');
    const personal = $('#personal');
    const records = [
      ['.diary-panel', '#daily-notes-slot'],
      ['.habits-panel', '#habits-slot'],
      ['#goals', '#goals-slot'],
    ];
    records.forEach(([selector, slot]) => {
      const node = $(selector);
      if (node && $(slot)) $(slot).append(node);
    });
    const diary = $('.diary-panel');
    if (diary && !$('#diary-date')) {
      const dateLabel = document.createElement('label');
      dateLabel.className = 'personal-date-control diary-date-control';
      dateLabel.innerHTML = '妙想日期<input id="diary-date" type="date" aria-label="选择妙想日期">';
      diary.querySelector('.panel-heading').append(dateLabel);
    }
    const goals = $('#goals');
    if (goals && !$('#goal-timeline-details')) {
      const details = document.createElement('details');
      details.id = 'goal-timeline-details';
      details.className = 'goal-timeline-details';
      details.innerHTML = '<summary>目标时间线 <span class="soft-badge" id="goal-timeline-summary">点击展开</span></summary>';
      const timeline = $('#goal-timeline');
      const empty = $('#goal-empty');
      if (timeline) details.append(timeline);
      if (empty) details.append(empty);
      goals.append(details);
    }
    const dateInput = $('#selected-date');
    const slots = [
      ['#overview-date-slot', '#overview-section'],
      ['#learning-date-slot', '#learning'],
      ['#finance-date-slot', '#finance'],
      ['#tasks-date-slot', '#task-list-view'],
    ];
    slots.forEach(([slotSelector, parentSelector]) => {
      let slot = $(slotSelector);
      if (!slot) {
        slot = document.createElement('div');
        slot.id = slotSelector.slice(1);
        slot.className = 'date-slot';
        const parent = $(parentSelector);
        const heading = parent?.querySelector('.welcome-row, .section-heading');
        if (heading) heading.querySelector(':scope > div')?.append(slot);
      }
    });
    if (dateInput && main) $('#date-control-parking')?.append(dateInput.closest('.date-control'));
  }
  initializeRecordPages();
  initializeUxPages();
  initializeWorkspacePages();

  function initializeUxPages() {
    document.querySelectorAll('.record-shortcuts a, .record-secondary-links a, .record-hub-links a, .quick-panel .text-link').forEach((link) => link.setAttribute('data-open-page', ''));
    document.querySelectorAll('.section-heading > a[href="#records"]').forEach((link) => link.dataset.backFallback = '#records');
    const wrapForm = (formSelector, id, title) => {
      const form = $(formSelector);
      const details = document.createElement('details');
      details.id = id;
      details.className = 'compose-details';
      details.innerHTML = '<summary>' + title + ' <span aria-hidden="true"><span data-icon="add"></span></span></summary>';
      form.before(details);
      details.append(form);
      return details;
    };
    $('#diary-form').prepend($('.diary-date-control'));
    wrapForm('#diary-form', 'diary-compose', '新建妙想');
    const filter = document.createElement('div');
    filter.className = 'list-toolbar';
    filter.innerHTML = '<label>历史笔记 <select id="diary-filter"><option value="all">全部日期</option><option value="date">所选日期</option></select></label><input id="diary-filter-date" class="hidden" type="date" aria-label="筛选笔记日期">';
    $('#diary-list').before(filter);
    $('.diary-panel h3').textContent = '历史妙想';
    $('.diary-panel .panel-heading p:not(.eyebrow)').textContent = '点击标题查看完整内容。';
    wrapForm('#habit-form', 'habit-compose', '添加习惯');
    wrapForm('#goal-form', 'goal-compose', '添加目标');
    const goals = document.createElement('div');
    goals.id = 'goal-current-list';
    goals.className = 'goal-summary-list';
    $('#goal-compose').before(goals);
    const financePanel = $('#finance .form-panel');
    const editor = document.createElement('dialog');
    editor.id = 'finance-editor';
    editor.className = 'editor-dialog';
    editor.setAttribute('aria-label', '编辑收支记录');
    editor.innerHTML = '<button type="button" class="page-back" data-close-finance><span data-icon="back"></span> 取消编辑</button>';
    document.body.append(editor);
    editor.append(financePanel);
    const confirmation = document.createElement('dialog');
    confirmation.id = 'confirm-dialog';
    confirmation.className = 'editor-dialog';
    confirmation.setAttribute('aria-labelledby', 'confirm-title');
    confirmation.innerHTML = '<h2 id="confirm-title">确认删除</h2><p id="confirm-message"></p><div class="form-footer"><button class="secondary-button" id="confirm-cancel" type="button">取消</button><button class="primary-button" id="confirm-accept" type="button">确认删除</button></div>';
    document.body.append(confirmation);
    document.body.append($('#personal-settings'));
    const categories = document.createElement('div');
    categories.className = 'form-row';
    categories.innerHTML = '<label>收入分类<select id="finance-income-category"></select></label><label>支出分类<select id="finance-expense-category"></select></label>';
    $('#finance-note').closest('label').before(categories);
    const filters = document.createElement('dialog');
    filters.id = 'finance-filter-dialog';
    filters.className = 'editor-dialog';
    filters.setAttribute('aria-labelledby','finance-filter-title');
    filters.innerHTML = '<h2 id="finance-filter-title">筛选账单</h2>';
    document.body.append(filters);
    const controls = $('#finance .history-controls');
    filters.append(controls, $('#finance-history-summary'));
    const searchLabel=$('#finance-history-search').closest('label');
    [...searchLabel.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).forEach(node=>node.remove());
    searchLabel.insertAdjacentHTML('afterbegin','<span class="sr-only">搜索收支备注</span>');
    $('#finance-search-slot').append(searchLabel);
    $('#finance-history-search').placeholder='搜索账单';
    controls.querySelector('.history-filter-note>span').textContent='日期范围以参考日期为准';
    const more = $('#finance-more-dialog');
    document.body.append(more);
    $('#finance-more-open').addEventListener('click',()=>more.showModal());
    $('#finance-more-close').addEventListener('click',()=>window.LifeUI.closeSheet(more));
    more.addEventListener('click',event=>{if(event.target.closest('a[data-open-page]'))window.LifeUI.closeSheet(more);});
    $('#finance-filters-open').addEventListener('click',()=>window.LifeUI.closeSheet(more,()=>filters.showModal()));
    const filterClose=document.createElement('button');filterClose.id='finance-filter-close';filterClose.type='button';filterClose.className='primary-button';filterClose.textContent='查看账单';
    filters.append(filterClose);filterClose.addEventListener('click',()=>window.LifeUI.closeSheet(filters));
    const breakdown=document.createElement('dialog');breakdown.id='finance-category-dialog';breakdown.className='editor-dialog ui-sheet';breakdown.setAttribute('aria-labelledby','finance-category-title');
    breakdown.innerHTML='<header class="ui-sheet-header"><h2 id="finance-category-title">分类概览</h2><button class="ui-icon-button" id="finance-category-close" type="button" aria-label="关闭分类概览"><span data-icon="close"></span></button></header>';
    const categoryOverview=$('#finance .category-overview');breakdown.append(categoryOverview);document.body.append(breakdown);
    categoryOverview.querySelector('h3').classList.add('sr-only');
    $('#finance-category-open').addEventListener('click',()=>breakdown.showModal());
    $('#finance-category-close').addEventListener('click',()=>window.LifeUI.closeSheet(breakdown));
    breakdown.addEventListener('click',event=>{if(event.target.closest('a[data-open-page]'))window.LifeUI.closeSheet(breakdown);});
    const anchor = document.createElement('label');
    anchor.className = 'compact-field';
    anchor.innerHTML = '参考日期<input id="finance-history-anchor" type="date">';
    controls.prepend(anchor);
    const advanced = document.createElement('button');
    advanced.type = 'button'; advanced.id = 'finance-advanced-open';
    advanced.className = 'text-button';
    advanced.textContent = '完整记账表单';
    filterClose.before(advanced);
    $('#finance-history-range').value = 'month';
    for (const route of ['#learning', '#task-list-view']) {
      const back = document.createElement('button');
      back.type = 'button'; back.className = 'page-back';
      back.dataset.backFallback = '#records';
      back.innerHTML = '<span data-icon="back"></span>返回';
      $(route).prepend(back);
    }
    const monthly = $('#monthly');
    const legacy = document.createElement('details');
    legacy.id = 'monthly-legacy-detail';
    legacy.className = 'legacy-detail';
    legacy.innerHTML = '<summary>月度明细 · 学习与任务</summary>';
    [...monthly.children].forEach((child) => legacy.append(child));
    monthly.append(legacy);
    const insights = document.createElement('div');
    insights.id = 'insights-main';
    insights.innerHTML = [
      '<header class="statistics-header"><h2 class="sr-only">统计</h2><label class="statistics-type"><span class="sr-only">统计类型</span><select id="insights-type"><option value="expense">支出</option><option value="income">收入</option><option value="balance">结余</option></select><span data-icon="chevronDown" aria-hidden="true"></span></label><button class="ui-icon-button" id="insights-date-open" type="button" aria-label="选择统计日期" aria-haspopup="dialog"><span data-icon="calendar"></span></button></header>',
      '<div class="insights-toolbar"><div id="insights-period" class="segmented" role="group" aria-label="统计周期"><button type="button" data-period="week">周</button><button type="button" data-period="month" aria-pressed="true">月</button><button type="button" data-period="year">年</button></div></div>',
      '<nav id="insights-time-nav" aria-label="统计时间范围"></nav>',
      '<p id="insights-range" class="subtle-copy"></p>',
      '<div class="statistics-summary" aria-live="polite"><p><span id="insights-total-label">总支出</span>：<strong id="insights-total">—</strong></p><p><span>日均</span>：<strong id="insights-average">—</strong><span id="insights-average-days"></span></p></div>',
      '<section class="trend-section"><h3 id="trend-title" class="sr-only">支出趋势</h3><div id="trend-chart" class="trend-chart" role="img"></div><p id="trend-caption" class="subtle-copy sr-only"></p></section>',
      '<section class="rankings-section"><div class="panel-heading"><h3 id="ranking-title">支出排行榜</h3><div id="ranking-direction" class="segmented hidden" role="group" aria-label="排行类型"><button type="button" data-ranking-type="income">收入</button><button type="button" data-ranking-type="expense" aria-pressed="true">支出</button></div></div><div class="ranking-grid"><section data-rank-section="income"><h3 class="sr-only">收入分类排行</h3><div id="income-ranking" class="rank-list"></div></section><section data-rank-section="expense"><h3 class="sr-only">支出分类排行</h3><div id="expense-ranking" class="rank-list"></div></section></div></section>',
      '<details class="statistics-other compose-details"><summary>学习、任务与收支汇总</summary><div class="period-summary insights-summary"><div><span>收入</span><strong id="insights-income">—</strong></div><div><span>支出</span><strong id="insights-expense">—</strong></div><div><span>结余</span><strong id="insights-balance">—</strong></div></div><div class="insights-secondary"><span id="insights-study"></span><span id="insights-tasks"></span></div></details>'
    ].join('');
    monthly.prepend(insights);
    const dates = document.createElement('dialog');
    dates.id='insights-date-dialog'; dates.className='editor-dialog ui-sheet'; dates.setAttribute('aria-labelledby','insights-date-title');
    dates.innerHTML='<div class="ui-sheet-header"><h2 id="insights-date-title">统计日期</h2><button id="insights-date-close" class="ui-icon-button" type="button" aria-label="关闭统计日期"><span data-icon="close"></span></button></div><label class="form-stack">参考日期<input id="insights-anchor" type="date" aria-label="统计参考日期"></label><p class="subtle-copy">周从周一开始；日均按完整周期的自然日数计算。</p><button type="button" class="secondary-button" id="insights-now">返回本期</button>';
    document.body.append(dates);
    $('#insights-date-open').addEventListener('click',()=>dates.showModal());
    $('#insights-date-close').addEventListener('click',()=>window.LifeUI.closeSheet(dates));
  }

  function loadCategoryData() {
    const result = readStoredCategories();
    if (result.error) { categoryError = result.error; return window.LifeCategories.blank(); }
    return result.data;
  }

  function readStoredCategories(forMerge = false) {
    try {
      const raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
      if (raw === null) return { data: forMerge ? { categories: [], assignments: [] } : window.LifeCategories.blank(), error: '' };
      const value = JSON.parse(raw);
      const error = window.LifeCategories.validate(value);
      return error ? { data: null, error: '分类数据无法安全读取：' + error } : { data: value, error: '' };
    } catch (error) { return { data: null, error: '分类数据无法安全读取，已停止分类写入与导入。' }; }
  }

  function writeStoreTransaction(entries) {
    const snapshots = [];
    try {
      entries.forEach(([key, value]) => snapshots.push([key, localStorage.getItem(key), JSON.stringify(value)]));
      snapshots.forEach(([key, before, after]) => { if (before !== after) localStorage.setItem(key, after); });
      snapshots.forEach(([key, before, after]) => {
        if (key === STORAGE_KEY) dataSnapshotRaw = after;
        if (key === PERSONAL_STORAGE_KEY) personalSnapshotRaw = after;
        if (key === window.LifeSchedule.key) scheduleSnapshotRaw = after;
        if (key === window.LifeLearning.key) learningSnapshotRaw = after;
      });
      return '';
    } catch (error) {
      let rollbackFailed = false;
      snapshots.reverse().forEach(([key, before]) => {
        try { if (before === null) localStorage.removeItem(key); else localStorage.setItem(key, before); }
        catch (rollbackError) { rollbackFailed = true; }
      });
      return rollbackFailed ? '保存失败，部分存储恢复受限。请保留当前页面并先导出数据。' : '保存失败，原有记录已恢复，输入内容仍保留。请检查浏览器存储空间。';
    }
  }

  function saveHealth(next, expectedRaw) {
    const current = window.LifeHealth.read(localStorage);
    if (current.error) return current.error;
    if (current.raw !== expectedRaw) return '健康数据已变化，未覆盖；输入仍保留，请重新核对。';
    const error = window.LifeHealth.validate(next);
    return error || writeStoreTransaction([[window.LifeHealth.key,next]]);
  }

  function saveNotes(next, expectedRaw) {
    const current=window.LifeNotes.read(localStorage);
    if(current.error)return current.error;
    if(current.raw!==expectedRaw)return '笔记在其他页面变化，请核对最新内容；输入已保留。';
    return window.LifeNotes.validate(next)||writeStoreTransaction([[window.LifeNotes.key,next]]);
  }

  function decodeRichBackup(backup) {
    // Reuse the proven v9 media decoder without changing the old media format.
    return window.LifeIdeasRich.decodeBackup(backup.schemaVersion>=10?{...backup,schemaVersion:9}:backup);
  }

  function toast(message, error = false) {
    window.LifeUI.toast(message, error);
  }

  function runPageTransition(update) {
    update();
  }

  function confirmAction(message, title = '确认删除', action = '确认删除') {
    $('#confirm-title').textContent = title;
    $('#confirm-accept').textContent = action;
    $('#confirm-accept').classList.toggle('danger-button', /删除|放弃/.test(action));
    if (confirmationResolve) return Promise.resolve(false);
    $('#confirm-message').textContent = message;
    $('#confirm-dialog').showModal();
    $('#confirm-cancel').focus();
    return new Promise((resolve) => { confirmationResolve = resolve; });
  }

  function finishConfirmation(accepted) {
    const resolve = confirmationResolve;
    confirmationResolve = null;
    if ($('#confirm-dialog').open) $('#confirm-dialog').close();
    if (resolve) resolve(accepted);
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      dataSnapshotRaw = raw;
      const saved = JSON.parse(raw);
      if (saved === null) return blankData();
      const error = validateData(saved);
      if (error) { dataError = `现有记录无法安全读取：${error} 已停止写入。`; return blankData(); }
      return saved;
    } catch (error) {
      dataError = '现有记录无法安全读取，已停止写入。请保留原浏览器数据。';
      return blankData();
    }
  }

  function loadPersonalData() {
    try {
      const raw = localStorage.getItem(PERSONAL_STORAGE_KEY);
      personalSnapshotRaw = raw;
      if (raw === null) return blankPersonalData();
      const saved = JSON.parse(raw);
      const error = validatePersonalData(saved);
      if (error) {
        personalDataError = `个人空间数据无法安全读取：${error}`;
        return blankPersonalData();
      }
      return { ...saved, dailyLogs: Array.isArray(saved.dailyLogs) ? saved.dailyLogs : [] };
    } catch (error) {
      personalDataError = '个人空间数据无法安全读取，已停止写入以保护原有内容。';
      return blankPersonalData();
    }
  }

  function saveData() {
    if (dataError) { toast(dataError, true); return false; }
    const validation = validateData(data);
    if (validation) { data = loadData(); render(); toast(validation, true); return false; }
    try {
      if (localStorage.getItem(STORAGE_KEY) !== dataSnapshotRaw) {
        data = loadData();
        render();
        toast('另一页面已更新记录，已重新读取。请重试本次操作。', true);
        return false;
      }
      const raw = JSON.stringify(data);
      localStorage.setItem(STORAGE_KEY, raw);
      dataSnapshotRaw = raw;
      return true;
    } catch (error) {
      data = loadData(); render(); toast('浏览器暂时无法保存数据。请检查存储空间或隐私设置。', true);
      return false;
    }
  }

  function loadScheduleMeta() {
    const stored = window.LifeSchedule.read(localStorage, data.tasks);
    scheduleSnapshotRaw = stored.raw;
    scheduleMetaError = stored.error;
    return stored.data || window.LifeSchedule.blank();
  }

  function saveSchedule(nextData, nextMeta) {
    const S = window.LifeSchedule;
    if (dataError || scheduleMetaError || learningMetaError) return dataError || scheduleMetaError || learningMetaError;
    const nextLearning = window.LifeLearning.reconcile(learningMeta, nextData);
    const validation = validateData(nextData) || S.validate(nextMeta, nextData.tasks) || window.LifeLearning.validate(nextLearning,nextData);
    if (validation) return validation;
    try {
      if (localStorage.getItem(STORAGE_KEY) !== dataSnapshotRaw || localStorage.getItem(S.key) !== scheduleSnapshotRaw || localStorage.getItem(window.LifeLearning.key) !== learningSnapshotRaw) {
        data = loadData(); scheduleMeta = loadScheduleMeta(); learningMeta = loadLearningMeta(); render();
        return '另一页面已更新日程。已重新读取，输入保留；请核对后重试。';
      }
    } catch (error) { return '无法读取浏览器存储，输入已保留。'; }
    const entries = [[STORAGE_KEY, nextData]];
    if (S.hasData(nextMeta) || scheduleSnapshotRaw !== null) entries.push([S.key, nextMeta]);
    if (JSON.stringify(nextLearning) !== JSON.stringify(learningMeta)) entries.push([window.LifeLearning.key, nextLearning]);
    const error = writeStoreTransaction(entries);
    if (error) { data = loadData(); scheduleMeta = loadScheduleMeta(); learningMeta = loadLearningMeta(); render(); return error; }
    data = nextData; scheduleMeta = nextMeta; learningMeta = nextLearning;
    return '';
  }

  function loadLearningMeta() {
    const stored = window.LifeLearning.read(localStorage, data);
    learningSnapshotRaw = stored.raw; learningMetaError = stored.error;
    return stored.data;
  }

  // Guard all affected snapshots; the shared writer attempts rollback on storage failure.
  function saveLearning(nextData, nextLearning, nextSchedule = scheduleMeta) {
    const L = window.LifeLearning, S = window.LifeSchedule;
    const error = dataError || scheduleMetaError || learningMetaError || validateData(nextData)
      || S.validate(nextSchedule, nextData.tasks) || L.validate(nextLearning, nextData);
    if (error) return error;
    try {
      if (localStorage.getItem(STORAGE_KEY) !== dataSnapshotRaw || localStorage.getItem(S.key) !== scheduleSnapshotRaw
        || localStorage.getItem(L.key) !== learningSnapshotRaw) {
        data = loadData(); scheduleMeta = loadScheduleMeta(); learningMeta = loadLearningMeta(); render();
        return '另一页面已更新学习或日程，已重新读取。输入保留，请核对后重试。';
      }
    } catch (error) { return '无法读取浏览器存储，输入已保留：' + error.message; }
    const entries = [[L.key, nextLearning]];
    // Write the canonical record first; a reserved ID makes an interrupted timer save detectable.
    if (JSON.stringify(nextData) !== JSON.stringify(data)) entries.unshift([STORAGE_KEY, nextData]);
    if (JSON.stringify(nextSchedule) !== JSON.stringify(scheduleMeta)) entries.push([S.key, nextSchedule]);
    const saveError = writeStoreTransaction(entries);
    if (saveError) { data = loadData(); scheduleMeta = loadScheduleMeta(); learningMeta = loadLearningMeta(); return saveError; }
    data = nextData; learningMeta = nextLearning; scheduleMeta = nextSchedule;
    populateMonthYears(); render(); return '';
  }

  function saveLearningGoal(date, value) {
    const L = window.LifeLearning, next = L.clone(learningMeta);
    if (!L.dateValid(date) || value !== '' && !L.minutes(Number(value))) return '目标需为1–1440整数分钟；留空可移除目标。';
    next.dailyGoals = next.dailyGoals.filter(row => row.date !== date);
    if (value !== '') next.dailyGoals.push({ date, minutes: Number(value) });
    return saveLearning(data, next);
  }

  function saveLearningPlan(fields, expected) {
    const L = window.LifeLearning, S = window.LifeSchedule;
    const next = L.clone(learningMeta), nextData = L.clone(data), nextSchedule = S.clone(scheduleMeta);
    if (!L.minutes(Number(fields.estimatedMinutes))) return '预计时长需为1–1440整数分钟。';
    let task;
    if (fields.linkId) {
      task = nextData.tasks.find(row => row.id === fields.linkId);
      if (!task) return '所选日程已不存在，请重新选择。';
      if (next.plans.some(row => row.taskId === task.id && !row.archived)) return '此日程已关联学习计划，请直接编辑原计划。';
    } else {
      const old = fields.id ? nextData.tasks.find(row => row.id === fields.id) : null;
      if (fields.id && (!old || expected !== JSON.stringify({ task: old, plan: next.plans.find(row => row.taskId === fields.id), detail: S.detailFor(scheduleMeta, fields.id) }))) return '计划已变化，请重新打开编辑；当前输入保留。';
      task = old ? { ...old, title: fields.title.trim(), date: fields.date }
        : { id: makeId(), date: fields.date, title: fields.title.trim(), start: '', end: '', completed: false, createdAt: Date.now() };
      const error = S.planError(task);
      if (error) return error;
      if (old) nextData.tasks[nextData.tasks.findIndex(row => row.id === task.id)] = task;
      else nextData.tasks.push(task);
      const detail = { ...S.detailFor(nextSchedule, task.id), priority: fields.priority || null };
      nextSchedule.taskDetails = nextSchedule.taskDetails.filter(row => row.taskId !== task.id).concat(detail);
    }
    next.plans = next.plans.filter(row => row.taskId !== task.id).concat({ taskId: task.id, estimatedMinutes: Number(fields.estimatedMinutes), archived: false });
    return saveLearning(nextData, next, nextSchedule);
  }

  function archiveLearningPlan(id) {
    const next = window.LifeLearning.clone(learningMeta), plan = next.plans.find(row => row.taskId === id);
    if (!plan) return '计划已不存在。';
    plan.archived = true; return saveLearning(data, next);
  }

  function focusAction(action, fields = {}) {
    const L = window.LifeLearning, next = L.clone(learningMeta), session = L.active(next), now = Date.now();
    if (action === 'start') {
      if (session) return '请先保存或取消当前计时。';
      const title = String(fields.title || '').trim(), taskId = fields.taskId || null;
      if (!title || title.length > 100) return '计时主题需为1–100字；较长的日程标题请在此调整。';
      if (taskId && !next.plans.some(row => row.taskId === taskId && !row.archived && data.tasks.some(task => task.id === taskId))) return '关联计划已不存在，请重新选择。';
      next.focusSessions.push({ id: makeId(), taskId, title, date: today(), status: 'running', accumulatedMs: 0,
        startedAt: now, endedAt: null, studyRecordId: makeId(), recordDeleted: false, createdAt: now, updatedAt: now });
    } else {
      if (!session) return '没有待处理计时。';
      if (action === 'save') {
        if (session.status !== 'ended') return '请先结束计时，再确认保存。';
        const duration = Math.floor(session.accumulatedMs / 60000), date = fields.date;
        if (!L.dateValid(date)) return '请选择实际学习日期。';
        if (duration < 1) return '不足1完整分钟，成果已保留；可继续计时后再保存。';
        if (duration > 1440) return '超过单条1440分钟上限，成果已保留；请手动分日记录后取消本次待保存计时。';
        const record = { id: session.studyRecordId, date, content: session.title, duration, createdAt: session.createdAt };
        const old = data.studies.find(row => row.id === record.id);
        if (old && Object.keys(record).some(key => old[key] !== record[key])) return '预留 ID 已有不同内容，已停止保存，不会覆盖原记录。';
        const nextData = old ? data : { ...data, studies: data.studies.concat(record) };
        session.status = 'saved'; session.date = date; session.updatedAt = now;
        return saveLearning(nextData, next);
      }
      const result = L.transition(session, action, now);
      if (result.error) return result.error;
      next.focusSessions[next.focusSessions.findIndex(row => row.id === session.id)] = result.row;
    }
    return saveLearning(data, next);
  }

  async function newLearningRecord(taskId) {
    if ((otherDraftForms.has('study-form') || recordEditors.study) && !await confirmAction('放弃当前学习编辑，打开新增记录？', '新增学习', '放弃并新增')) return;
    resetRecordForm('study'); window.LifeLearningUI.showRecords(true);
    $('#study-date').value = taskId ? today() : learningDate();
    const task = data.tasks.find(row => row.id === taskId);
    if (task) {
      if (task.title.length <= 100) { $('#study-content').value = task.title; otherDraftForms.add('study-form'); }
      else recordStatus('study', '日程标题超过100字，请为实际记录填写较短主题。');
    }
    $('#study-content').focus();
  }

  function saveScheduleSeries(row, expected) {
    const existing = scheduleMeta.series.find(value => value.id === row.id);
    if ((existing ? JSON.stringify(existing) : null) !== expected) return '该规则已变化，未覆盖。请保留输入并重新核对。';
    const next = window.LifeSchedule.clone(scheduleMeta);
    next.series = next.series.filter(value => value.id !== row.id).concat(row);
    const error = saveSchedule({ ...data }, next);
    if (!error) { render(); toast('重复规则已保存 · 尚未自动生成任务'); }
    return error;
  }

  function toggleScheduleSeries(id) {
    const next = window.LifeSchedule.clone(scheduleMeta), series = next.series.find(row => row.id === id);
    if (!series) return;
    series.active = !series.active; series.updatedAt = Date.now();
    const error = saveSchedule({ ...data }, next);
    if (error) toast(error, true); else { render(); toast(series.active ? '规则已启用 · 请确认生成' : '规则已暂停 · 已有日程保留'); }
  }

  async function generateScheduleSeries(id) {
    if (scheduleGenerationPending) return;
    scheduleGenerationPending = true;
    try {
      const result = window.LifeSchedule.generate(scheduleMeta, data.tasks, id, makeId, Date.now());
      if (result.error) { toast(result.error, true); return; }
      if (!result.count) { toast('没有待生成的日期；已存在或已删除的实例不会重复生成。'); return; }
      const added = result.tasks.filter(task => !data.tasks.some(old => old.id === task.id));
      const overlaps = added.filter(task => window.LifeSchedule.conflicts(task, data.tasks).length).length;
      if (!await confirmAction(`将新增 ${result.count} 项日程（${added[0].date} 至 ${added[added.length-1].date}），其中 ${overlaps} 项与现有安排时间重叠。新实例均为未完成；已有及已删除实例跳过，历史完成状态保留。`, '预览重复日程', '确认生成')) return;
      const error = saveSchedule({ ...data, tasks: result.tasks }, result.meta);
      if (error) toast(error, true); else { populateMonthYears(); render(); toast(`已生成 ${result.count} 项日程`); }
    } finally { scheduleGenerationPending = false; }
  }

  function savePersonalData() {
    if (personalDataError) {
      toast(personalDataError, true);
      return false;
    }
    const validation = validatePersonalData(personalData);
    if (validation) { toast(validation, true); return false; }
    try {
      if (localStorage.getItem(PERSONAL_STORAGE_KEY) !== personalSnapshotRaw) {
        toast('另一页面已更新个人记录，请刷新后重试；输入内容保留。', true);
        return false;
      }
      const raw = JSON.stringify(personalData);
      localStorage.setItem(PERSONAL_STORAGE_KEY, raw);
      personalSnapshotRaw = raw;
      return true;
    } catch (error) {
      personalData = loadPersonalData(); render(); toast('个人空间数据暂时无法保存。请检查浏览器存储空间或隐私设置。', true);
      return false;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function selectedDate() { return $('#selected-date').value || today(); }
  // Independent view state, outside record models and strict JSON settings.
  let learningViewDate = '', scheduleViewDate = '';
  function learningDate() { return learningViewDate || selectedDate(); }
  function scheduleDate() { return scheduleViewDate || selectedDate(); }
  function chooseModuleDate(module, date) {
    if (!isValidDate(date)) return;
    if (module === 'learning') {
      learningViewDate = date; historyPages.study = 1;
      if (!recordEditors.study && !otherDraftForms.has('study-form')) $('#study-date').value = date;
    } else {
      scheduleViewDate = date;
      if (!$('#task-id').value && !otherDraftForms.has('task-form')) $('#task-date').value = date;
    }
    render(); rememberView();
  }
  function onDate(items) { return items.filter((item) => item.date === selectedDate()); }
  function dailyRecordSnapshot(date, sourceData, sourcePersonal) {
    const log = (sourcePersonal.dailyLogs || []).find((entry) => entry.date === date) || null;
    return JSON.stringify({
      date,
      log,
      study: log?.studyRecordId ? sourceData.studies.find((entry) => entry.id === log.studyRecordId) || null : null,
      finance: log?.financeRecordId ? sourceData.finances.find((entry) => entry.id === log.financeRecordId) || null : null,
    });
  }
  function fillDailyRecordForm(date = selectedDate()) {
    const form = $('#daily-record-form');
    if (!form) return;
    if (dailyEditSnapshot && dailyFormBaseline && dailyFormSignature() !== dailyFormBaseline) {
      const previousDate = JSON.parse(dailyEditSnapshot).date;
      dailyDrafts.set(previousDate, { values: readDailyForm(), snapshot: dailyEditSnapshot, baseline: dailyFormBaseline });
    }
    const record = personalData.dailyLogs.find((entry) => entry.date === date);
    const linkedFinance = record?.financeRecordId
      ? data.finances.find((item) => item.id === record.financeRecordId && item.date === date && item.note === '一键今日记录')
      : null;
    $('#daily-record-date').value = date;
    $('#daily-completed-items').value = record?.completedItems || '';
    $('#daily-study-minutes').value = record?.studyMinutes || '';
    $('#daily-income').value = linkedFinance ? String(linkedFinance.income) : (Number(record?.income) > 0 ? String(record.income) : '');
    $('#daily-expense').value = linkedFinance ? String(linkedFinance.expense) : (Number(record?.expense) > 0 ? String(record.expense) : '');
    document.querySelectorAll('input[name="daily-energy"]').forEach((input) => { input.checked = input.value === (record?.energy || ''); });
    $('#daily-summary').value = record?.summary || '';
    dailyEditSnapshot = dailyRecordSnapshot(date, data, personalData);
    dailyFormBaseline = dailyFormSignature();
    const draft = dailyDrafts.get(date);
    if (draft) { applyDailyForm(draft.values); dailyEditSnapshot = draft.snapshot; dailyFormBaseline = draft.baseline; }
    $('#daily-record-status').textContent = draft ? '已保留这一天尚未保存的输入。' : '';
  }
  function money(value) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0);
  }
  function centsTotal(items, key) {
    return items.reduce((sum, item) => sum + Math.round((Number(item[key]) || 0) * 100), 0);
  }
  function countLabel(count, unit) { return `${count} ${unit}`; }

  function render() {
    const date = selectedDate();
    const studies = onDate(data.studies);
    const finances = onDate(data.finances);
    const tasks = onDate(data.tasks);
    const studyMinutes = studies.reduce((sum, item) => sum + Number(item.duration || 0), 0);
    const income = finances.reduce((sum, item) => sum + Number(item.income || 0), 0);
    const expense = finances.reduce((sum, item) => sum + Number(item.expense || 0), 0);
    const completed = tasks.filter((item) => item.completed).length;
    const percent = tasks.length ? Math.round(completed / tasks.length * 100) : 0;

    $('#overview-study').textContent = studyMinutes;
    $('#overview-study-sub').textContent = studies.length ? `${studies.length} 条学习记录` : '还没有学习记录';
    $('#overview-income').textContent = finances.length ? money(income) : '—';
    $('#overview-expense').textContent = finances.length ? money(expense) : '—';
    $('#overview-balance').textContent = finances.length ? money(income - expense) : '—';
    $('#study-total').textContent = `${data.studies.filter(item=>item.date===learningDate()).reduce((sum,item)=>sum+Number(item.duration||0),0)} 分钟`;
    const scheduleTasks = data.tasks.filter(item=>item.date===scheduleDate());
    const scheduleCompleted = scheduleTasks.filter(item=>item.completed).length;
    const schedulePercent = scheduleTasks.length ? Math.round(scheduleCompleted/scheduleTasks.length*100) : 0;
    $('#completion-percent').textContent = `${schedulePercent}%`;
    $('#task-progress-bar').style.width = `${schedulePercent}%`;
    $('#task-fraction').textContent = `${scheduleCompleted} / ${scheduleTasks.length} 项`;
    $('#task-total').textContent = `${scheduleCompleted} / ${scheduleTasks.length} 项`;
    $('#task-list-view .section-heading h2').textContent = (scheduleDate() === today() ? '今日' : '当日') + '安排';
    $('#task-badge').textContent = countLabel(scheduleTasks.length, '项任务');
    $('#progress-title').textContent = tasks.length ? (completed === tasks.length ? '今天的任务都完成了' : `已经完成 ${completed} 项任务`) : '今天还没有任务';
    renderWorkspaceHome();

    renderHistory('study');
    renderHistory('finance');
    renderTasks(scheduleTasks);
    if (isTaskDetailRoute(window.location.hash)) {
      const taskId = taskIdFromRoute();
      if (!taskId || !renderTaskDetail(taskId)) routeToTaskList();
    }
    renderMonthly();
    renderPersonal();
    renderFinanceOverview();
    renderInsights();
    renderCategories();
    window.LifeLearningUI.render();
    window.LifeHealthUI.render();
    window.LifeNotesUI.render();
    if (window.LifeFinanceViews.match(location.hash)) window.LifeFinanceViews.renderRoute(location.hash);
    const readErrors = [dataError, personalDataError, categoryError, noteTagsError, financeMetaError, scheduleMetaError, learningMetaError].filter(Boolean).join(' ');
    $('#app-status').textContent = readErrors;
    $('#app-status').classList.toggle('hidden', !readErrors);
  }

  function personalSelectedDate() { return $('#personal-date').value || today(); }
  function diarySelectedDate() { return $('#diary-date')?.value || today(); }

  function previousDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day - 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  function currentLearningStreak(studyDates) {
    const dates = new Set(studyDates.filter((date) => date <= today()));
    let cursor = dates.has(today()) ? today() : previousDate(today());
    if (!dates.has(cursor)) return 0;
    let streak = 0;
    while (dates.has(cursor)) { streak += 1; cursor = previousDate(cursor); }
    return streak;
  }

  function renderPersonal() {
    const profile = personalData.profile;
    const nickname = profile.nickname.trim() || '我的昵称';
    $('#profile-nickname').textContent = nickname;
    $('#profile-avatar').textContent = Array.from(nickname)[0] || '我';
    $('#profile-identity').textContent = profile.identity.trim() || '添加你的身份介绍';
    $('#profile-goal').textContent = profile.goal.trim() || '设置一个属于自己的目标';
    $('#profile-motto').textContent = profile.motto.trim() || '写下你的座右铭，让它陪伴每一天。';

    const studyDays = [...new Set(data.studies.map((item) => item.date))].sort();
    const minutes = data.studies.reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
    $('#personal-study-minutes').textContent = minutes;
    $('#personal-study-days').textContent = studyDays.length;
    const streak = currentLearningStreak(studyDays);
    $('#personal-study-streak').textContent = streak;
    const week = window.LifeInsights.summarize(data, 'week', today());
    const todayMinutes = data.studies.filter(row => row.date === today()).reduce((sum,row) => sum + row.duration, 0);
    const dailyGoal = learningMeta.dailyGoals.find(row => row.date === today())?.minutes;
    $('#my-growth-meta').textContent = minutes + ' 分钟';
    $('#my-growth-sub').textContent = '本周 ' + week.totals.studyMinutes + ' 分钟 · 连续 ' + streak + ' 天';
    $('#personal-growth-extra').textContent = '本周 ' + week.totals.studyMinutes + ' 分钟 · ' + (dailyGoal ? '今日目标 ' + Math.round(todayMinutes / dailyGoal * 100) + '%（' + todayMinutes + '/' + dailyGoal + ' 分钟）' : '今日学习目标未设置');

    const incomeCents = centsTotal(data.finances, 'income');
    const expenseCents = centsTotal(data.finances, 'expense');
    const netCents = incomeCents - expenseCents;
    $('#personal-income').textContent = money(incomeCents / 100);
    $('#personal-expense').textContent = money(expenseCents / 100);
    $('#personal-net-worth').textContent = money(netCents / 100);
    const targetCents = personalData.wealthTarget === null ? 0 : Math.round(personalData.wealthTarget * 100);
    const progress = targetCents ? Math.min(100, Math.max(0, Math.round(netCents / targetCents * 100))) : 0;
    $('#wealth-progress-label').textContent = targetCents ? `${money(netCents / 100)} / ${money(targetCents / 100)} 目标` : '请在个人设置中填写财富目标';
    $('#wealth-progress-percent').textContent = `${progress}%`;
    $('#wealth-progress-bar').style.width = `${progress}%`;
    $('#wealth-progress-percent').classList.toggle('hidden', !targetCents);
    $('#wealth-progress-bar').parentElement.classList.toggle('hidden', !targetCents);
    const month = window.LifeInsights.summarize(data, 'month', today());
    $('#my-wealth-meta').textContent = data.finances.length ? money(netCents / 100) : '尚无流水';
    $('#my-wealth-sub').textContent = month.hasFinancialRecords ? '本月结余 ' + money(month.totals.balanceCents / 100) + ' · USD' : '本月暂无流水 · USD';
    $('#personal-finance-month').textContent = month.label + ' · 收入 ' + money(month.totals.incomeCents / 100) + ' · 支出 ' + money(month.totals.expenseCents / 100);
    $('#my-skills-meta').textContent = SKILL_DEFINITIONS.length + ' 项自评';

    renderSkills();
    renderDiary();
    renderHabits();
    renderGoals();
    $('#personal-data-status').textContent = personalDataError;
    $('#personal-data-status').classList.toggle('hidden', !personalDataError);
  }

  function renderSkills() {
    $('#personal-skills').innerHTML = SKILL_DEFINITIONS.map((skill) => {
      const level = personalData.skills[skill.id];
      return `<label class="skill-row"><span class="skill-icon">${icon(skill.icon)}</span><span class="skill-name">${escapeHtml(skill.name)}</span><input type="range" min="0" max="100" step="5" value="${level}" data-skill-id="${skill.id}" aria-label="${escapeHtml(skill.name)}进度"><span class="skill-level" id="skill-value-${skill.id}">${level}%</span></label>`;
    }).join('');
  }

  function renderDiary() {
    const date = $('#diary-filter').value === 'date' ? $('#diary-filter-date').value : '';
    $('#diary-filter-date').classList.toggle('hidden', $('#diary-filter').value !== 'date');
    const tag = $('#idea-tag-filter').value;
    const options = window.LifeContent.allTags(noteTags);
    $('#idea-tag-filter').innerHTML = '<option value="">全部标签</option>' + options.map((value) => '<option value="' + escapeHtml(value) + '">' + escapeHtml('#' + value) + '</option>').join('');
    if (tag && !options.includes(tag)) $('#idea-tag-filter').add(new Option('#' + tag, tag));
    $('#idea-tag-filter').value = tag;
    const entries = window.LifeIdeasUI.entries(window.LifeContent.filterNotes(personalData.diary, noteTags, { date, tag, query: $('#idea-query').value }));
    diaryPage = 1;
    $('#diary-count').textContent = entries.length + ' 条';
    $('#diary-list').innerHTML = window.LifeIdeasUI.markup(entries,id=>window.LifeContent.tagsFor(noteTags,id));
    const filtered = Boolean(date || tag || $('#idea-query').value.trim());
    $('#idea-filter-summary').textContent = [$('#idea-query').value.trim() ? '关键词：' + $('#idea-query').value.trim() : '', tag ? '#' + tag : '', date].filter(Boolean).join(' · ') || '全部日期 · 全部妙想';
    $('#diary-empty').classList.toggle('hidden', entries.length > 0);
    $('#diary-empty').classList.add('idea-inline-empty');
    $('#diary-empty').textContent = filtered ? '没有匹配的妙想 · 可在搜索中清除筛选' : '还没有妙想，记录此刻的想法。';
    renderWorkspaceHome();
    renderGlobalSearch();
    window.LifeIdeasUI.refresh();
  }

  function renderHabits() {
    const date = personalSelectedDate();
    const completed = personalData.habits.filter((habit) => habit.checkedDates.includes(date)).length;
    $('#habit-progress').textContent = (date === today() ? '今天' : date) + '完成 ' + completed + ' / ' + personalData.habits.length + ' 项';
    $('#habit-list').innerHTML = personalData.habits.map((habit) => {
      const checked = habit.checkedDates.includes(date);
      return '<div class="habit-item ' + (checked ? 'completed' : '') + '"><label class="habit-toggle"><input type="checkbox" data-toggle-habit="' + escapeHtml(habit.id) + '" ' + (checked ? 'checked' : '') + ' aria-label="打卡：' + escapeHtml(habit.name) + '"></label><a class="habit-detail-link" href="#habit/' + encodeURIComponent(habit.id) + '" data-open-habit="' + escapeHtml(habit.id) + '"><span>' + escapeHtml(habit.name) + '</span><small>' + (checked ? '已完成' : '待完成') + ' · 详情 <span data-icon="chevronRight"></span></small></a><button class="icon-button delete-button" type="button" data-delete-habit="' + escapeHtml(habit.id) + '" aria-label="删除习惯">删除</button></div>';
    }).join('');
    $('#habit-empty').classList.toggle('hidden', personalData.habits.length > 0);
  }

  function renderGoals() {
    const goals = personalData.goals.slice().sort((a, b) => Number(a.completed) - Number(b.completed) || a.targetDate.localeCompare(b.targetDate) || a.createdAt - b.createdAt);
    $('#goal-count').textContent = goals.length + ' 个目标';
    $('#goal-timeline-summary').textContent = goals.length + ' 项 · 点击展开';
    $('#goal-current-list').innerHTML = goals.length ? goals.map((goal) => '<article class="goal-summary-item"><a href="#goal/' + encodeURIComponent(goal.id) + '" data-open-goal="' + escapeHtml(goal.id) + '"><strong>' + escapeHtml(goal.title) + '</strong><span>' + (goal.completed ? '已完成 · 100%' : '进行中') + ' · 截止 ' + escapeHtml(goal.targetDate) + '</span><small>下一步：' + escapeHtml(goal.description || '尚未填写，可在详情查看目标。') + '</small></a><label><input type="checkbox" data-toggle-goal="' + escapeHtml(goal.id) + '" ' + (goal.completed ? 'checked' : '') + '>完成</label></article>').join('') : '<p class="inline-empty">还没有长期目标。添加一个想完成的方向。</p>';
    $('#goal-timeline').innerHTML = goals.slice().sort((a,b) => a.targetDate.localeCompare(b.targetDate)).map((goal) => '<article class="goal-item"><span class="goal-dot"></span><div class="goal-item-main"><div class="goal-item-heading"><a href="#goal/' + encodeURIComponent(goal.id) + '" data-open-goal="' + escapeHtml(goal.id) + '"><strong>' + escapeHtml(goal.title) + '</strong></a><span class="goal-date">' + escapeHtml(goal.targetDate) + '</span></div><span class="goal-status">' + (goal.completed ? '已完成' : '进行中') + '</span></div><button class="icon-button delete-button" type="button" data-delete-goal="' + escapeHtml(goal.id) + '">删除</button></article>').join('');
    $('#goal-empty').classList.toggle('hidden', goals.length > 0);
  }

  function renderNoteDetail(id) {
    const entry = personalData.diary.find((item) => item.id === id);
    if (!entry) return false;
    $('#note-detail').innerHTML = window.LifeIdeasUI.detail(entry,window.LifeContent.tagsFor(noteTags,id));
    window.LifeIdeasRich.hydrate($('#note-detail'),personalData.diary);
    return true;
  }

  function renderGoalDetail(id) {
    const goal = personalData.goals.find((item) => item.id === id);
    if (!goal) return false;
    const created = new Date(goal.createdAt).toLocaleDateString('zh-CN');
    $('#goal-detail').innerHTML = '<button class="page-back" type="button" data-back-fallback="#goals"><span data-icon="back"></span> 返回</button><h3>' + escapeHtml(goal.title) + '</h3><p class="goal-status">' + (goal.completed ? '已完成 · 100%' : '进行中') + '</p><p>截止日期：' + escapeHtml(goal.targetDate) + '</p><h4>下一步</h4><p>' + escapeHtml(goal.description || '还没有填写下一步。') + '</p><details class="compose-details"><summary>目标时间线</summary><ol><li>创建目标 · ' + escapeHtml(created) + '</li><li>目标截止 · ' + escapeHtml(goal.targetDate) + '</li></ol></details><p class="subtle-copy">进度沿用原有完成状态；阶段尚未单独记录。</p>';
    return true;
  }

  function renderHabitDetail(id) {
    const habit = personalData.habits.find((item) => item.id === id);
    if (!habit) return false;
    const dates = habit.checkedDates.slice().sort().reverse();
    const recent = dates.slice(0, 30);
    $('#habit-detail').innerHTML = '<button class="page-back" type="button" data-back-fallback="#habits"><span data-icon="back"></span> 返回</button><h2>' + escapeHtml(habit.name) + '</h2><div class="period-summary"><div><span>累计完成</span><strong>' + dates.length + ' 天</strong></div><div><span>今天</span><strong>' + (dates.includes(today()) ? '已完成' : '待完成') + '</strong></div></div><details class="compose-details"><summary>打卡历史 · 最近 30 次</summary>' + (recent.length ? '<ul class="habit-history">' + recent.map((date) => '<li>' + escapeHtml(date) + ' · 已完成</li>').join('') + '</ul>' : '<p class="inline-empty">还没有打卡记录。</p>') + '</details>';
    return true;
  }

  function commitPersonalData(nextValue) {
    personalData = nextValue;
    if (!savePersonalData()) {
      personalData = loadPersonalData();
      renderPersonal();
      return false;
    }
    renderPersonal();
    return true;
  }

  function fillPersonalSettingsForm() {
    $('#profile-nickname-input').value = personalData.profile.nickname;
    $('#profile-identity-input').value = personalData.profile.identity;
    $('#profile-goal-input').value = personalData.profile.goal;
    $('#profile-motto-input').value = personalData.profile.motto;
    $('#wealth-target-input').value = personalData.wealthTarget ?? '';
  }

  function profileStatus(message, error = false) {
    $('#personal-profile-status').textContent = message;
    $('#personal-profile-status').classList.toggle('is-error', error);
  }

  function openPersonalProfile() {
    const dialog = $('#personal-settings');
    if (dialog.open) return;
    if (!otherDraftForms.has('personal-settings-form')) { fillPersonalSettingsForm(); profileStatus(''); }
    else profileStatus('已保留上次未保存的输入。');
    profileReturnFocus = document.activeElement;
    dialog.showModal();
    $('#profile-nickname-input').focus();
  }

  function clonePersonalData() { return JSON.parse(JSON.stringify(personalData)); }


  function readFinanceMeta(categories = categoryData) {
    return window.LifeFinanceMeta.read(localStorage,categories,window.LifeIcons.names);
  }
  function saveFinanceMeta(mutator) {
    const categories=readStoredCategories(),stored=readFinanceMeta(categories.data || categoryData);
    if(categories.error || stored.error)return categories.error || stored.error;
    const next=mutator(JSON.parse(JSON.stringify(stored.data)));
    if(typeof next === 'string')return next;
    const error=window.LifeFinanceMeta.validate(next,categories.data,window.LifeIcons.names) || writeStoreTransaction([[window.LifeFinanceMeta.key,next]]);
    if(error)return error;
    financeMeta=next;financeMetaError='';categoryData=categories.data;
    return '';
  }
  function openFinanceMonth() {
    financeMonthBefore = {view:captureUiView(),route:location.hash};
    $('#finance-month-dialog').showModal();
  }
  function closeFinanceMonth(commit) {
    const before=financeMonthBefore;financeMonthBefore=null;
    window.LifeUI.closeSheet($('#finance-month-dialog'),()=>{
      if(!commit && before)restoreUiView(before.view);
      if(commit && before?.route.startsWith('#finance/') && before.route!=='#bill/new') {
        const [path,query='']=before.route.split('?'),params=new URLSearchParams(query);
        params.set('month',$('#finance-period').value);
        history.replaceState(history.state,'',location.pathname+location.search+path+'?'+params);
        window.LifeFinanceViews.renderRoute(location.hash);
      }
    });
  }

  function rankMarkup(finances, type, limit, interactive = false) {
    try {
      const ranks = window.LifeCategories.summarize(finances, categoryData, type);
      const shown = limit ? ranks.slice(0, limit) : ranks;
      const max = ranks[0]?.cents || 1;
      const total = ranks.reduce((sum, row) => sum + row.cents, 0);
      if (!shown.length) return '<p class="inline-empty">暂无记录</p>';
      return shown.map((row, index) => {
        const share = total ? row.cents / total * 100 : 0;
        return (interactive ? '<a class="rank-row ui-list-row" data-open-page href="' + escapeHtml(window.LifeFinanceViews.categoryLink(row.categoryId, type, insightsPeriod, $('#insights-anchor').value || today())) + '">' : '<div class="rank-row">') + '<span class="category-glyph">' + icon(window.LifeFinanceViews.categoryIcon(row.categoryId)) + '</span><span class="rank-name">' + (interactive ? '' : (index + 1) + '. ') + escapeHtml(row.label) + (interactive ? '<small class="rank-share">' + share.toFixed(1) + '%</small>' : '') + '</span><strong>' + money(row.cents / 100) + '</strong><span class="rank-bar"><span style="width:' + Math.max(0, interactive ? share : row.cents / max * 100) + '%"></span></span>' + (interactive ? '</a>' : '</div>');
      }).join('');
    } catch (error) { return '<p class="record-form-status is-error">金额超出可安全统计的范围，请先检查原记录。</p>'; }
  }

  function renderFinanceOverview() {
    const month = $('#finance-period').value || today().slice(0, 7);
    const finances = data.finances.filter((item) => item.date.slice(0, 7) === month);
    const income = centsTotal(finances, 'income'), expense = centsTotal(finances, 'expense');
    $('#finance-period-caption').textContent = '美元 USD';
    $('#finance-income').textContent = finances.length ? money(income / 100) : '—';
    $('#finance-expense').textContent = finances.length ? money(expense / 100) : '—';
    $('#finance-balance').textContent = finances.length ? money((income - expense) / 100) : '—';
    $('#finance-category-list').innerHTML = rankMarkup(finances, $('#finance-category-type').value, 3);
    window.LifeFinanceViews.refreshHome();
  }

  function renderInsights() {
    const anchor = $('#insights-anchor').value || today();
    if (insightsPeriod === 'month' && isValidDate(anchor) && ($('#month-year').value !== anchor.slice(0, 4) || $('#month-month').value !== anchor.slice(5, 7))) {
      const year = anchor.slice(0, 4);
      if (![...$('#month-year').options].some((option) => option.value === year)) $('#month-year').add(new Option(year + ' 年', year));
      $('#month-year').value = year;
      $('#month-month').value = anchor.slice(5, 7);
      renderMonthly();
    }
    const result = window.LifeInsights.summarize(data, insightsPeriod, anchor);
    renderInsightsTimeNavigation(anchor);
    $('#insights-range').textContent = result.error || (insightsPeriod === 'week' ? result.label : result.label + ' · ' + result.start + ' 至 ' + result.end);
    const totals = result.totals;
    $('#insights-income').textContent = result.hasFinancialRecords ? money(totals.incomeCents / 100) : '—';
    $('#insights-expense').textContent = result.hasFinancialRecords ? money(totals.expenseCents / 100) : '—';
    $('#insights-balance').textContent = result.hasFinancialRecords ? money(totals.balanceCents / 100) : '—';
    $('#insights-study').textContent = '学习 ' + totals.studyMinutes + ' 分钟 · ' + totals.studyDays + ' 天';
    $('#insights-tasks').textContent = '任务 ' + totals.completedTasks + ' / ' + totals.taskCount + ' · ' + totals.taskRate + '%';
    document.querySelectorAll('[data-period]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.period === insightsPeriod)));
    document.querySelectorAll('[data-metric]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.metric === trendMetric)));
    const metricName = { income: '收入', expense: '支出', balance: '结余' }[trendMetric];
    $('#insights-type').value = trendMetric;
    $('#insights-total-label').textContent = '总' + metricName;
    $('#insights-total').textContent = result.hasFinancialRecords ? money(totals[trendMetric + 'Cents'] / 100) : '—';
    // UI-only derived average, approved: full calendar days, including future days.
    const days = result.error ? 0 : Math.round((Date.parse(result.end + 'T00:00:00Z') - Date.parse(result.start + 'T00:00:00Z')) / 86400000) + 1;
    $('#insights-average').textContent = result.hasFinancialRecords && days ? money(totals[trendMetric + 'Cents'] / 100 / days) : '—';
    $('#insights-average-days').textContent = days ? ' / ' + days + ' 天' : '';
    $('#trend-title').textContent = metricName + '趋势';
    window.LifeFinanceViews.chart($('#trend-chart'), $('#trend-caption'), result, trendMetric, metricName + '趋势', { compact:true, today:today() });
    const finances = data.finances.filter((item) => item.date >= result.start && item.date <= result.end);
    $('#income-ranking').innerHTML = rankMarkup(finances, 'income', null, true);
    $('#expense-ranking').innerHTML = rankMarkup(finances, 'expense', null, true);
    $('#ranking-title').textContent = (rankingType === 'income' ? '收入' : '支出') + '排行榜';
    $('#ranking-direction').classList.toggle('hidden', trendMetric !== 'balance');
    document.querySelectorAll('[data-ranking-type]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.rankingType === rankingType)));
    document.querySelectorAll('[data-rank-section]').forEach((section) => section.classList.toggle('hidden', section.dataset.rankSection !== rankingType));
  }

  // Navigation projects existing range() results; it never writes records or settings.
  function insightsShift(period, anchor, offset) {
    const range = window.LifeInsights.range(period, anchor);
    if (range.error) return '';
    const date = new Date(range.start + 'T12:00:00Z');
    if (period === 'week') date.setUTCDate(date.getUTCDate() + offset * 7);
    else if (period === 'month') date.setUTCMonth(date.getUTCMonth() + offset);
    else date.setUTCFullYear(date.getUTCFullYear() + offset);
    const value = date.toISOString().slice(0,10);
    return isValidDate(value) ? value : '';
  }

  function renderInsightsTimeNavigation(anchor) {
    const selected = window.LifeInsights.range(insightsPeriod, anchor), current = window.LifeInsights.range(insightsPeriod, today());
    if (selected.error) { $('#insights-time-nav').innerHTML=''; return; }
    const recent = [-4,-3,-2,-1,0].map(offset=>insightsShift(insightsPeriod,today(),offset));
    const dates = recent.includes(selected.start) ? recent : [-4,-3,-2,-1,0].map(offset=>insightsShift(insightsPeriod,anchor,offset));
    $('#insights-time-nav').innerHTML = dates.filter(Boolean).map(date=>{
      let label;
      if (date === current.start) label = {week:'本周',month:'本月',year:'今年'}[insightsPeriod];
      else if (date === insightsShift(insightsPeriod,today(),-1)) label = {week:'上周',month:'上月',year:'去年'}[insightsPeriod];
      else if (insightsPeriod === 'week') {
        const thursday = new Date(date + 'T12:00:00Z'); thursday.setUTCDate(thursday.getUTCDate()+3);
        const first = Date.UTC(thursday.getUTCFullYear(),0,1);
        const week = Math.ceil(((Date.UTC(thursday.getUTCFullYear(),thursday.getUTCMonth(),thursday.getUTCDate())-first)/86400000+1)/7);
        label = week + '周';
      } else label = insightsPeriod === 'month' ? Number(date.slice(5,7))+'月' : Number(date.slice(0,4))+'年';
      const range=window.LifeInsights.range(insightsPeriod,date);
      return '<button type="button" data-insights-date="'+date+'" aria-pressed="'+(date===selected.start)+'" aria-label="'+escapeHtml(label+'：'+range.start+' 至 '+range.end)+'">'+label+'</button>';
    }).join('');
  }

  function populateCategorySelect(selector, type, currentId = '', allowEmpty = true) {
    const select = $(selector);
    const categories = categoryData.categories.filter((item) => item.type === type && (item.active || item.id === currentId));
    select.innerHTML = (allowEmpty ? '<option value="">未分类</option>' : '<option value="" disabled>选择分类</option>') + categories.map((item) => '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(item.name) + (item.active ? '' : '（已停用）') + '</option>').join('');
    if (categories.some((item) => item.id === currentId)) select.value = currentId;
    else if (!allowEmpty && categories.length) select.value = categories[0].id;
    return categories.length;
  }

  function renderBillCategories() {
    const type = $('input[name="bill-type"]:checked')?.value || 'income';
    const current = $('#bill-category').value;
    const count = populateCategorySelect('#bill-category', type, current, false);
    $('#bill-submit').disabled = !count || Boolean(categoryError || dataError);
    window.LifeFinanceViews.renderBillChoices();
  }

  function renderCategories() {
    const type = $('#category-manage-type').value;
    const categories = categoryData.categories.filter((item) => item.type === type);
    $('#category-list').innerHTML = categories.length ? categories.map((item) => '<div class="settings-row"><span class="category-with-icon"><span class="category-glyph">' + icon(window.LifeFinanceViews.categoryIcon(item.id)) + '</span><span><strong>' + escapeHtml(item.name) + '</strong><small>' + (item.active ? '使用中' : '已停用 · 历史账单保留') + '</small></span></span><span class="category-actions"><button type="button" class="text-button" data-rename-category="' + escapeHtml(item.id) + '">改名</button><button type="button" class="text-button" data-toggle-category="' + escapeHtml(item.id) + '">' + (item.active ? '停用' : '恢复') + '</button></span></div>').join('') : '<p class="inline-empty">还没有分类，可以在上方新建。</p>';
  }

  function assignRecordCategories(value, record, selections) {
    const next = JSON.parse(JSON.stringify(value));
    for (const type of Object.keys(selections)) {
      const categoryId = selections[type];
      const existing = window.LifeCategories.assignmentFor(next, record.id, type);
      if (existing && existing.categoryId === categoryId) continue;
      next.assignments = next.assignments.filter((item) => !(item.recordId === record.id && item.type === type));
      if (!categoryId) continue;
      const category = next.categories.find((item) => item.id === categoryId && item.type === type && item.active);
      if (!category) return { error: '所选分类已停用或不存在，请重新选择分类。', data: null };
      next.assignments.push({ recordId: record.id, type, categoryId, label: category.name });
    }
    return { data: next, error: '' };
  }

  function fillFinanceCategoryEditor(record) {
    const stored = readStoredCategories();
    if (stored.error) { recordStatus('finance', stored.error, true); return; }
    categoryData = stored.data;
    for (const type of ['income', 'expense']) {
      const assignment = window.LifeCategories.assignmentFor(categoryData, record.id, type);
      populateCategorySelect('#finance-' + type + '-category', type, assignment?.categoryId || '');
    }
  }

  function submitBill(event) {
    event.preventDefault();
    const button = $('#bill-submit');
    if (button.disabled) return;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    const status = $('#bill-status');
    try {
      const stored = readStoredDataForBackup(), personal = readStoredPersonalForBackup(), categories = readStoredCategories();
      if (stored.error || personal.error || categories.error) { status.textContent = stored.error || personal.error || categories.error; return; }
      const type = $('input[name="bill-type"]:checked')?.value || 'income';
      const amount = $('#bill-amount').value.trim();
      if (amount === '') { status.textContent = '请填写金额，明确的 0 元也可以保存。'; return; }
      const categoryId = $('#bill-category').value;
      const category = categories.data.categories.find((item) => item.id === categoryId && item.type === type && item.active);
      if (!category) { status.textContent = '请选择有效的分类。'; return; }
      const fields = { date: $('#bill-date').value, income: type === 'income' ? amount : '', expense: type === 'expense' ? amount : '', note: $('#bill-note').value };
      const result = window.LifeRecordEditor.prepare(stored.data, personal.data, { type: 'finance', fields, newId: makeId(), createdAt: Date.now(), allowZero: true });
      if (result.error) { status.textContent = result.error; return; }
      const assigned = assignRecordCategories(categories.data, result.record, { [type]: categoryId });
      const error = assigned.error || window.LifeCategories.validate(assigned.data, result.data.finances);
      if (error) { status.textContent = error; return; }
      const saveError = writeStoreTransaction([[CATEGORY_STORAGE_KEY, assigned.data], [STORAGE_KEY, result.data]]);
      if (saveError) { status.textContent = saveError; return; }
      data = result.data; personalData = personal.data; categoryData = assigned.data;
      const date = result.record.date;
      $('#finance-period').value = date.slice(0, 7);
      $('#finance-history-anchor').value = date;
      $('#finance-history-range').value = 'month';
      $('#finance-history-search').value = '';
      historyPages.finance = 1;
      $('#bill-form').reset();
      $('#bill-date').value = today();
      status.textContent = '';
      populateMonthYears();
      render();
      returnUiPage('#finance');
      toast('账单已保存 · ' + (type === 'income' ? '收入 +' : '支出 −') + money(Number(amount)));
    } catch (error) { status.textContent = '保存失败，输入内容已保留，请稍后重试。'; }
    finally { button.removeAttribute('aria-busy'); renderBillCategories(); }
  }

  function resetCategoryForm() {
    otherDraftForms.delete('category-form');
    $('#category-id').value = '';
    $('#category-name').value = '';
    $('#category-submit').textContent = '新建分类';
    $('#category-cancel').classList.add('hidden');
    categoryEditorExpected = null;
    categoryIconExpected = null;
    window.LifeFinanceViews.selectCategoryIcon();
  }

  function submitCategory(event) {
    event.preventDefault();
    const categories = readStoredCategories(), stored = readStoredDataForBackup();
    const status = $('#category-status');
    if (categories.error || stored.error) { status.textContent = categories.error || stored.error; return; }
    const id = $('#category-id').value, type = $('#category-manage-type').value, name = $('#category-name').value.trim();
    if (!name || name.length > 30) { status.textContent = '分类名称为 1–30 字。'; return; }
    if (categories.data.categories.some((item) => item.type === type && item.id !== id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) { status.textContent = '同类型中已有这个名称，请使用已有分类或换一个名称。'; return; }
    const next = JSON.parse(JSON.stringify(categories.data));
    const category = next.categories.find((item) => item.id === id);
    const meta = readFinanceMeta(categories.data);
    if (meta.error) { status.textContent = meta.error; return; }
    if (id && JSON.stringify(meta.data.categoryIcons.find(item=>item.categoryId===id) || null) !== categoryIconExpected) { status.textContent = '分类图标已发生变化，请重新打开后编辑。'; return; }
    if (id && (!category || JSON.stringify(category) !== JSON.stringify(categoryEditorExpected))) { status.textContent = '这个分类已在其他页面发生变化，请重新打开后再改名。'; return; }
    const savedId = category?.id || makeId();
    if (category) category.name = name;
    else next.categories.push({ id: savedId, type, name, active: true, createdAt: Date.now() });
    const selectedIcon = $('input[name="category-icon"]:checked')?.value || 'tag';
    const nextMeta = JSON.parse(JSON.stringify(meta.data));
    const oldIcon = nextMeta.categoryIcons.find(item => item.categoryId === savedId);
    if (oldIcon) oldIcon.icon = selectedIcon; else nextMeta.categoryIcons.push({ categoryId: savedId, icon: selectedIcon });
    const error = window.LifeCategories.validate(next, stored.data.finances) || window.LifeFinanceMeta.validate(nextMeta, next, window.LifeIcons.names) || writeStoreTransaction([[CATEGORY_STORAGE_KEY, next], [window.LifeFinanceMeta.key, nextMeta]]);
    if (error) { status.textContent = error; return; }
    categoryData = next;
    financeMeta = nextMeta;
    resetCategoryForm();
    renderCategories(); renderBillCategories(); renderFinanceOverview(); renderInsights();
    status.textContent = id ? '名称已更新，历史账单仍保留原分类名称。' : '分类已新建，可以用于记账。';
    toast(id ? '分类名称已更新' : '分类已新建');
  }

  function toggleCategory(id) {
    const categories = readStoredCategories(), stored = readStoredDataForBackup();
    if (categories.error || stored.error) { toast(categories.error || stored.error, true); return; }
    const next = JSON.parse(JSON.stringify(categories.data));
    const category = next.categories.find((item) => item.id === id);
    if (!category) return;
    category.active = !category.active;
    const error = window.LifeCategories.validate(next, stored.data.finances) || writeStoreTransaction([[CATEGORY_STORAGE_KEY, next]]);
    if (error) { toast(error, true); return; }
    categoryData = next;
    renderCategories(); renderBillCategories();
    toast(category.active ? '分类已恢复' : '分类已停用，历史账单保留');
  }

  function deleteFinanceRecord(id) {
    const stored = readStoredDataForBackup(), categories = readStoredCategories();
    if (stored.error || categories.error) { toast(stored.error || categories.error, true); return; }
    const next = { ...stored.data, finances: stored.data.finances.filter((item) => item.id !== id) };
    const nextCategories = { ...categories.data, assignments: categories.data.assignments.filter((item) => item.recordId !== id) };
    const error = writeStoreTransaction([[CATEGORY_STORAGE_KEY, nextCategories], [STORAGE_KEY, next]]);
    if (error) { toast(error, true); return; }
    data = next; categoryData = nextCategories;
    render(); toast('账单已删除');
  }

  function renderMonthly() {
    const year = $('#month-year').value;
    const month = $('#month-month').value;
    if (!year || !month) return;
    const monthKey = `${year}-${month}`;
    const studies = data.studies.filter((item) => typeof item.date === 'string' && item.date.startsWith(`${monthKey}-`));
    const finances = data.finances.filter((item) => typeof item.date === 'string' && item.date.startsWith(`${monthKey}-`));
    const tasks = data.tasks.filter((item) => typeof item.date === 'string' && item.date.startsWith(`${monthKey}-`));
    const studyMinutes = studies.reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
    const incomeCents = centsTotal(finances, 'income');
    const expenseCents = centsTotal(finances, 'expense');
    const completed = tasks.filter((item) => item.completed).length;
    const taskRate = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
    const daysWithStudy = new Set(studies.map((item) => item.date)).size;

    $('#month-income').textContent = money(incomeCents / 100);
    $('#month-expense').textContent = money(expenseCents / 100);
    $('#month-balance').textContent = money((incomeCents - expenseCents) / 100);
    $('#month-study').textContent = studyMinutes;
    $('#month-study-days').textContent = `${daysWithStudy} 个学习日`;
    $('#month-tasks').textContent = `${completed} / ${tasks.length}`;
    $('#month-task-rate').textContent = `完成率 ${taskRate}%`;
    $('#month-detail-caption').textContent = `${year} 年 ${Number(month)} 月 · 逐日查看学习时长、收入和支出`;

    const daily = new Map();
    const getDay = (date) => {
      if (!daily.has(date)) daily.set(date, { study: 0, income: 0, expense: 0 });
      return daily.get(date);
    };
    studies.forEach((item) => { getDay(item.date).study += Number(item.duration) || 0; });
    finances.forEach((item) => {
      const totals = getDay(item.date);
      totals.income += Math.round((Number(item.income) || 0) * 100);
      totals.expense += Math.round((Number(item.expense) || 0) * 100);
    });
    const activeDays = [...daily.entries()].filter(([, totals]) => totals.study || totals.income || totals.expense);
    const peakIncome = activeDays.reduce((peak, current) => current[1].income > (peak?.[1].income || 0) ? current : peak, null);
    const peakExpense = activeDays.reduce((peak, current) => current[1].expense > (peak?.[1].expense || 0) ? current : peak, null);
    const hasIncome = peakIncome && peakIncome[1].income > 0;
    const hasExpense = peakExpense && peakExpense[1].expense > 0;
    $('#month-high-income').textContent = hasIncome ? `收入最高：${peakIncome[0].slice(-2)} 日 · ${money(peakIncome[1].income / 100)}` : '收入最高：暂无记录';
    $('#month-high-expense').textContent = hasExpense ? `支出最多：${peakExpense[0].slice(-2)} 日 · ${money(peakExpense[1].expense / 100)}` : '支出最多：暂无记录';

    const body = $('#month-daily-table');
    if (!activeDays.length) {
      body.innerHTML = '';
      $('#month-empty').classList.remove('hidden');
      return;
    }
    $('#month-empty').classList.add('hidden');
    const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
    body.innerHTML = Array.from({ length: daysInMonth }, (_, index) => {
      const date = `${monthKey}-${String(index + 1).padStart(2, '0')}`;
      const totals = daily.get(date) || { study: 0, income: 0, expense: 0 };
      const isIncomePeak = hasIncome && date === peakIncome[0];
      const isExpensePeak = hasExpense && date === peakExpense[0];
      const tags = `${isIncomePeak ? '<span class="peak-tag income-tag">收入最高</span>' : ''}${isExpensePeak ? '<span class="peak-tag expense-tag">支出最多</span>' : ''}`;
      return `<tr class="${isIncomePeak ? 'month-income-peak ' : ''}${isExpensePeak ? 'month-expense-peak' : ''}"><td>${date}${tags ? `<span class="peak-tags">${tags}</span>` : ''}</td><td>${totals.study} 分钟</td><td class="money-value">${money(totals.income / 100)}</td><td class="money-value">${money(totals.expense / 100)}</td><td class="money-value">${money((totals.income - totals.expense) / 100)}</td></tr>`;
    }).join('');
  }

  function populateMonthYears() {
    const currentYear = new Date().getFullYear();
    const selectedYear = $('#month-year').value || String(currentYear);
    const savedYears = [...data.studies, ...data.finances, ...data.tasks]
      .map((item) => typeof item.date === 'string' ? Number(item.date.slice(0, 4)) : NaN)
      .filter((year) => Number.isInteger(year) && year >= 1000 && year <= 9999);
    const years = new Set([...Array.from({ length: 12 }, (_, index) => currentYear - 10 + index), currentYear + 1, ...savedYears]);
    $('#month-year').innerHTML = [...years].sort((a, b) => b - a).map((year) => `<option value="${year}">${year} 年</option>`).join('');
    $('#month-year').value = years.has(Number(selectedYear)) ? selectedYear : String(currentYear);
    if (!$('#month-month').value) $('#month-month').value = String(new Date().getMonth() + 1).padStart(2, '0');
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function isValidDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }

  function hasExactKeys(value, keys) {
    return isPlainObject(value) && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
  }

  function validateRecords(records, type) {
    if (!Array.isArray(records)) return `${type}必须是数组。`;
    const ids = new Set();
    const schemas = {
      studies: ['id', 'date', 'content', 'duration', 'createdAt'],
      finances: ['id', 'date', 'income', 'expense', 'note', 'createdAt'],
      tasks: ['id', 'date', 'title', 'start', 'end', 'completed', 'createdAt'],
    };
    for (const [index, item] of records.entries()) {
      if (!hasExactKeys(item, schemas[type])) return `${type}第 ${index + 1} 条记录的字段不符合备份格式。`;
      if (typeof item.id !== 'string' || !item.id.trim() || item.id.length > 200) return `${type}第 ${index + 1} 条记录的 ID 无效。`;
      if (ids.has(item.id)) return `${type}中存在重复 ID，无法安全合并。`;
      ids.add(item.id);
      if (!isValidDate(item.date)) return `${type}第 ${index + 1} 条记录的日期无效。`;
      if (!Number.isFinite(item.createdAt) || item.createdAt < 0) return `${type}第 ${index + 1} 条记录的创建时间无效。`;
      if (type === 'studies') {
        if (typeof item.content !== 'string' || !item.content.trim() || item.content.length > 100) return `第 ${index + 1} 条学习记录内容无效。`;
        if (!Number.isInteger(item.duration) || item.duration < 0 || item.duration > 1440) return `第 ${index + 1} 条学习时长无效。`;
      } else if (type === 'finances') {
        if (typeof item.note !== 'string' || item.note.length > 120) return `第 ${index + 1} 条收支备注无效。`;
        for (const field of ['income', 'expense']) {
          const amount = item[field];
          if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || amount > Number.MAX_SAFE_INTEGER / 100 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7) return `第 ${index + 1} 条收支金额无效。`;
        }
      } else {
        if (typeof item.title !== 'string' || !item.title.trim() || item.title.length > 120) return `第 ${index + 1} 条任务内容无效。`;
        if (typeof item.start !== 'string' || (item.start && !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.start))) return `第 ${index + 1} 条任务开始时间无效。`;
        if (typeof item.end !== 'string' || (item.end && !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.end))) return `第 ${index + 1} 条任务结束时间无效。`;
        if (typeof item.completed !== 'boolean') return `第 ${index + 1} 条任务完成状态无效。`;
      }
    }
    return '';
  }

  function validateData(dataValue) {
    if (!hasExactKeys(dataValue, ['studies', 'finances', 'tasks'])) return '备份数据结构不正确。';
    for (const type of ['studies', 'finances', 'tasks']) {
      const error = validateRecords(dataValue[type], type);
      if (error) return error;
    }
    return '';
  }

  function validatePersonalRecordList(records, type, keys) {
    if (!Array.isArray(records)) return `个人空间中的${type}数据格式无效。`;
    const ids = new Set();
    for (const [index, item] of records.entries()) {
      if (!hasExactKeys(item, keys)) return `${type}第 ${index + 1} 条记录格式无效。`;
      if (typeof item.id !== 'string' || !item.id.trim() || item.id.length > 200 || ids.has(item.id)) return `${type}第 ${index + 1} 条记录 ID 无效或重复。`;
      ids.add(item.id);
      if (!Number.isFinite(item.createdAt) || item.createdAt < 0) return `${type}第 ${index + 1} 条记录时间无效。`;
      if (type === '妙想') {
        if (!isValidDate(item.date) || typeof item.title !== 'string' || item.title.length > 80 || typeof item.content !== 'string' || !item.content.trim() || item.content.length > 3000) return `妙想第 ${index + 1} 条内容无效。`;
      } else if (type === '习惯') {
        if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 50 || !Array.isArray(item.checkedDates) || item.checkedDates.some((date) => !isValidDate(date)) || new Set(item.checkedDates).size !== item.checkedDates.length) return `习惯第 ${index + 1} 条记录无效。`;
      } else if (type === '长期目标') {
        if (typeof item.title !== 'string' || !item.title.trim() || item.title.length > 120 || !isValidDate(item.targetDate) || typeof item.description !== 'string' || item.description.length > 180 || typeof item.completed !== 'boolean') return `长期目标第 ${index + 1} 条记录无效。`;
      }
    }
    return '';
  }

  function validatePersonalData(value) {
    if (!hasExactKeys(value, ['profile', 'wealthTarget', 'skills', 'diary', 'habits', 'goals']) && !hasExactKeys(value, ['profile', 'wealthTarget', 'skills', 'diary', 'habits', 'goals', 'dailyLogs'])) return '个人空间数据结构不正确。';
    if (!hasExactKeys(value.profile, ['nickname', 'identity', 'goal', 'motto'])) return '个人资料格式不正确。';
    const profileLimits = { nickname: 40, identity: 60, goal: 120, motto: 160 };
    for (const [field, limit] of Object.entries(profileLimits)) {
      if (typeof value.profile[field] !== 'string' || value.profile[field].length > limit) return '个人资料内容无效。';
    }
    if (value.wealthTarget !== null && (typeof value.wealthTarget !== 'number' || !Number.isFinite(value.wealthTarget) || value.wealthTarget <= 0 || value.wealthTarget > Number.MAX_SAFE_INTEGER / 100 || Math.abs(value.wealthTarget * 100 - Math.round(value.wealthTarget * 100)) > 1e-7)) return '财富目标金额无效。';
    const skillIds = SKILL_DEFINITIONS.map((skill) => skill.id);
    if (!hasExactKeys(value.skills, skillIds) || skillIds.some((id) => !Number.isInteger(value.skills[id]) || value.skills[id] < 0 || value.skills[id] > 100)) return '技能进度数据无效。';
    for (const [type, keys] of Object.entries({ diary: ['id', 'date', 'title', 'content', 'createdAt'], habits: ['id', 'name', 'checkedDates', 'createdAt'], goals: ['id', 'title', 'targetDate', 'description', 'completed', 'createdAt'] })) {
      const error = validatePersonalRecordList(value[type], type === 'diary' ? '妙想' : type === 'habits' ? '习惯' : '长期目标', keys);
      if (error) return error;
    }
    if (value.dailyLogs !== undefined) {
      const ids = new Set();
      const dates = new Set();
      if (!Array.isArray(value.dailyLogs)) return '每日记录数据格式无效。';
      for (const [index, log] of value.dailyLogs.entries()) {
        if (!hasExactKeys(log, ['id', 'date', 'completedItems', 'studyMinutes', 'income', 'expense', 'energy', 'summary', 'studyRecordId', 'financeRecordId', 'createdAt'])) return `每日记录第 ${index + 1} 条格式无效。`;
        if (typeof log.id !== 'string' || !log.id.trim() || ids.has(log.id) || !isValidDate(log.date) || dates.has(log.date)) return `每日记录第 ${index + 1} 条 ID 或日期无效、重复。`;
        ids.add(log.id); dates.add(log.date);
        if (typeof log.completedItems !== 'string' || log.completedItems.length > 1000 || typeof log.summary !== 'string' || log.summary.length > 1200 || !['', '充沛', '不错', '一般', '疲惫'].includes(log.energy)) return `每日记录第 ${index + 1} 条内容无效。`;
        if (!Number.isInteger(log.studyMinutes) || log.studyMinutes < 0 || log.studyMinutes > 1440 || !Number.isFinite(log.createdAt) || log.createdAt < 0) return `每日记录第 ${index + 1} 条数值无效。`;
        for (const field of ['income', 'expense']) if (!Number.isFinite(log[field]) || log[field] < 0 || Math.abs(log[field] * 100 - Math.round(log[field] * 100)) > 1e-7) return `每日记录第 ${index + 1} 条金额无效。`;
        if ((log.studyRecordId !== null && typeof log.studyRecordId !== 'string') || (log.financeRecordId !== null && typeof log.financeRecordId !== 'string')) return `每日记录第 ${index + 1} 条关联记录无效。`;
      }
    }
    return '';
  }

  function validateBackup(backup) {
    if (!isPlainObject(backup) || backup.format !== BACKUP_FORMAT || ![1, 2, 3, 4, BACKUP_VERSION, 6, 7, 8, 9, 10, 11].includes(backup.schemaVersion)) return '备份格式或版本不受支持。';
    const backupKeys = backup.schemaVersion === 1
      ? ['format', 'schemaVersion', 'exportedAt', 'data', 'settings']
      : backup.schemaVersion >= 4 ? ['format', 'schemaVersion', 'exportedAt', 'data', 'personal', 'financeCategories', 'settings'] : ['format', 'schemaVersion', 'exportedAt', 'data', 'personal', 'settings'];
    if (backup.schemaVersion >= 5) backupKeys.push('noteTags');
    if (backup.schemaVersion >= 6) backupKeys.push('financeMeta');
    if (backup.schemaVersion >= 7) backupKeys.push('scheduleMeta');
    if (backup.schemaVersion >= 8) backupKeys.push('learningMeta');
    if (backup.schemaVersion >= 9) backupKeys.push('ideasMeta','ideasAttachments','ideasDraft');
    if (backup.schemaVersion >= 10) backupKeys.push('health');
    if (backup.schemaVersion === 11) backupKeys.push('notes');
    if (!hasExactKeys(backup, backupKeys)) return '文件不是有效的生活管理台备份。';
    if (typeof backup.exportedAt !== 'string' || !Number.isFinite(Date.parse(backup.exportedAt))) return '备份时间字段无效。';
    const dataError = validateData(backup.data);
    if (dataError) return dataError;
    if (backup.schemaVersion >= 2) {
      const personalError = validatePersonalData(backup.personal);
      if (personalError) return personalError;
      if (backup.schemaVersion >= 3 && !Array.isArray(backup.personal.dailyLogs)) return '备份中的每日记录数据缺失。';
    }
    if (backup.schemaVersion >= 4) {
      const categoryError = window.LifeCategories.validate(backup.financeCategories, backup.data.finances);
      if (categoryError) return '备份分类数据无效：' + categoryError;
    }
    if (backup.schemaVersion >= 5) { const error = window.LifeContent.validate(backup.noteTags, backup.personal.diary); if (error) return error; }
    if (backup.schemaVersion >= 6) { const error = window.LifeFinanceMeta.validate(backup.financeMeta, backup.financeCategories, window.LifeIcons.names); if (error) return error; }
    if (backup.schemaVersion >= 7) { const error = window.LifeSchedule.validate(backup.scheduleMeta, backup.data.tasks); if (error) return error; }
    if (backup.schemaVersion >= 8) { const error = window.LifeLearning.validate(backup.learningMeta, backup.data, true); if (error) return error; }
    if(backup.schemaVersion>=9){const error=window.LifeIdeasRich.validate(backup.ideasMeta,backup.personal.diary);if(error)return error;if(!Array.isArray(backup.ideasAttachments))return '图片备份缺失。';}
    if(backup.schemaVersion>=10){const error=window.LifeHealth.validate(backup.health);if(error)return error;}
    if(backup.schemaVersion===11){const error=window.LifeNotes.validate(backup.notes);if(error)return error;}
    const settingsKeys = backup.schemaVersion === 1
      ? ['selectedDate', 'monthYear', 'monthMonth']
      : backup.schemaVersion >= 4 ? ['selectedDate', 'monthYear', 'monthMonth', 'personalDate', 'financePeriod', 'insightsPeriod', 'insightsAnchor'] : ['selectedDate', 'monthYear', 'monthMonth', 'personalDate'];
    if (!hasExactKeys(backup.settings, settingsKeys)) return '备份中的设置字段不正确。';
    if (!isValidDate(backup.settings.selectedDate)) return '备份中的查看日期无效。';
    if (typeof backup.settings.monthYear !== 'string' || !/^\d{4}$/.test(backup.settings.monthYear)) return '备份中的统计年份无效。';
    if (typeof backup.settings.monthMonth !== 'string' || !/^(0[1-9]|1[0-2])$/.test(backup.settings.monthMonth)) return '备份中的统计月份无效。';
    if (backup.schemaVersion >= 2 && !isValidDate(backup.settings.personalDate)) return '备份中的个人空间日期无效。';
    if (backup.schemaVersion >= 4 && (!/^\d{4}-(0[1-9]|1[0-2])$/.test(backup.settings.financePeriod) || !['week', 'month', 'year'].includes(backup.settings.insightsPeriod) || !isValidDate(backup.settings.insightsAnchor))) return '备份中的收支或趋势查看设置无效。';
    return '';
  }

  function readStoredDataForBackup() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return { data: blankData(), error: '' };
      const stored = JSON.parse(raw);
      const error = validateData(stored);
      return error ? { data: null, error: `当前本地数据无法安全读取：${error}` } : { data: stored, error: '' };
    } catch (error) {
      return { data: null, error: '当前本地数据无法安全读取，已停止操作以保护原有数据。' };
    }
  }

  function readStoredPersonalForBackup() {
    try {
      const raw = localStorage.getItem(PERSONAL_STORAGE_KEY);
      if (raw === null) return { data: blankPersonalData(), error: '' };
      const stored = JSON.parse(raw);
      const error = validatePersonalData(stored);
      return error ? { data: null, error: `当前个人空间数据无法安全读取：${error}` } : { data: { ...stored, dailyLogs: Array.isArray(stored.dailyLogs) ? stored.dailyLogs : [] }, error: '' };
    } catch (error) {
      return { data: null, error: '当前个人空间数据无法安全读取，已停止操作以保护原有内容。' };
    }
  }

  function recordsMatch(left, right) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
  }

  function analyzeMerge(currentData, backupData) {
    const result = { error: '', duplicates: 0, additions: { studies: [], finances: [], tasks: [] } };
    const currentError = validateData(currentData);
    if (currentError) { result.error = `当前本地数据无法安全合并：${currentError}`; return result; }
    for (const type of ['studies', 'finances', 'tasks']) {
      const byId = new Map(currentData[type].map((record) => [record.id, record]));
      for (const record of backupData[type]) {
        const existing = byId.get(record.id);
        if (!existing) result.additions[type].push(record);
        else if (recordsMatch(existing, record)) result.duplicates += 1;
        else { result.error = `发现冲突：${type}中的 ID「${record.id}」在现有数据和备份中内容不同。为保护数据，本次导入已停止。`; return result; }
      }
    }
    return result;
  }

  function analyzePersonalMerge(currentValue, backupValue) {
    const result = { error: '', duplicates: 0, newCheckins: 0, additions: { diary: [], habits: [], goals: [], dailyLogs: [] }, merged: null };
    const currentError = validatePersonalData(currentValue);
    if (currentError) { result.error = `当前个人空间数据无法安全合并：${currentError}`; return result; }
    const backupError = validatePersonalData(backupValue);
    if (backupError) { result.error = `备份中的个人空间数据无效：${backupError}`; return result; }

    const merged = JSON.parse(JSON.stringify(currentValue));
    for (const field of ['nickname', 'identity', 'goal', 'motto']) {
      const localValue = currentValue.profile[field];
      const incomingValue = backupValue.profile[field];
      if (!localValue.trim()) merged.profile[field] = incomingValue;
      else if (incomingValue.trim() && localValue !== incomingValue) {
        result.error = `个人资料“${field}”在现有设置和备份中都已填写且内容不同。为避免覆盖，请先手动选择保留内容。`;
        return result;
      }
    }
    if (currentValue.wealthTarget === null) merged.wealthTarget = backupValue.wealthTarget;
    else if (backupValue.wealthTarget !== null && currentValue.wealthTarget !== backupValue.wealthTarget) {
      result.error = '现有财富目标与备份中的财富目标不同。为避免覆盖，请先手动选择保留的目标金额。';
      return result;
    }
    for (const skill of SKILL_DEFINITIONS) merged.skills[skill.id] = Math.max(currentValue.skills[skill.id], backupValue.skills[skill.id]);

    for (const type of ['diary', 'goals']) {
      const byId = new Map(currentValue[type].map((record) => [record.id, record]));
      for (const record of backupValue[type]) {
        const existing = byId.get(record.id);
        if (!existing) result.additions[type].push(record);
        else if (recordsMatch(existing, record)) result.duplicates += 1;
        else { result.error = `${type === 'diary' ? '妙想' : '长期目标'}中发现同 ID 的不同内容。为保护现有数据，本次导入已停止。`; return result; }
      }
    }
    const incomingLogs = backupValue.dailyLogs || [];
    const currentLogs = currentValue.dailyLogs || [];
    const logsByDate = new Map(currentLogs.map((record) => [record.date, record]));
    const logsById = new Map(currentLogs.map((record) => [record.id, record]));
    for (const record of incomingLogs) {
      const sameId = logsById.get(record.id);
      if (sameId && !recordsMatch(sameId, record)) {
        result.error = '每日记录中发现同 ID 的不同内容或日期。为保护现有数据，本次导入已停止。';
        return result;
      }
      const existing = logsByDate.get(record.date);
      if (!existing) result.additions.dailyLogs.push(record);
      else if (recordsMatch(existing, record)) result.duplicates += 1;
      else { result.error = `每日记录 ${record.date} 在现有数据和备份中内容不同。为避免覆盖，请先手动保留或选择一份。`; return result; }
    }
    const existingHabits = new Map(merged.habits.map((habit) => [habit.id, habit]));
    for (const habit of backupValue.habits) {
      const existing = existingHabits.get(habit.id);
      if (!existing) result.additions.habits.push(habit);
      else if (existing.name !== habit.name) {
        result.error = '习惯记录中发现同 ID 的不同名称。为保护现有数据，本次导入已停止。';
        return result;
      } else {
        const mergedDates = new Set([...existing.checkedDates, ...habit.checkedDates]);
        result.newCheckins += [...mergedDates].length - existing.checkedDates.length;
        existing.checkedDates = [...mergedDates].sort();
        result.duplicates += 1;
      }
    }
    merged.diary.push(...result.additions.diary);
    merged.habits.push(...result.additions.habits);
    merged.goals.push(...result.additions.goals);
    merged.dailyLogs = currentLogs.concat(result.additions.dailyLogs);
    const mergedError = validatePersonalData(merged);
    if (mergedError) { result.error = '合并后的个人数据无效，已停止导入：' + mergedError; return result; }
    result.merged = merged;
    return result;
  }

  function analyzeCompleteMerge(currentData, currentPersonal, backup) {
    const dataMerge = analyzeMerge(currentData, backup.data);
    const incomingPersonal = backup.personal || blankPersonalData();
    if (!Array.isArray(incomingPersonal.dailyLogs)) incomingPersonal.dailyLogs = [];
    const personalMerge = analyzePersonalMerge(currentPersonal, incomingPersonal);
    const storedCategories = readStoredCategories(true);
    const categoryMerge = storedCategories.error ? { error: storedCategories.error, merged: null, duplicates: 0, additions: { categories: [], assignments: [] } }
      : window.LifeCategories.safeMerge(storedCategories.data, backup.financeCategories || { categories: [], assignments: [] });
    const referenceError = !categoryMerge.error && categoryMerge.merged
      ? window.LifeCategories.validate(categoryMerge.merged, currentData.finances.concat(dataMerge.additions.finances)) : '';
    const storedTags = readNoteTags();
    const tagMerge = storedTags.error ? { error: storedTags.error, merged: null } : window.LifeContent.merge(storedTags.data, backup.noteTags || window.LifeContent.blank());
    const tagReferenceError = !tagMerge.error && personalMerge.merged ? window.LifeContent.validate(tagMerge.merged, personalMerge.merged.diary) : '';
    const storedMeta = readFinanceMeta(storedCategories.data);
    const metaMerge = storedMeta.error ? { error: storedMeta.error, merged: null } : window.LifeFinanceMeta.merge(storedMeta.data, backup.financeMeta || window.LifeFinanceMeta.blank(), categoryMerge.merged || storedCategories.data, window.LifeIcons.names);
    const storedSchedule = window.LifeSchedule.read(localStorage, currentData.tasks);
    const scheduleMerge = storedSchedule.error ? { error: storedSchedule.error, merged: null }
      : window.LifeSchedule.merge(storedSchedule.data, backup.scheduleMeta || window.LifeSchedule.blank(), currentData.tasks.concat(dataMerge.additions.tasks));
    const mergedCore = Object.fromEntries(['studies','finances','tasks'].map(name => [name, currentData[name].concat(dataMerge.additions[name])]));
    const storedLearning = window.LifeLearning.read(localStorage, currentData);
    const learningMerge = storedLearning.error ? { error:storedLearning.error } : window.LifeLearning.merge(storedLearning.data, backup.learningMeta || window.LifeLearning.blank(), mergedCore);
    const storedIdeas=window.LifeIdeasRich.read(currentPersonal.diary);
    const ideasMerge=storedIdeas.error?{error:storedIdeas.error}:window.LifeIdeasRich.merge(storedIdeas.data,backup.ideasMeta||window.LifeIdeasRich.blank(),personalMerge.merged?.diary||currentPersonal.diary);
    const storedHealth=backup.schemaVersion>=10?window.LifeHealth.read(localStorage):null;
    const healthMerge=storedHealth?(storedHealth.error?{error:storedHealth.error}:window.LifeHealth.merge(storedHealth.data,backup.health)):{error:'',merged:null,additions:[],duplicates:0};
    const storedNotes=backup.schemaVersion===11?window.LifeNotes.read(localStorage):null;
    const notesMerge=storedNotes?(storedNotes.error?{error:storedNotes.error}:window.LifeNotes.merge(storedNotes.data,backup.notes)):{error:'',merged:null,additions:[],duplicates:0};
    return {
      notes:notesMerge,
      health:healthMerge,
      error: notesMerge.error || healthMerge.error || storedIdeas.error || ideasMerge.error || storedLearning.error || learningMerge.conflicts?.join('；') || dataMerge.error || personalMerge.error || categoryMerge.error || referenceError || tagMerge.error || tagReferenceError || metaMerge.error || scheduleMerge.error,
      duplicates: dataMerge.duplicates + personalMerge.duplicates + categoryMerge.duplicates,
      additions: dataMerge.additions, personal: personalMerge, categories: categoryMerge, noteTags: tagMerge, financeMeta: metaMerge, scheduleMeta: scheduleMerge, learningMeta:learningMerge,ideasMeta:ideasMerge,
    };
  }

  function setBackupStatus(message, kind = '') {
    const status = $('#backup-status');
    status.textContent = message;
    status.classList.remove('is-error', 'is-success');
    if (kind) status.classList.add(`is-${kind}`);
    if (kind === 'success') toast(message.startsWith('导入成功') ? '备份已恢复' : '备份已生成');
  }

  function showBackupPreview(fileName, backup, analysis) {
    $('#backup-preview').classList.remove('hidden');
    $('#backup-file-name').textContent = fileName;
    const meta = backup.financeMeta;
    $('#backup-meta-summary').textContent = meta ? '财务扩展：分类图标 ' + meta.categoryIcons.length + ' 项 · 预算 ' + meta.budgets.length + ' 项 · 资产/负债账户 ' + meta.accounts.length + ' 项（含归档）。' : '旧版备份：现有分类图标、预算与账户会保留。';
    $('#backup-learning-summary').textContent = backup.learningMeta ? '学习扩展：目标 ' + backup.learningMeta.dailyGoals.length + ' 项 · 计划关联 ' + backup.learningMeta.plans.length + ' 项 · 计时 ' + backup.learningMeta.focusSessions.length + ' 次。运行计时以暂停副本恢复，需手动继续；冲突停止。' : '此版本不含学习扩展；当前目标、计划与计时将保留。完整备份请选择 v11。';
    $('#backup-schedule-summary').textContent = backup.scheduleMeta ? '日程扩展：备注/优先级/截止日 ' + backup.scheduleMeta.taskDetails.length + ' 条 · 重复规则 ' + backup.scheduleMeta.series.length + ' 项 · 实例标记 ' + backup.scheduleMeta.occurrences.length + ' 条；冲突停止。' : '此备份不含日程扩展；现有规则、备注与实例标记会保留。';
    $('#backup-ideas-summary').textContent=backup.schemaVersion>=9?'妙想：格式副本 '+backup.ideasMeta.documents.length+' 条 · 图片 '+backup.ideasAttachments.length+' 张 · 未保存草稿 '+(backup.ideasDraft?'1 份':'0 份')+'。冲突停止，不覆盖。':'此版本不含妙想格式、图片与持久草稿；当前扩展会保留。完整备份请选择 v11。';
    if(!$('#backup-health-summary')){const row=document.createElement('p');row.id='backup-health-summary';row.className='subtle-copy';$('#backup-ideas-summary').after(row);}
    if(!$('#backup-notes-summary')){const row=document.createElement('p');row.id='backup-notes-summary';row.className='subtle-copy';$('#backup-health-summary').after(row);}
    $('#backup-notes-summary').textContent=backup.schemaVersion===11?'笔记：'+backup.notes.notes.length+' 条；新增 '+(analysis.notes.additions?.length||0)+'，重复 '+(analysis.notes.duplicates||0)+'。只恢复本地内容/缓存，不执行Notion写入；冲突停止。':'此版本不含独立笔记，现有笔记存储不变。完整备份请选择v11。';
    $('#backup-health-summary').textContent=backup.schemaVersion>=10?'健康：'+backup.health.records.length+' 条；新增 '+(analysis.health.additions?.length||0)+' 条，重复跳过 '+(analysis.health.duplicates||0)+' 条；来源 '+[...new Set(backup.health.records.map(row=>row.source.name))].join('、')+'。同ID或测量身份冲突停止。':'此版本不含健康数据；现有健康存储不会改动。完整备份请选择 v11。';
    $('#backup-study-count').textContent = backup.data.studies.length;
    $('#backup-finance-count').textContent = backup.data.finances.length;
    $('#backup-task-count').textContent = backup.data.tasks.length;
    $('#backup-diary-count').textContent = backup.personal.diary.length;
    $('#backup-habit-count').textContent = backup.personal.habits.length;
    $('#backup-goal-count').textContent = backup.personal.goals.length;
    $('#backup-daily-count').textContent = backup.personal.dailyLogs?.length || 0;
    $('#backup-duplicate-count').textContent = analysis.duplicates;
    $('#backup-category-count').textContent = backup.financeCategories?.categories.length || 0;
    $('#backup-assignment-count').textContent = backup.financeCategories?.assignments.length || 0;
    $('#backup-format-label').textContent = 'JSON · v' + backup.schemaVersion;
    const personalAdditions = analysis.personal.additions;
    const newCheckins = analysis.personal.newCheckins;
    $('#backup-import-plan').textContent = `确认后将新增学习 ${analysis.additions.studies.length} 条、收支 ${analysis.additions.finances.length} 条、任务 ${analysis.additions.tasks.length} 条、每日记录 ${personalAdditions.dailyLogs.length} 条、妙想 ${personalAdditions.diary.length} 条、习惯 ${personalAdditions.habits.length} 项、长期目标 ${personalAdditions.goals.length} 个；补充 ${newCheckins} 次新打卡；相同记录跳过 ${analysis.duplicates} 条。个人资料空项会补入，技能进度取较高值。`;
    $('#backup-import-plan').textContent += ' 分类新增 ' + analysis.categories.additions.categories.length + ' 项，账单分类关联新增 ' + analysis.categories.additions.assignments.length + ' 项；历史未分类账单不会被自动分类。';
    $('#backup-import-plan').textContent += ' 妙想标签关联 ' + (backup.noteTags?.assignments.length || 0) + ' 条，将按并集合并，不覆盖原标签。';
    $('#backup-exported-at').textContent = `备份生成时间：${new Date(backup.exportedAt).toLocaleString('zh-CN')}`;
    const conflict = $('#backup-conflict');
    conflict.textContent = analysis.error;
    conflict.classList.toggle('hidden', !analysis.error);
    $('#backup-import-confirm').disabled = Boolean(analysis.error);
    pendingBackup = analysis.error ? null : backup;
    $('#backup-preview').dataset.fileName = fileName;
  }

  function applyBackupSettings(settings) {
    learningViewDate = scheduleViewDate = settings.selectedDate;
    $('#selected-date').value = settings.selectedDate;
    $('#study-date').value = settings.selectedDate;
    $('#finance-date').value = settings.selectedDate;
    $('#task-date').value = settings.selectedDate;
    $('#personal-date').value = settings.personalDate || settings.selectedDate;
    $('#diary-date').value = settings.personalDate || settings.selectedDate;
    const yearSelect = $('#month-year');
    if (![...yearSelect.options].some((option) => option.value === settings.monthYear)) {
      const option = document.createElement('option');
      option.value = settings.monthYear;
      option.textContent = `${settings.monthYear} 年`;
      yearSelect.append(option);
    }
    yearSelect.value = settings.monthYear;
    $('#month-month').value = settings.monthMonth;
    $('#finance-period').value = settings.financePeriod || settings.selectedDate.slice(0, 7);
    $('#finance-history-anchor').value = $('#finance-period').value + '-01';
    insightsPeriod = settings.insightsPeriod || 'month';
    $('#insights-anchor').value = settings.insightsAnchor || settings.selectedDate;
  }

  async function exportBackup(full = false) {
    const button=full===11?$('#backup-export-notes'):full===10?$('#backup-export-health'):full===9?$('#backup-export-ideas'):null;if(button?.disabled)return;if(button)button.disabled=true;
    try {
    const exportSnapshot=Object.fromEntries([STORAGE_KEY,PERSONAL_STORAGE_KEY,CATEGORY_STORAGE_KEY,NOTE_TAGS_KEY,window.LifeFinanceMeta.key,window.LifeSchedule.key,window.LifeLearning.key,window.LifeIdeasRich.key,...(full>=10?[window.LifeHealth.key]:[]),...(full===11?[window.LifeNotes.key]:[])].map(k=>[k,localStorage.getItem(k)]));
    const version = full === 11 ? 11 : full === 10 ? 10 : full === 9 ? 9 : full === 8 ? 8 : full === 7 ? 7 : full ? 6 : 5;
    const stored = readStoredDataForBackup();
    if (stored.error) { setBackupStatus(stored.error, 'error'); return; }
    const storedPersonal = readStoredPersonalForBackup();
    if (storedPersonal.error) { setBackupStatus(storedPersonal.error, 'error'); return; }
    const storedCategories = readStoredCategories();
    if (storedCategories.error) { setBackupStatus(storedCategories.error, 'error'); return; }
    const categoryValidation = window.LifeCategories.validate(storedCategories.data, stored.data.finances);
    if (categoryValidation) { setBackupStatus(categoryValidation, 'error'); return; }
    const storedTags = readNoteTags();
    const tagValidation = storedTags.error || window.LifeContent.validate(storedTags.data, storedPersonal.data.diary);
    if (tagValidation) { setBackupStatus(tagValidation, 'error'); return; }
    const backup = {
      noteTags: storedTags.data,
      format: BACKUP_FORMAT,
      schemaVersion: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      data: stored.data,
      personal: storedPersonal.data,
      financeCategories: storedCategories.data,
      settings: {
        selectedDate: $('#selected-date').value || today(),
        monthYear: $('#month-year').value,
        monthMonth: $('#month-month').value,
        personalDate: $('#personal-date').value || today(),
        financePeriod: $('#finance-period').value || today().slice(0, 7),
        insightsPeriod,
        insightsAnchor: $('#insights-anchor').value || today(),
      },
    };
    const storedMeta = readFinanceMeta(storedCategories.data);
    if (full) {
      if (storedMeta.error) { setBackupStatus(storedMeta.error, 'error'); return; }
      backup.schemaVersion = 6; backup.financeMeta = storedMeta.data;
    }
    if (version >= 7) {
      const storedSchedule = window.LifeSchedule.read(localStorage, stored.data.tasks);
      if (storedSchedule.error) { setBackupStatus(storedSchedule.error, 'error'); return; }
      backup.schemaVersion = 7; backup.scheduleMeta = storedSchedule.data;
    }
    if (version >= 8) {
      const storedLearning = window.LifeLearning.read(localStorage, stored.data);
      if (storedLearning.error) { setBackupStatus(storedLearning.error,'error'); return; }
      const frozen = window.LifeLearning.freeze(storedLearning.data, Date.parse(backup.exportedAt));
      if (frozen.error) { setBackupStatus(frozen.error,'error'); return; }
      backup.schemaVersion = 8; backup.learningMeta = frozen.data;
    }
    if(version>=9){
      const rich=window.LifeIdeasRich.read(backup.personal.diary);if(rich.error)throw new Error(rich.error);
      backup.ideasMeta={version:1,documents:rich.data.documents.filter(d=>backup.personal.diary.some(n=>n.id===d.recordId))};
      Object.assign(backup,await window.LifeIdeasRich.exportMedia(backup.ideasMeta));backup.schemaVersion=version;
      if(version>=10){const health=window.LifeHealth.read(localStorage);if(health.error)throw new Error(health.error);backup.health=health.data;}
      if(version===11){const notes=window.LifeNotes.read(localStorage);if(notes.error)throw new Error(notes.error);backup.notes=window.LifeNotes.exportData(notes.data);}
      await decodeRichBackup(backup);
      if(Object.entries(exportSnapshot).some(([k,v])=>localStorage.getItem(k)!==v))throw new Error('导出期间数据发生变化，请重新导出以获得一致副本。');
    }
    const validation = validateBackup(backup);
    if (validation) { setBackupStatus(validation,'error'); return; }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
    if(version===9&&blob.size>40*1024*1024)throw new Error('完整v9超过40MB，未生成截断备份。原数据保留。');
    if(version===10&&blob.size>45*1024*1024)throw new Error('兼容v10超过45MiB，未生成截断备份。原数据保留。');
    if(version===11&&blob.size>50*1024*1024)throw new Error('完整v11超过50MiB，未生成截断备份。原数据保留。');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const backupStamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `我的生活管理台-v${backup.schemaVersion}-备份-${today()}-${backupStamp}-${makeId().slice(-6)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const coverage=version===11?'完整 v11：含独立笔记 '+backup.notes.notes.length+' 条、健康及原v10全部内容；恢复不写入Notion。':version===10?'兼容 v10（不含独立笔记）：含健康 '+backup.health.records.length+' 条、妙想图片/草稿及原全部数据。':version===9?'兼容 v9：含原生活数据及妙想扩展，不含健康。':'兼容 v'+version+'：不含健康，部分扩展不包含；完整备份请选择 v11。';
    setBackupStatus(coverage+'运行计时仅在导出副本暂停。'+`已发起 JSON 下载：学习 ${backup.data.studies.length} 条、收支 ${backup.data.finances.length} 条、任务 ${backup.data.tasks.length} 条，并包含每日记录及个人空间数据。请在浏览器下载列表确认文件保存完成。`, 'success');
    $('#backup-session-info').textContent = '本次会话最近发起导出：' + new Date(backup.exportedAt).toLocaleString('zh-CN') + ' · JSON v' + backup.schemaVersion + '。这不是已验证的最近备份时间；刷新后不保留此提示。';
    } catch(error) { setBackupStatus('导出失败：'+error.message,'error'); } finally {if(button)button.disabled=false;}
  }

  async function inspectBackupFile(file) {
    pendingBackup = null;
    $('#backup-preview').classList.add('hidden');
    setBackupStatus('');
    if (!file) return;
    if (file.size > 50*1024*1024) { setBackupStatus('文件超过50MiB，已拒绝读取。','error'); return; }
    window.LifeUI.setBusy($('#backup-choose'), true);
    try {
      const backup = JSON.parse(await file.text());
      if(backup.schemaVersion<9&&file.size>MAX_BACKUP_BYTES){setBackupStatus('旧版备份不能超过10MB。','error');return;}
      if(backup.schemaVersion===10&&file.size>45*1024*1024){setBackupStatus('兼容v10不能超过45MiB。','error');return;}
      if(backup.schemaVersion===9&&file.size>40*1024*1024){setBackupStatus('兼容v9不能超过40MiB。','error');return;}
      const error = validateBackup(backup);
      if (error) { setBackupStatus(`备份文件无效：${error}`, 'error'); return; }
      if (backup.schemaVersion === 1) {
        backup.personal = blankPersonalData();
        backup.settings.personalDate = backup.settings.selectedDate;
      } else if (!Array.isArray(backup.personal.dailyLogs)) backup.personal.dailyLogs = [];
      if (backup.schemaVersion < 4) backup.financeCategories = { categories: [], assignments: [] };
      if (backup.schemaVersion < 5) backup.noteTags = window.LifeContent.blank();
      const stored = readStoredDataForBackup();
      if (stored.error) { setBackupStatus(stored.error, 'error'); return; }
      const storedPersonal = readStoredPersonalForBackup();
      if (storedPersonal.error) { setBackupStatus(storedPersonal.error, 'error'); return; }
      if(backup.schemaVersion>=9){const decoded=await decodeRichBackup(backup);await window.LifeIdeasRich.mediaConflict(decoded);}
      const analysis = analyzeCompleteMerge(stored.data, storedPersonal.data, backup);
      showBackupPreview(file.name, backup, analysis);
      if (analysis.error) setBackupStatus(analysis.error, 'error');
      else setBackupStatus('文件格式和内容有效。请核对上方摘要，再决定是否合并导入。');
    } catch (error) {
      setBackupStatus('无法读取备份：'+error.message,'error');
    } finally {
      window.LifeUI.setBusy($('#backup-choose'), false);
    }
  }

  async function confirmBackupImport() {
    if (!pendingBackup) return;
    const importCandidate=pendingBackup;
    if (!await confirmAction('将按预览摘要安全合并备份；相同记录会跳过，冲突记录不会覆盖。', '确认恢复备份', '确认合并')) return;
    if (pendingBackup!==importCandidate) {setBackupStatus('预览文件已改变，请重新核对摘要后确认。','error');return;}
    const importSnapshot=Object.fromEntries([STORAGE_KEY,PERSONAL_STORAGE_KEY,CATEGORY_STORAGE_KEY,NOTE_TAGS_KEY,window.LifeFinanceMeta.key,window.LifeSchedule.key,window.LifeLearning.key,window.LifeIdeasRich.key,...(importCandidate.schemaVersion>=10?[window.LifeHealth.key]:[]),...(importCandidate.schemaVersion===11?[window.LifeNotes.key]:[])].map(k=>[k,localStorage.getItem(k)]));
    const stored = readStoredDataForBackup(), storedPersonal = readStoredPersonalForBackup();
    if (stored.error || storedPersonal.error) { setBackupStatus(stored.error || storedPersonal.error, 'error'); return; }
    const analysis = analyzeCompleteMerge(stored.data, storedPersonal.data, importCandidate);
    if (analysis.error) {
      $('#backup-conflict').textContent = analysis.error;
      $('#backup-conflict').classList.remove('hidden');
      $('#backup-import-confirm').disabled = true;
      pendingBackup = null;
      setBackupStatus(analysis.error, 'error'); return;
    }
    const nextData = {
      studies: stored.data.studies.concat(analysis.additions.studies),
      finances: stored.data.finances.concat(analysis.additions.finances),
      tasks: stored.data.tasks.concat(analysis.additions.tasks),
    };
    const nextPersonal = analysis.personal.merged;
    const nextCategories = analysis.categories.merged;
    const entries = [[PERSONAL_STORAGE_KEY, nextPersonal], [STORAGE_KEY, nextData]];
    const keepCategoryStore = nextCategories.categories.length || nextCategories.assignments.length || localStorage.getItem(CATEGORY_STORAGE_KEY) !== null;
    if (keepCategoryStore) entries.push([CATEGORY_STORAGE_KEY, nextCategories]);
    const keepTags = analysis.noteTags.merged.assignments.length || localStorage.getItem(NOTE_TAGS_KEY) !== null;
    if (keepTags) entries.push([NOTE_TAGS_KEY, analysis.noteTags.merged]);
    const keepMeta = window.LifeFinanceMeta.hasData(analysis.financeMeta.merged) || localStorage.getItem(window.LifeFinanceMeta.key) !== null;
    if (keepMeta) entries.push([window.LifeFinanceMeta.key, analysis.financeMeta.merged]);
    const keepSchedule = window.LifeSchedule.hasData(analysis.scheduleMeta.merged) || localStorage.getItem(window.LifeSchedule.key) !== null;
    if (keepSchedule) entries.push([window.LifeSchedule.key, analysis.scheduleMeta.merged]);
    const keepLearning = window.LifeLearning.hasData(analysis.learningMeta.merged) || localStorage.getItem(window.LifeLearning.key) !== null;
    if (keepLearning) entries.push([window.LifeLearning.key,analysis.learningMeta.merged]);
    if(analysis.ideasMeta.merged.documents.length||localStorage.getItem(window.LifeIdeasRich.key)!==null)entries.push([window.LifeIdeasRich.key,analysis.ideasMeta.merged]);
    if(importCandidate.schemaVersion>=10&&(analysis.health.merged.records.length||localStorage.getItem(window.LifeHealth.key)!==null)){
      if(analysis.health.additions.length)analysis.health.merged.lastImportAt=Date.now();
      entries.push([window.LifeHealth.key,analysis.health.merged]);
    }
    if(importCandidate.schemaVersion===11&&(analysis.notes.merged.notes.length||localStorage.getItem(window.LifeNotes.key)!==null))entries.push([window.LifeNotes.key,analysis.notes.merged]);
    $('#backup-import-confirm').disabled=true;
    $('#backup-choose').disabled=true;$('#backup-file').disabled=true;
    let importWarning='';
    try{
      if(importCandidate.schemaVersion>=9){const decoded=await decodeRichBackup(importCandidate);await window.LifeIdeasRich.mediaConflict(decoded);const draftExpected=JSON.stringify(await window.LifeIdeasRich.get('drafts','current')||null);const result=await window.LifeIdeasRich.commit(entries,writeStoreTransaction,{expected:importSnapshot,assets:decoded.assets,draft:decoded.draft,draftExpected});importWarning=result.warning;}
      else{const error=writeStoreTransaction(entries);if(error)throw new Error(error);}
    }catch(error){setBackupStatus('恢复未完成：'+error.message,'error');$('#backup-import-confirm').disabled=false;return;}
    finally{$('#backup-choose').disabled=false;$('#backup-file').disabled=false;}
    learningMeta = analysis.learningMeta.merged; learningMetaError = '';
    financeMeta = analysis.financeMeta.merged; financeMetaError = '';
    scheduleMeta = analysis.scheduleMeta.merged; scheduleMetaError = '';
    noteTags = analysis.noteTags.merged;
    noteTagsError = '';
    data = nextData; personalData = nextPersonal;
    categoryData = keepCategoryStore ? nextCategories : window.LifeCategories.blank();
    dataError = personalDataError = categoryError = '';
    const imported = importCandidate;
    const added = Object.values(analysis.additions).reduce((sum, list) => sum + list.length, 0);
    const personalAdded = Object.values(analysis.personal.additions).reduce((sum, list) => sum + list.length, 0);
    const categoryAdded = analysis.categories.additions.categories.length;
    populateMonthYears();
    applyBackupSettings(imported.settings);
    fillDailyRecordForm(imported.settings.selectedDate);
    render(); renderBillCategories();
    pendingBackup = null;
    $('#backup-preview').classList.add('hidden');
    $('#backup-file').value = '';
    setBackupStatus('导入成功：新增 ' + (added + personalAdded) + ' 条记录、' + categoryAdded + ' 项分类，补充 ' + analysis.personal.newCheckins + ' 次打卡，跳过 ' + analysis.duplicates + ' 项相同数据。现有记录与历史分类均保留。', 'success');
    if(importWarning)setBackupStatus('主要记录已合并，附加恢复尚未完成：'+importWarning,'error');
  }

  function renderStudies(items) {
    const body = $('#study-table');
    body.innerHTML = items.map((item) => `
      <tr><td><a class="cell-main" href="#entry/study/${encodeURIComponent(item.id)}" data-open-page>${escapeHtml(item.content)}</a><span class="cell-sub">${escapeHtml(item.date)}</span></td>
      <td data-label="时长">${Number(item.duration)} 分钟</td><td><div class="record-row-actions"><button type="button" class="icon-button" data-edit-study="${escapeHtml(item.id)}" aria-label="编辑学习记录">编辑</button><button type="button" class="icon-button delete-button" data-delete-study="${escapeHtml(item.id)}" aria-label="删除学习记录">删除</button></div></td></tr>`).join('');
    $('#study-empty').classList.toggle('hidden', items.length > 0);
  }

  function renderFinances(items) {
    $('#finance-table').innerHTML = window.LifeFinanceLedger.markup(items, {
      allRecords:data.finances,categories:categoryData,query:$('#finance-history-search').value,
      money,iconFor:window.LifeFinanceViews.categoryIcon,
    });
    $('#finance-empty').classList.toggle('hidden', items.length > 0);
  }

  function renderHistory(type) {
    const prefix = `#${type}-history-`;
    const range = $(`${prefix}range`).value;
    $(`${prefix}dates`).classList.toggle('hidden', range !== 'custom');
    const result = window.LifeHistory.select(type === 'study' ? data.studies : data.finances, {
      type, anchor: type === 'finance' ? ($('#finance-history-anchor').value || today()) : learningDate(), range, start: $(`${prefix}start`).value,
      end: $(`${prefix}end`).value, query: $(`${prefix}search`).value, page: historyPages[type],
      paginate: type !== 'finance',
    });
    historyPages[type] = result.page;
    if (type === 'study') renderStudies(result.items);
    else renderFinances(result.items);
    $(`#${type}-count`).textContent = countLabel(result.count, '条记录');
    const status = $(`${prefix}summary`);
    status.classList.toggle('is-error', Boolean(result.error));
    const searchLabel = $(`${prefix}search`).value.trim() ? ' · 含关键词筛选' : '';
    if (type === 'finance') {
      $('#finance .table-panel .panel-heading p').textContent = result.error || result.label + searchLabel;
      $('#finance').classList.toggle('is-filtered', range !== 'month' || Boolean(searchLabel) || Boolean(result.error));
    }
    const summary = type === 'study'
      ? `学习合计 ${result.totals.minutes} 分钟`
      : `收入 ${money(result.totals.income / 100)} · 支出 ${money(result.totals.expense / 100)} · 差额 ${money((result.totals.income - result.totals.expense) / 100)}`;
    status.textContent = result.error || `${result.label}${searchLabel} · 共 ${result.count} 条 · ${summary}`;
    if (type === 'study') {
      $(`${prefix}page`).textContent = result.count ? `第 ${result.page} / ${result.pages} 页` : '暂无记录';
      $(`${prefix}prev`).disabled = result.page <= 1 || Boolean(result.error);
      $(`${prefix}next`).disabled = result.page >= result.pages || Boolean(result.error);
    }
  }

  function bindHistoryControls(type) {
    const prefix = `#${type}-history-`;
    for (const field of ['range', 'start', 'end', 'search']) {
      $(`${prefix}${field}`).addEventListener(field === 'search' ? 'input' : 'change', () => {
        if (field === 'range' && $(`${prefix}range`).value === 'custom') {
          if (!$(`${prefix}start`).value) $(`${prefix}start`).value = type === 'study' ? learningDate() : selectedDate();
          if (!$(`${prefix}end`).value) $(`${prefix}end`).value = type === 'study' ? learningDate() : selectedDate();
        }
        historyPages[type] = 1;
        renderHistory(type);
      });
    }
    $(`${prefix}reset`).addEventListener('click', () => {
      $(`${prefix}range`).value = type === 'finance' ? 'month' : 'selected';
      for (const field of ['start', 'end', 'search']) $(`${prefix}${field}`).value = '';
      historyPages[type] = 1;
      renderHistory(type);
    });
    for (const [action, offset] of type === 'study' ? [['prev', -1], ['next', 1]] : []) {
      $(`${prefix}${action}`).addEventListener('click', () => {
        historyPages[type] += offset;
        renderHistory(type);
        $(`#${type}-table`).closest('.table-wrap').scrollTop = 0;
      });
    }
  }

  function renderTasks(items) {
    window.LifeScheduleUI.render(items, data.tasks, scheduleMeta, scheduleDate());
  }

  const compareTaskOrder = (a, b) => (a.start || '99:99').localeCompare(b.start || '99:99') || a.createdAt - b.createdAt;
  function taskIdFromRoute(route = window.location.hash) {
    const match = /^#task\/(.+)$/.exec(route || '');
    if (!match) return '';
    try { return decodeURIComponent(match[1]); } catch (error) { return ''; }
  }
  const isTaskDetailRoute = (route) => /^#task\//.test(route || '');

  function taskNavigationState() {
    return history.state?.taskNavigation || activeTaskNavigation;
  }

  function openTaskDetail(taskId) {
    data = loadData();
    if (dataError) { toast(dataError, true); return; }
    if (!data.tasks.some((task) => task.id === taskId)) return;
    const currentRoute = window.location.hash || '#overview';
    const returnRoute = ['#tasks', '#overview', '#search', '#learning'].includes(currentRoute) ? currentRoute : '#tasks';
    const sourceSelector = returnRoute === '#search' ? '#global-results' : returnRoute === '#learning' ? '#learning-plan-list' : '#task-list';
    let taskIds = [...document.querySelectorAll(`${sourceSelector} [data-open-task]`)]
      .map((link) => link.dataset.openTask)
      .filter((id) => data.tasks.some((task) => task.id === id));
    if (!taskIds.includes(taskId)) {
      const sourceDate = returnRoute === '#tasks' ? scheduleDate() : returnRoute === '#learning' ? learningDate() : selectedDate();
      taskIds = data.tasks.filter((task) => task.date === sourceDate).slice().sort(compareTaskOrder).map((task) => task.id);
    }
    if (!taskIds.includes(taskId)) taskIds.push(taskId);
    const context = {
      returnRoute,
      scrollY: window.scrollY,
      selectedDate: selectedDate(),
      taskListScroll: $('#task-list').scrollTop,
      taskIds,
      viewSnapshot: captureUiView(),
    };
    const sourceState = history.state && typeof history.state === 'object' ? history.state : {};
    history.replaceState({ ...sourceState, viewSnapshot: context.viewSnapshot }, '', window.location.href);
    activeTaskNavigation = context;
    const nextUrl = `${window.location.pathname}${window.location.search}#task/${encodeURIComponent(taskId)}`;
    history.pushState({ ...(history.state && typeof history.state === 'object' ? history.state : {}), taskNavigation: context, uiDepth: (Number(history.state?.uiDepth) || 0) + 1 }, '', nextUrl);
    syncNavigation(window.location.hash);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function taskSequenceFor(taskId) {
    const context = taskNavigationState();
    let ids = Array.isArray(context?.taskIds)
      ? context.taskIds.filter((id) => data.tasks.some((task) => task.id === id))
      : data.tasks.slice().sort((a, b) => a.date.localeCompare(b.date) || compareTaskOrder(a, b)).map((task) => task.id);
    if (!ids.includes(taskId)) ids.push(taskId);
    return { ids, index: ids.indexOf(taskId) };
  }

  function renderTaskDetail(taskId) {
    const task = data.tasks.find((item) => item.id === taskId);
    if (!task) return false;
    const { ids, index } = taskSequenceFor(taskId);
    $('#task-detail-title').textContent = task.title;
    $('#task-detail-date').textContent = task.date;
    $('#task-detail-time').textContent = task.start || task.end ? `${task.start || '未设定'} – ${task.end || '未设定'}` : '未安排时间';
    $('#task-detail-status').textContent = task.completed ? '已完成' : '待完成';
    const details = window.LifeSchedule.detailFor(scheduleMeta, taskId);
    const source = scheduleMeta.occurrences.find(row => row.taskId === taskId && !row.excluded);
    $('#task-detail-extra').innerHTML = '<dl class="schedule-detail-meta"><div><dt>优先级</dt><dd>' + escapeHtml(window.LifeScheduleUI.priorityLabel(details.priority) || '未设置') + '</dd></div><div><dt>截止日期</dt><dd>' + escapeHtml(details.deadline || '未设置') + '</dd></div>'
      + (source ? '<div><dt>重复规则</dt><dd>' + escapeHtml(scheduleMeta.series.find(row => row.id === source.seriesId)?.title || '') + '</dd></div>' : '') + '</dl>'
      + (details.note ? '<h3>备注</h3><p class="schedule-detail-note">' + escapeHtml(details.note) + '</p>' : '')
      + (window.LifeSchedule.duration(task) ? '<p class="subtle-copy">计划 ' + window.LifeSchedule.duration(task) + ' 分钟；不代表实际学习或工作时长。</p>' : '');
    $('#task-detail-actions').innerHTML = '<label class="secondary-button schedule-complete-action"><input type="checkbox" data-toggle-task="' + escapeHtml(task.id) + '"' + (task.completed ? ' checked' : '') + '>已完成</label><button type="button" class="secondary-button" data-edit-task="' + escapeHtml(task.id) + '">编辑</button><button type="button" class="secondary-button delete-button" data-delete-task="' + escapeHtml(task.id) + '">删除</button>';
    if (learningMeta.plans.some(row=>row.taskId===taskId&&!row.archived)) {
      const start = document.createElement('button'); start.type='button'; start.className='secondary-button'; start.textContent='开始学习';
      start.addEventListener('click',()=>{openUiPage('#learning');window.LifeLearningUI.prepareFocus(taskId);}); $('#task-detail-actions').append(start);
    }
    $('#task-sequence').textContent = `${index + 1} / ${ids.length}`;
    $('#task-previous').disabled = index <= 0;
    $('#task-next').disabled = index < 0 || index >= ids.length - 1;
    return true;
  }

  function changeTaskBy(offset) {
    data = loadData();
    if (dataError) { toast(dataError, true); return; }
    const taskId = taskIdFromRoute();
    if (!taskId || !data.tasks.some((task) => task.id === taskId)) {
      routeToTaskList();
      return;
    }
    const { ids, index } = taskSequenceFor(taskId);
    const nextId = ids[index + offset];
    if (!nextId || !data.tasks.some((task) => task.id === nextId)) return;
    const nextUrl = `${window.location.pathname}${window.location.search}#task/${encodeURIComponent(nextId)}`;
    history.replaceState(history.state, '', nextUrl);
    syncNavigation(window.location.hash);
  }

  function routeToTaskList() {
    const nextUrl = `${window.location.pathname}${window.location.search}#tasks`;
    history.replaceState(null, '', nextUrl);
    activeTaskNavigation = null;
    syncNavigation('#tasks');
  }

  function returnFromTaskDetail() {
    const context = taskNavigationState();
    if (!context || !['#overview', '#tasks', '#search', '#learning'].includes(context.returnRoute)) {
      routeToTaskList();
      return;
    }
    activeTaskNavigation = context;
    history.back();
  }

  function restoreTaskSource(context) {
    data = loadData();
    if (!context.viewSnapshot && context.selectedDate && context.selectedDate !== selectedDate()) {
      $('#selected-date').value = context.selectedDate;
      if (!recordEditors.study && !otherDraftForms.has('study-form')) $('#study-date').value = context.selectedDate;
      if (!recordEditors.finance) $('#finance-date').value = context.selectedDate;
      $('#task-date').value = context.selectedDate;
      fillDailyRecordForm(context.selectedDate);
    }
    render();
    if (context.viewSnapshot) restoreUiView(context.viewSnapshot);
    setTimeout(() => requestAnimationFrame(() => {
      window.scrollTo({ top: Number(context.scrollY) || 0, behavior: 'auto' });
      $('#task-list').scrollTop = Number(context.taskListScroll) || 0;
    }), 50);
  }

  function setFormDates(date = today()) {
    $('#selected-date').value = date;
    $('#study-date').value = date;
    $('#finance-date').value = date;
    $('#task-date').value = date;
  }

  function resetTaskForm() {
    $('#task-form').reset();
    $('#task-id').value = '';
    $('#task-date').value = scheduleDate();
    taskEditExpected = null;
    $('#task-form-title').textContent = '添加日程';
    $('#task-priority').value = '';
    $('#task-deadline').value = '';
    $('#task-note').value = '';
    window.LifeScheduleUI.formStatus('');
    $('#task-submit').innerHTML = '添加任务 <span><span data-icon="add"></span></span>';
    $('#task-cancel').classList.remove('hidden');
    $('#task-cancel').textContent = '清空草稿';
  }

  function recordStatus(type, message, error = false) {
    const status = $(`#${type}-form-status`);
    status.textContent = message;
    status.classList.toggle('is-error', error);
  }

  function resetRecordForm(type) {
    recordEditors[type] = null;
    $(`#${type}-form`).reset();
    $(`#${type}-date`).value = type === 'study' ? learningDate() : selectedDate();
    $(`#${type}-form-title`).textContent = type === 'study' ? '添加学习记录' : '新增一笔收支';
    $(`#${type}-form-description`).textContent = type === 'study' ? '每次学习都可以单独记一条' : '这是独立流水，与今日记录编辑分开';
    $(`#${type}-submit`).innerHTML = type === 'study' ? '添加学习记录 <span><span data-icon="add"></span></span>' : '新增收支流水 <span><span data-icon="add"></span></span>';
    $(`#${type}-edit-cancel`).classList.add('hidden');
    if (type === 'study') $('#study-duration').min = '1';
    recordStatus(type, '');
  }

  function openLinkedDailyRecord(date) {
    activeDailyReturnRoute = window.location.hash || '#learning';
    $('#selected-date').value = date;
    if (!recordEditors.study && !otherDraftForms.has('study-form')) $('#study-date').value = date;
    if (!recordEditors.finance && !otherDraftForms.has('finance-form')) $('#finance-date').value = date;
    fillDailyRecordForm(date);
    if ($('#finance-editor').open) window.LifeUI.closeSheet($('#finance-editor'));
    openUiPage('#today-record');
    render();
    $('#daily-record-status').textContent = '这条明细来自今日记录。请在这里统一修改，保存后历史明细与统计会同步更新。';
    $('#daily-record-date').scrollIntoView({ block: 'center' });
    $('#daily-record-date').focus({ preventScroll: true });
  }

  function returnFromDailyRecord(afterSave) {
    const fallback = activeDailyReturnRoute || '#overview';
    activeDailyReturnRoute = null;
    if (afterSave) {
      $('#selected-date').value = $('#daily-record-date').value || today();
      render();
      toast('今天已保存，学习与收支已同步');
    }
    returnUiPage(fallback);
  }

  async function beginRecordEdit(type, id) {
    if (otherDraftForms.has(type + '-form') && !await confirmAction('放弃当前未保存内容并编辑这条记录？', '切换编辑', '放弃并打开')) return;
    otherDraftForms.delete(type + '-form');
    const stored = readStoredDataForBackup();
    const storedPersonal = readStoredPersonalForBackup();
    if (stored.error || storedPersonal.error) { recordStatus(type, stored.error || storedPersonal.error, true); return; }
    const record = stored.data[type === 'study' ? 'studies' : 'finances'].find((item) => item.id === id);
    if (!record) { recordStatus(type, '这条记录已不存在，请刷新历史列表。', true); return; }
    const linked = window.LifeRecordEditor.linkedLog(storedPersonal.data, type, id);
    if (linked) {
      data = stored.data; personalData = storedPersonal.data;
      openLinkedDailyRecord(linked.date);
      return;
    }
    recordEditors[type] = { id, expected: JSON.parse(JSON.stringify(record)) };
    $(`#${type}-date`).value = record.date;
    if (type === 'study') {
      window.LifeLearningUI.showRecords();
      $('#study-content').value = record.content;
      $('#study-duration').value = record.duration;
      $('#study-duration').min = record.duration === 0 ? '0' : '1';
    } else {
      $('#finance-income-input').value = record.income;
      $('#finance-expense-input').value = record.expense;
      $('#finance-note').value = record.note;
      fillFinanceCategoryEditor(record);
      recordEditors.finance.categoryAssignments = JSON.stringify(categoryData.assignments.filter((item) => item.recordId === record.id));
      $('#finance-editor').showModal();
    }
    $(`#${type}-form-title`).textContent = type === 'study' ? '编辑学习记录' : '编辑收支记录';
    $(`#${type}-form-description`).textContent = '正在修改原记录；保存后会更新对应日期的统计。';
    $(`#${type}-submit`).innerHTML = '保存修改 <span><span data-icon="check"></span></span>';
    $(`#${type}-edit-cancel`).classList.remove('hidden');
    recordStatus(type, '已载入原内容。取消编辑可返回新增。');
    const form = $(`#${type}-form`);
    form.scrollIntoView({ block: 'center', behavior: 'smooth' });
    $(`#${type}-date`).focus({ preventScroll: true });
  }

  function submitRecordForm(type) {
    const stored = readStoredDataForBackup();
    const storedPersonal = readStoredPersonalForBackup();
    if (stored.error || storedPersonal.error) { recordStatus(type, stored.error || storedPersonal.error, true); return; }
    const fields = type === 'study'
      ? { date: $('#study-date').value, content: $('#study-content').value, duration: $('#study-duration').value }
      : { date: $('#finance-date').value, income: $('#finance-income-input').value, expense: $('#finance-expense-input').value, note: $('#finance-note').value };
    const editor = recordEditors[type];
    const result = window.LifeRecordEditor.prepare(stored.data, storedPersonal.data, {
      type, id: editor?.id, expected: editor?.expected, fields, newId: makeId(), createdAt: Date.now(),
    });
    if (result.error) { recordStatus(type, result.error, true); return; }
    let nextCategories = categoryData;
    if (type === 'finance') {
      const storedCategories = readStoredCategories();
      if (storedCategories.error) { recordStatus(type, storedCategories.error, true); return; }
      if (editor?.categoryAssignments && editor.categoryAssignments !== JSON.stringify(storedCategories.data.assignments.filter((item) => item.recordId === editor.id))) { recordStatus(type, '账单分类已在其他页面发生变化，请重新打开后编辑。', true); return; }
      const assigned = assignRecordCategories(storedCategories.data, result.record, { income: $('#finance-income-category').value, expense: $('#finance-expense-category').value });
      if (assigned.error) { recordStatus(type, assigned.error, true); return; }
      const validation = window.LifeCategories.validate(assigned.data, result.data.finances);
      if (validation) { recordStatus(type, validation, true); return; }
      nextCategories = assigned.data;
    }
    const entries = [[STORAGE_KEY, result.data]];
    if (type === 'finance') entries.push([CATEGORY_STORAGE_KEY, nextCategories]);
    const saveError = writeStoreTransaction(entries);
    if (saveError) { recordStatus(type, saveError, true); return; }
    categoryData = nextCategories;
    data = result.data;
    personalData = storedPersonal.data;
    resetRecordForm(type);
    populateMonthYears();
    render();
    recordStatus(type, `${result.edited ? '修改已保存' : '记录已添加'} · ${result.record.date}。历史明细与统计已更新。`);
    if (type === 'study') toast(result.edited ? '学习修改已保存' : '学习记录已添加');
    if (type === 'finance') { window.LifeUI.closeSheet($('#finance-editor')); toast(result.edited ? '账单修改已保存' : '账单已添加'); }
  }

  $('#selected-date').addEventListener('change', (event) => {
    historyPages.study = historyPages.finance = 1;
    const date = event.target.value || today();
    if (!recordEditors.finance) $('#finance-date').value = date;
    fillDailyRecordForm(date);
    render();
    rememberView();
  });

  $('#month-year').addEventListener('change', renderMonthly);
  bindHistoryControls('study');
  bindHistoryControls('finance');
  $('#month-month').addEventListener('change', renderMonthly);
  $('#personal-date').addEventListener('change', (event) => {
    if (!noteEdit && !noteFormChanged) $('#diary-date').value = event.target.value;
    renderDiary();
    renderHabits();
  });
  $('#diary-date').addEventListener('change', (event) => {
    $('#personal-date').value = event.target.value;
    renderDiary();
    renderHabits();
  });
  $('#personal-settings-toggle').addEventListener('click', openPersonalProfile);
  $('#personal-settings').addEventListener('close', () => {
    if (profileReturnFocus?.isConnected && profileReturnFocus.getClientRects().length) profileReturnFocus.focus({preventScroll:true});
    profileReturnFocus = null;
  });
  $('#personal-settings').addEventListener('cancel', () => {
    if (otherDraftForms.has('personal-settings-form')) toast('资料草稿已保留，再次编辑可继续');
  });
  $('#personal-settings').addEventListener('keydown', event => {
    if(event.key!=='Tab')return;
    const controls=[...$('#personal-settings').querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')].filter(node=>node.getClientRects().length);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  $('#personal-settings-cancel').addEventListener('click', () => {
    otherDraftForms.delete('personal-settings-form'); fillPersonalSettingsForm(); profileStatus('');
    window.LifeUI.closeSheet($('#personal-settings'));
  });
  $('#personal-settings-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (profileSavePending) return;
    profileSavePending = true; window.LifeUI.setBusy($('#personal-profile-save'), true);
    try {
      const next = clonePersonalData();
      next.profile = { nickname:$('#profile-nickname-input').value.trim(), identity:$('#profile-identity-input').value.trim(),
        goal:$('#profile-goal-input').value.trim(), motto:$('#profile-motto-input').value.trim() };
      const target = $('#wealth-target-input').value; next.wealthTarget = target ? Number(target) : null;
      const error = validatePersonalData(next);
      if (error) { profileStatus(error, true); return; }
      if (commitPersonalData(next)) {
        otherDraftForms.delete('personal-settings-form'); profileStatus('资料已保存'); render();
        window.LifeUI.closeSheet($('#personal-settings')); toast('个人资料已保存 · 仅此浏览器');
      } else profileStatus('未能保存。请检查浏览器存储空间或其他页面的更新；输入仍保留，可核对后重试。', true);
    } finally {
      queueMicrotask(() => { profileSavePending = false; window.LifeUI.setBusy($('#personal-profile-save'), false); });
    }
  });

  $('#daily-record-date').addEventListener('change', (event) => fillDailyRecordForm(event.target.value || selectedDate()));
  $('#daily-record-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const saveButton = $('#daily-record-submit');
    if (saveButton.disabled) return;
    saveButton.disabled = true;
    saveButton.setAttribute('aria-busy', 'true');
    try {
      const currentStored = readStoredDataForBackup(), currentPersonal = readStoredPersonalForBackup();
      if (currentStored.error || currentPersonal.error) { $('#daily-record-status').textContent = currentStored.error || currentPersonal.error; return; }
      const date = $('#daily-record-date').value;
      if (dailyEditSnapshot !== dailyRecordSnapshot(date, currentStored.data, currentPersonal.data)) {
        $('#daily-record-status').textContent = '这一天的记录已在另一页面更新，已停止保存，当前输入仍保留。请先复制需要保留的内容，再刷新并重新编辑最新记录。';
        return;
      }
      data = currentStored.data;
      personalData = currentPersonal.data;
      if (personalDataError) { $('#daily-record-status').textContent = personalDataError; return; }
      const studyRaw = $('#daily-study-minutes').value.trim();
      const incomeRaw = $('#daily-income').value.trim();
      const expenseRaw = $('#daily-expense').value.trim();
      const requestedStudyMinutes = studyRaw === '' ? null : Number(studyRaw);
      const income = incomeRaw === '' ? 0 : Number(incomeRaw);
      const expense = expenseRaw === '' ? 0 : Number(expenseRaw);
      const energy = document.querySelector('input[name="daily-energy"]:checked')?.value || '';
      if (!isValidDate(date) || (requestedStudyMinutes !== null && (!Number.isInteger(requestedStudyMinutes) || requestedStudyMinutes < 0 || requestedStudyMinutes > 1440)) || income < 0 || expense < 0 || !Number.isFinite(income) || !Number.isFinite(expense)) {
        $('#daily-record-status').textContent = '请检查日期、学习分钟数和收支金额。';
        return;
      }
      if ([income, expense].some((amount) => amount > Number.MAX_SAFE_INTEGER / 100 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7)) { $('#daily-record-status').textContent = '金额最多保留两位小数，请检查后再保存。'; return; }
      const hasIncomeEntry = incomeRaw !== '';
      const hasExpenseEntry = expenseRaw !== '';
      const oldLog = personalData.dailyLogs.find((entry) => entry.date === date);
      const nextData = JSON.parse(JSON.stringify(data));
      const nextPersonal = clonePersonalData();
      const linkedStudy = nextData.studies.find((item) => item.id === oldLog?.studyRecordId && item.date === date && item.content === '一键今日记录');
      const linkedFinance = nextData.finances.find((item) => item.id === oldLog?.financeRecordId && item.date === date && item.note === '一键今日记录');
      const studyMinutes = requestedStudyMinutes === null ? (linkedStudy?.duration ?? oldLog?.studyMinutes ?? 0) : requestedStudyMinutes;
      const savedIncome = hasIncomeEntry ? income : (linkedFinance?.income ?? (hasExpenseEntry ? 0 : oldLog?.income ?? 0));
      const savedExpense = hasExpenseEntry ? expense : (linkedFinance?.expense ?? (hasIncomeEntry ? 0 : oldLog?.expense ?? 0));
      const log = {
        id: oldLog?.id || makeId(), date,
        completedItems: $('#daily-completed-items').value.trim(), studyMinutes,
        income: Math.round(savedIncome * 100) / 100, expense: Math.round(savedExpense * 100) / 100,
        energy, summary: $('#daily-summary').value.trim(),
        studyRecordId: oldLog?.studyRecordId || null, financeRecordId: oldLog?.financeRecordId || null,
        createdAt: oldLog?.createdAt || Date.now(),
      };
      if (requestedStudyMinutes !== null) {
        if (studyMinutes > 0) {
          if (linkedStudy) Object.assign(linkedStudy, { date, content: '一键今日记录', duration: studyMinutes });
          else { const record = { id: makeId(), date, content: '一键今日记录', duration: studyMinutes, createdAt: Date.now() }; nextData.studies.push(record); log.studyRecordId = record.id; }
        } else if (linkedStudy) Object.assign(linkedStudy, { duration: 0 });
      }
      if (hasIncomeEntry || hasExpenseEntry) {
        if (linkedFinance) Object.assign(linkedFinance, { date, income: log.income, expense: log.expense, note: '一键今日记录' });
        else { const record = { id: makeId(), date, income: log.income, expense: log.expense, note: '一键今日记录', createdAt: Date.now() }; nextData.finances.push(record); log.financeRecordId = record.id; }
      }
      nextPersonal.dailyLogs = nextPersonal.dailyLogs.filter((entry) => entry.date !== date);
      nextPersonal.dailyLogs.push(log);
      const validation = validateData(nextData) || validatePersonalData(nextPersonal);
      if (validation) { $('#daily-record-status').textContent = validation; return; }
      const saveError = writeStoreTransaction([[STORAGE_KEY, nextData], [PERSONAL_STORAGE_KEY, nextPersonal]]);
      if (saveError) { $('#daily-record-status').textContent = saveError; return; }
      data = nextData;
      personalData = nextPersonal;
      dailyDrafts.delete(date);
      dailyFormBaseline = dailyFormSignature();
      fillDailyRecordForm(date);
      $('#daily-record-status').textContent = '今天已保存，学习与收支统计已更新。';
      populateMonthYears();
      render();
      returnFromDailyRecord(true);
    } catch (error) {
      $('#daily-record-status').textContent = '保存失败，输入内容仍保留。请检查日期和浏览器存储后重试。';
    } finally {
      saveButton.disabled = false;
      saveButton.removeAttribute('aria-busy');
    }
  });

  $('#diary-form').addEventListener('submit', saveIdea);

  $('#habit-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = $('#habit-name-input').value.trim();
    if (!name) return;
    if (personalData.habits.some((habit) => habit.name.toLocaleLowerCase() === name.toLocaleLowerCase())) { toast('这个习惯已经添加过了。', true); return; }
    const next = clonePersonalData();
    next.habits.push({ id: makeId(), name, checkedDates: [], createdAt: Date.now() });
    if (commitPersonalData(next)) { event.target.reset(); $('#habit-compose').open = false; toast('习惯已添加'); }
  });

  $('#goal-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const next = clonePersonalData();
    next.goals.push({ id: makeId(), title: $('#goal-title-input').value.trim(), targetDate: $('#goal-date-input').value, description: $('#goal-description-input').value.trim(), completed: false, createdAt: Date.now() });
    if (commitPersonalData(next)) { event.target.reset(); $('#goal-date-input').value = today(); $('#goal-compose').open = false; toast('目标已添加'); }
  });

  document.addEventListener('input', (event) => {
    const slider = event.target.closest('[data-skill-id]');
    if (!slider || !SKILL_DEFINITIONS.some((skill) => skill.id === slider.dataset.skillId)) return;
    $(`#skill-value-${slider.dataset.skillId}`).textContent = `${slider.value}%`;
  });

  $('#backup-export').addEventListener('click', () => exportBackup(false));
  $('#backup-export-full').addEventListener('click', () => exportBackup(true));
  $('#backup-export-schedule').addEventListener('click', () => exportBackup(7));
  $('#backup-export-learning').addEventListener('click', () => exportBackup(8));
  $('#backup-before-restore').addEventListener('click', () => exportBackup(11));
  $('#backup-export-notes').addEventListener('click', () => exportBackup(11));
  $('#backup-export-health').addEventListener('click', () => exportBackup(10));
  $('#backup-export-ideas').addEventListener('click', () => exportBackup(9));
  $('#backup-choose').addEventListener('click', () => $('#backup-file').click());
  $('#backup-file').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    inspectBackupFile(file);
  });
  $('#backup-import-confirm').addEventListener('click', confirmBackupImport);
  $('#backup-import-cancel').addEventListener('click', () => {
    pendingBackup = null;
    $('#backup-preview').classList.add('hidden');
    $('#backup-file').value = '';
    setBackupStatus('已取消导入，现有数据未更改。');
  });

  $('#study-form').addEventListener('submit', (event) => {
    event.preventDefault();
    submitRecordForm('study');
  });

  $('#finance-form').addEventListener('submit', (event) => {
    event.preventDefault();
    submitRecordForm('finance');
  });

  ['study', 'finance'].forEach((type) => $(`#${type}-edit-cancel`).addEventListener('click', () => {
    resetRecordForm(type);
    recordStatus(type, '已取消编辑，原记录保留。');
    if (type === 'finance') window.LifeUI.closeSheet($('#finance-editor'));
  }));

  $('#task-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (taskSavePending) return;
    taskSavePending = true; window.LifeUI.setBusy($('#task-submit'), true);
    try {
      const S = window.LifeSchedule, id = $('#task-id').value, existing = data.tasks.find(task => task.id === id);
      if (id && (!existing || taskEditExpected !== JSON.stringify({ task: existing, detail: S.detailFor(scheduleMeta, id) }))) {
        window.LifeScheduleUI.formStatus('原日程已变化或不存在，未覆盖。输入保留，请重新核对。'); return;
      }
      const task = { ...(existing || { id: makeId(), completed: false, createdAt: Date.now() }), date: $('#task-date').value, title: $('#task-title').value.trim(), start: $('#task-start').value, end: $('#task-end').value };
      const validation = S.planError(task);
      if (validation) { window.LifeScheduleUI.formStatus(validation); return; }
      const overlaps = S.conflicts(task, data.tasks);
      if (overlaps.length && !await confirmAction('与 ' + overlaps.map(row => row.title).slice(0,3).join('、') + ' 的计划时间重叠。是否仍要保存？', '时间重叠', '仍要保存')) return;
      const next = S.clone(scheduleMeta), detail = { taskId: task.id, priority: $('#task-priority').value || null, deadline: $('#task-deadline').value || null, note: $('#task-note').value.trim() };
      const hadDetail = next.taskDetails.some(row => row.taskId === task.id);
      next.taskDetails = next.taskDetails.filter(row => row.taskId !== task.id);
      if (hadDetail || detail.priority || detail.deadline || detail.note) next.taskDetails.push(detail);
      const tasks = existing ? data.tasks.map(row => row.id === task.id ? task : row) : data.tasks.concat(task);
      const error = saveSchedule({ ...data, tasks }, next);
      if (error) { window.LifeScheduleUI.formStatus(error); toast(error,true); return; }
      otherDraftForms.delete('task-form'); populateMonthYears(); resetTaskForm(); render(); toast('日程已保存');
    } finally { taskSavePending = false; window.LifeUI.setBusy($('#task-submit'), false); }
  });

  $('#task-cancel').addEventListener('click', resetTaskForm);

  $('#quick-task-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const title = $('#quick-task-title').value.trim();
    if (!title) return;
    const task = { id: makeId(), date: scheduleDate(), title, start: '', end: '', completed: false, createdAt: Date.now() };
    data.tasks.push(task);
    if (saveData()) {
      populateMonthYears();
      event.target.reset();
      render();
      $('#quick-task-title').focus();
    } else {
      data.tasks = data.tasks.filter((item) => item.id !== task.id);
    }
  });

  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-open-task]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openTaskDetail(link.dataset.openTask);
  });

  $('#task-detail-back').addEventListener('click', returnFromTaskDetail);
  $('#task-previous').addEventListener('click', () => changeTaskBy(-1));
  $('#task-next').addEventListener('click', () => changeTaskBy(1));

  $('#daily-record-back').addEventListener('click', () => returnFromDailyRecord(false));
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const back = event.target.closest('[data-back-fallback]');
    if (back) { event.preventDefault(); returnUiPage(back.dataset.backFallback); return; }
    const closeFinance = event.target.closest('[data-close-finance]');
    if (closeFinance) { window.LifeUI.closeSheet($('#finance-editor')); resetRecordForm('finance'); return; }
    const profile = event.target.closest('[data-open-profile]');
    if (profile) { openPersonalProfile(); return; }
    const link = event.target.closest('[data-open-note], [data-open-goal], [data-open-habit], [data-open-page], a[href="#today-record"]');
    if (link) {
      event.preventDefault();
      if (link.hasAttribute('data-quick-launch')) { showQuickRecordSheet(); return; }
      if (link.getAttribute('href') === '#today-record') { fillDailyRecordForm(selectedDate()); activeDailyReturnRoute = window.location.hash || '#records'; }
      openUiPage(link.getAttribute('href'));
      return;
    }
    const rename = event.target.closest('[data-rename-category]');
    if (rename) {
      const stored = readStoredCategories();
      if (stored.error) { toast(stored.error, true); return; }
      const category = stored.data.categories.find((item) => item.id === rename.dataset.renameCategory);
      if (!category) return;
      categoryEditorExpected = JSON.parse(JSON.stringify(category));
      const meta = readFinanceMeta(stored.data);
      if (meta.error) { toast(meta.error,true); return; }
      categoryIconExpected = JSON.stringify(meta.data.categoryIcons.find(item=>item.categoryId===category.id) || null);
      window.LifeFinanceViews.selectCategoryIcon(category.id);
      $('#category-id').value = category.id;
      $('#category-name').value = category.name;
      $('#category-manage-type').value = category.type;
      $('#category-submit').textContent = '保存名称';
      $('#category-cancel').classList.remove('hidden');
      $('#category-status').textContent = '';
      $('#category-name').focus();
    }
    const toggle = event.target.closest('[data-toggle-category]');
    if (toggle) toggleCategory(toggle.dataset.toggleCategory);
    const ranking = event.target.closest('[data-ranking-type]');
    if (ranking) { rankingType = ranking.dataset.rankingType; renderInsights(); }
    const period = event.target.closest('[data-period]');
    if (period) { insightsPeriod = period.dataset.period; renderInsights(); }
    const time = event.target.closest('[data-insights-date]');
    if (time) { $('#insights-anchor').value = time.dataset.insightsDate; renderInsights(); }
    const metric = event.target.closest('[data-metric]');
    if (metric) { trendMetric = metric.dataset.metric; renderInsights(); }
  });

  document.querySelectorAll('[data-focus-finance]').forEach((button) => button.addEventListener('click', () => {
    const target = button.dataset.focusFinance === 'income' ? $('#finance-income-input') : $('#finance-expense-input');
    target.focus();
  }));

  document.addEventListener('click', async (event) => {
    const target = event.target.closest('button');
    if (!target) return;
    const financeMenu = target.closest('.bill-row-more');
    if (financeMenu) financeMenu.open = false;
    if (target.dataset.editStudy) {
      beginRecordEdit('study', target.dataset.editStudy);
    } else if (target.dataset.editFinance) {
      beginRecordEdit('finance', target.dataset.editFinance);
    } else if (target.dataset.deleteStudy) {
      if (!await confirmAction('确定删除这条学习记录吗？删除后会从每日和月度学习统计中移除。')) return;
      const nextData = { ...data, studies: data.studies.filter(item => item.id !== target.dataset.deleteStudy) };
      const error = saveLearning(nextData, window.LifeLearning.reconcile(learningMeta,nextData));
      if (error) { toast(error,true); return; }
      render(); toast('学习记录已删除');
    } else if (target.dataset.deleteFinance) {
      const linked = personalData.dailyLogs.some((log) => log.financeRecordId === target.dataset.deleteFinance);
      const message = linked ? '这笔流水来自今日记录。删除会移除流水，保留日报；以后再次保存这篇日报时可能重新生成流水。确认删除吗？' : '确定删除这笔收支流水吗？删除后会从每日和月度收支统计中移除。';
      if (!await confirmAction(message)) return;
      deleteFinanceRecord(target.dataset.deleteFinance);
    } else if (target.dataset.deleteTask) {
      if (!await confirmAction('确定删除这项日程吗？重复实例删除后不会因再次生成而恢复。')) return;
      const id = target.dataset.deleteTask;
      const error = saveSchedule({ ...data, tasks: data.tasks.filter(item => item.id !== id) }, window.LifeSchedule.removeTask(scheduleMeta, id));
      if (error) { toast(error,true); return; }
      if ($('#task-id').value === id) resetTaskForm();
      render(); toast('日程已删除');
    } else if (target.dataset.editTask) {
      if (otherDraftForms.has('task-form') && !await confirmAction('放弃当前任务草稿并打开所选任务？', '切换任务编辑', '放弃并打开')) return;
      otherDraftForms.delete('task-form');
      const task = data.tasks.find((item) => item.id === target.dataset.editTask);
      if (!task) return;
      if (location.hash !== '#tasks') openUiPage('#tasks');
      const details = window.LifeSchedule.detailFor(scheduleMeta, task.id);
      taskEditExpected = JSON.stringify({ task, detail: details });
      $('#task-id').value = task.id;
      $('#task-date').value = task.date;
      $('#task-title').value = task.title;
      $('#task-start').value = task.start || '';
      $('#task-end').value = task.end || '';
      $('#task-priority').value = details.priority || '';
      $('#task-deadline').value = details.deadline || '';
      $('#task-note').value = details.note;
      window.LifeScheduleUI.formStatus('');
      $('#task-compose').open = true;
      $('#task-form-title').textContent = '编辑日程';
      $('#task-submit').innerHTML = '保存修改 <span><span data-icon="check"></span></span>';
      $('#task-cancel').classList.remove('hidden');
      $('#task-cancel').textContent = '取消编辑';
      $('#task-title').focus();
    } else if (target.dataset.editNote) {
      beginNoteEdit(target.dataset.editNote);
    } else if (target.dataset.deleteDiary) {
      if (!await confirmAction('确定删除这条妙想及其标签关联吗？')) return;
      deleteIdea(target.dataset.deleteDiary);
    } else if (target.dataset.deleteHabit) {
      if (!await confirmAction('确定删除这个习惯及其打卡记录吗？')) return;
      const next = clonePersonalData();
      next.habits = next.habits.filter((habit) => habit.id !== target.dataset.deleteHabit);
      commitPersonalData(next);
    } else if (target.dataset.deleteGoal) {
      if (!await confirmAction('确定删除这个长期目标吗？')) return;
      const next = clonePersonalData();
      next.goals = next.goals.filter((goal) => goal.id !== target.dataset.deleteGoal);
      commitPersonalData(next);
    }
  });

  document.addEventListener('change', (event) => {
    const taskCheckbox = event.target.closest('[data-toggle-task]');
    if (taskCheckbox) {
      const task = data.tasks.find((item) => item.id === taskCheckbox.dataset.toggleTask);
      if (!task) return;
      task.completed = taskCheckbox.checked;
      if (saveData()) { render(); toast(task.completed ? '任务已完成' : '已取消完成'); }
      else { data = loadData(); render(); }
      return;
    }
    const habitCheckbox = event.target.closest('[data-toggle-habit]');
    if (habitCheckbox) {
      const next = clonePersonalData();
      const habit = next.habits.find((item) => item.id === habitCheckbox.dataset.toggleHabit);
      if (!habit) return;
      const date = personalSelectedDate();
      habit.checkedDates = habitCheckbox.checked ? [...new Set([...habit.checkedDates, date])] : habit.checkedDates.filter((checkedDate) => checkedDate !== date);
      commitPersonalData(next);
      return;
    }
    const goalCheckbox = event.target.closest('[data-toggle-goal]');
    if (goalCheckbox) {
      const next = clonePersonalData();
      const goal = next.goals.find((item) => item.id === goalCheckbox.dataset.toggleGoal);
      if (!goal) return;
      goal.completed = goalCheckbox.checked;
      commitPersonalData(next);
      return;
    }
    const skillSlider = event.target.closest('[data-skill-id]');
    if (skillSlider && SKILL_DEFINITIONS.some((skill) => skill.id === skillSlider.dataset.skillId)) {
      const skillId=skillSlider.dataset.skillId, hadFocus=document.activeElement===skillSlider;
      const next = clonePersonalData();
      next.skills[skillId] = Number(skillSlider.value);
      const saved=commitPersonalData(next), status=$('#personal-skill-status');
      status.textContent=saved ? '技能自评已保存；不会改变实际学习记录。' : '技能未能保存，已显示原有进度。请检查存储或其他页面更新。';
      status.classList.toggle('is-error',!saved);
      if(hadFocus) document.querySelector('[data-skill-id="'+skillId+'"]').focus({preventScroll:true});
    }
  });

  const routeSectionIds = { '#search': 'search-section', '#entry': 'entry-detail-section', '#overview': 'overview-section', '#records': 'records-section', '#today-record': 'today-record', '#daily-notes': 'daily-notes-section', '#habits': 'habits-section', '#learning': 'learning', '#tasks': 'work-plan-section', '#finance': 'finance', '#goals': 'goals-section', '#monthly': 'monthly', '#personal': 'personal', '#backup': 'backup', '#settings': 'settings-section', '#categories': 'categories-section', '#bill/new': 'bill-section', '#finance-detail': 'finance-detail-section' };
  routeSectionIds['#social'] = 'social-section';
  ['#ideas/search','#ideas/menu','#ideas/select','#ideas/write'].forEach(route=>routeSectionIds[route]='daily-notes-section');
  const isNoteRoute = (target) => /^#note\//.test(target || '');
  const isGoalRoute = (target) => /^#goal\//.test(target || '');
  const isHabitRoute = (target) => /^#habit\//.test(target || '');
  const recordRoutes = new Set(['#records', '#daily-notes', '#habits', '#goals', '#learning', '#tasks']);

  function readNoteTags() {
    try {
      const raw = localStorage.getItem(NOTE_TAGS_KEY);
      const value = raw === null ? window.LifeContent.blank() : JSON.parse(raw);
      const error = window.LifeContent.validate(value);
      if (error) { noteTagsError = error; return { error, data: null }; }
      return { data: value, error: '' };
    } catch (error) { noteTagsError = '妙想标签无法安全读取，已停止相关写入。'; return { error: noteTagsError, data: null }; }
  }

  function tagsMarkup(tags) {
    return tags.map((tag) => '<span class="idea-tag">' + escapeHtml('#' + tag) + '</span>').join('');
  }

  let quickSheetOpen = false;
  let quickSheetToastAfterClose = false;
  let quickSheetSuccessMessage = '';
  let quickSheetCloseTimer = 0;
  let lastAnimatedSection = '';

  function updateQuickFinanceCategories() {
    const type = document.querySelector('input[name="quick-finance-type"]:checked')?.value || 'income';
    const select = $('#quick-finance-category');
    const previous = select.value;
    const categories = (categoryData?.categories || []).filter((item) => item.type === type && item.active);
    select.innerHTML = categories.length
      ? categories.map((item) => '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(item.name) + '</option>').join('')
      : '<option value="">没有可用分类</option>';
    select.value = categories.some((item) => item.id === previous) ? previous : (categories[0]?.id || '');
    $('#quick-record-submit').disabled = $('#quick-record-form').dataset.kind === 'finance' && !categories.length;
    if ($('#quick-record-form').dataset.kind === 'finance' && !categories.length) $('#quick-record-status').textContent = '没有可用的收支分类，请先到设置中管理分类。';
  }

  function showQuickRecordSheet(fromHistory = false) {
    if (quickSheetOpen) return;
    clearTimeout(quickSheetCloseTimer);
    quickSheetOpen = true;
    $('#quick-record-sheet').classList.remove('is-closing');
    $('#quick-record-date').textContent = selectedDate() === today() ? '今天 · ' + selectedDate() : '所选日期 · ' + selectedDate();
    if ($('#quick-record-form').classList.contains('hidden')) $('#quick-record-heading').textContent = selectedDate() === today() ? '今日记录' : '记录当日';
    const freshCategories = readStoredCategories();
    if (!freshCategories.error) categoryData = freshCategories.data;
    updateQuickFinanceCategories();
    if (!fromHistory) history.pushState({ ...(history.state || {}), quickRecordSheet: true, uiDepth: (Number(history.state?.uiDepth) || 0) + 1 }, '', window.location.href);
    if (!$('#quick-record-sheet').open) $('#quick-record-sheet').showModal();
    $('.today-record-fab')?.setAttribute('aria-expanded', 'true');
    $('#quick-record-close').focus({ preventScroll: true });
  }

  function finishQuickRecordSheet(fromHistory = false) {
    if (!quickSheetOpen) return;
    quickSheetOpen = false;
    $('.today-record-fab')?.setAttribute('aria-expanded', 'false');
    $('#quick-record-sheet').classList.add('is-closing');
    clearTimeout(quickSheetCloseTimer);
    quickSheetCloseTimer = window.setTimeout(() => {
      if ($('#quick-record-sheet').open) $('#quick-record-sheet').close();
      $('#quick-record-sheet').classList.remove('is-closing');
      if (quickSheetToastAfterClose) { quickSheetToastAfterClose = false; toast(quickSheetSuccessMessage || '已保存'); quickSheetSuccessMessage = ''; }
    }, window.LifeUI.motionDuration('fast'));
    if (!fromHistory && history.state?.quickRecordSheet) history.back();
  }

  function selectQuickRecordKind(kind) {
    const names = { study: '学习', finance: '收入 / 支出', task: '任务' };
    if (!names[kind]) return;
    $('#quick-record-choices').classList.add('hidden');
    $('#quick-record-form').classList.remove('hidden');
    $('#quick-record-heading').textContent = names[kind];
    document.querySelectorAll('.quick-sheet-fields').forEach((fields) => fields.classList.toggle('hidden', fields.id !== 'quick-' + kind + '-fields'));
    $('#quick-record-status').textContent = '';
    $('#quick-record-status').classList.remove('is-error');
    $('#quick-record-form').dataset.kind = kind;
    const focusTarget = { study: '#quick-study-content', finance: '#quick-finance-amount', task: '#quick-task-content' }[kind];
    if (kind === 'finance') updateQuickFinanceCategories();
    $(focusTarget).focus({ preventScroll: true });
  }

  function saveQuickRecord(event) {
    event.preventDefault();
    const button = $('#quick-record-submit');
    if (button.disabled || button.getAttribute('aria-busy') === 'true') return;
    const kind = $('#quick-record-form').dataset.kind;
    const date = selectedDate();
    const status = $('#quick-record-status');
    const fail = (message) => { status.textContent = message; status.classList.add('is-error'); };
    status.textContent = '';
    status.classList.remove('is-error');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
      if (kind === 'study') {
        const content = $('#quick-study-content').value.trim();
        const duration = $('#quick-study-duration').value.trim();
        if (!content || !duration) { fail('请填写学习内容和学习时间。'); return; }
        const stored = readStoredDataForBackup(), personal = readStoredPersonalForBackup();
        if (stored.error || personal.error) { fail(stored.error || personal.error); return; }
        const result = window.LifeRecordEditor.prepare(stored.data, personal.data, { type: 'study', fields: { date, content, duration }, newId: makeId(), createdAt: Date.now() });
        if (result.error) { fail(result.error); return; }
        const error = writeStoreTransaction([[STORAGE_KEY, result.data]]);
        if (error) { fail(error); return; }
        data = result.data; personalData = personal.data;
      } else if (kind === 'finance') {
        const type = document.querySelector('input[name="quick-finance-type"]:checked')?.value || 'income';
        const amount = $('#quick-finance-amount').value.trim();
        if (amount === '') { fail('请填写金额，明确的 0 USD 也可以保存。'); return; }
        const stored = readStoredDataForBackup(), personal = readStoredPersonalForBackup(), categories = readStoredCategories();
        if (stored.error || personal.error || categories.error) { fail(stored.error || personal.error || categories.error); return; }
        const categoryId = $('#quick-finance-category').value;
        const category = categories.data.categories.find((item) => item.id === categoryId && item.type === type && item.active);
        if (!category) { fail('请选择一个可用分类。'); return; }
        const fields = { date, income: type === 'income' ? amount : '', expense: type === 'expense' ? amount : '', note: $('#quick-finance-note').value.trim() };
        const result = window.LifeRecordEditor.prepare(stored.data, personal.data, { type: 'finance', fields, newId: makeId(), createdAt: Date.now(), allowZero: true });
        if (result.error) { fail(result.error); return; }
        const assigned = assignRecordCategories(categories.data, result.record, { [type]: categoryId });
        const validation = assigned.error || window.LifeCategories.validate(assigned.data, result.data.finances);
        if (validation) { fail(validation); return; }
        const error = writeStoreTransaction([[STORAGE_KEY, result.data], [CATEGORY_STORAGE_KEY, assigned.data]]);
        if (error) { fail(error); return; }
        data = result.data; personalData = personal.data; categoryData = assigned.data;
      } else if (kind === 'task') {
        const title = $('#quick-task-content').value.trim();
        if (!title) { fail('请填写任务内容。'); return; }
        const latest = readStoredDataForBackup();
        if (latest.error) { fail(latest.error); return; }
        data = latest.data;
        data.tasks.push({ id: makeId(), date, title, start: '', end: '', completed: $('#quick-task-completed').checked, createdAt: Date.now() });
        const validation = validateData(data);
        if (validation) { data = latest.data; fail(validation); return; }
        if (!saveData()) { data = loadData(); fail('任务未能保存，请检查浏览器存储后重试。'); return; }
      } else { fail('请选择要记录的内容。'); return; }
      populateMonthYears();
      render();
      status.textContent = kind === 'task' ? '任务已添加。' : '已保存。';
      $('#quick-record-form').reset();
      $('#quick-record-form').classList.add('hidden');
      $('#quick-record-choices').classList.remove('hidden');
      $('#quick-record-form').dataset.kind = '';
      quickSheetSuccessMessage = kind === 'task' ? '已添加' : '已保存';
      quickSheetToastAfterClose = true;
      finishQuickRecordSheet(false);
    } catch (error) {
      fail(error?.message || '保存失败，输入内容仍保留，请检查后重试。');
    } finally {
      button.removeAttribute('aria-busy');
      if ($('#quick-record-sheet').open && $('#quick-record-form').classList.contains('hidden')) button.disabled = false;
      else if (!$('#quick-record-form').classList.contains('hidden')) button.disabled = false;
    }
  }

  function initializeRouteBackbar() {
    const main = $('.main-content');
    const bar = document.createElement('header');
    bar.id = 'route-backbar';
    bar.className = 'route-backbar app-header hidden';
    bar.innerHTML = '<button type="button" id="route-back-button" aria-label="返回上一页"><span data-icon="back"></span><span>返回</span></button><h2 id="route-back-title"></h2><span aria-hidden="true"></span>';
    main.insertBefore(bar, main.querySelector('.date-control-parking').nextSibling);
    $('#route-back-button').addEventListener('click', () => {
      if (isTaskDetailRoute(location.hash)) returnFromTaskDetail();
      else if (location.hash === '#today-record') returnFromDailyRecord(false);
      else returnUiPage($('#route-backbar').dataset.fallback || '#records');
    });
  }

  function initializeWorkspacePages() {
    document.body.append($('#home-date-dialog'));
    document.body.append($('#quick-record-sheet'));
    document.body.append($('.today-record-fab'));
    initializeRouteBackbar();
    $('#diary-list').tabIndex = 0;
    $('#diary-list').setAttribute('aria-label','妙想历史列表');
    $('#global-results').tabIndex = 0;
    $('#global-results').setAttribute('aria-label','搜索结果列表');
    document.querySelectorAll('.section-heading > a[href="#records"], #learning > .page-back, #task-list-view > .page-back').forEach((link) => { link.innerHTML = '<span data-icon="back"></span>返回'; });
    const financeBack = document.createElement('button');
    financeBack.className = 'page-back'; financeBack.type = 'button'; financeBack.id = 'finance-source-back';
    financeBack.dataset.backFallback = '#overview'; financeBack.innerHTML = '<span data-icon="back"></span>返回';
    $('#finance').prepend(financeBack);
    const filters = $('#diary-filter').closest('.list-toolbar');
    filters.className = 'idea-filters';
    filters.innerHTML = '<label class="idea-query"><span class="sr-only">搜索妙想内容</span><input id="idea-query" type="search" placeholder="搜索妙想内容"></label><label><span class="sr-only">筛选妙想标签</span><select id="idea-tag-filter" aria-label="筛选妙想标签"><option value="">全部标签</option></select></label><label><span class="sr-only">妙想日期范围</span><select id="diary-filter" aria-label="妙想日期范围"><option value="all">全部日期</option><option value="date">所选日期</option></select></label><input class="hidden" id="diary-filter-date" type="date" aria-label="筛选妙想日期">';
    const filterActions = document.createElement('div');
    filterActions.className = 'idea-filter-actions';
    filterActions.innerHTML = '<p id="idea-filter-summary"></p><button id="idea-clear" class="text-button" type="button">清除筛选</button>';
    filters.after(filterActions);
    const submit = $('#diary-form button[type="submit"]');
    submit.id = 'idea-submit';
    const tags = document.createElement('div');
    tags.innerHTML = '<button class="text-button" type="button" id="idea-tags-toggle" aria-expanded="false" aria-controls="idea-tags-editor"># 标签</button><div class="idea-tags" id="idea-selected-tags"></div><div class="idea-tags-editor hidden" id="idea-tags-editor"><div class="idea-tag-entry"><label class="sr-only" for="idea-tag-input">标签名称</label><input id="idea-tag-input" type="text" maxlength="80" placeholder="标签名称 · 回车添加"><button class="secondary-button" type="button" id="idea-tag-add">添加</button></div><div class="idea-tags" id="idea-reuse-tags"></div></div><button id="idea-edit-cancel" class="text-button hidden" type="button">取消编辑</button><p id="idea-status" role="status" class="record-form-status"></p>';
    submit.before(tags);
    $('.diary-panel .panel-heading p:not(.eyebrow)').textContent = '';
    const taskPanel = $('#task-list-view .form-panel');
    const taskCompose = document.createElement('details');
    taskCompose.id = 'task-compose'; taskCompose.className = 'compose-details';
    taskCompose.innerHTML = '<summary>安排时间 / 编辑任务</summary>';
    taskPanel.before(taskCompose); taskCompose.append(taskPanel);
    $('#task-list-view .section-heading').after($('#quick-task-form'));
    $('.profile-card').classList.add('my-profile');
    const progressGroup=$('.personal-growth-grid');
    progressGroup.append($('.skills-details'));
    $('.profile-card').after(progressGroup,$('.personal-shortcuts'));
    const cumulative = document.createElement('details'); cumulative.id='personal-summary-detail'; cumulative.className='personal-summary-detail compose-details';
    cumulative.innerHTML='<summary>累计数据明细</summary>';
    $('.personal-shortcuts').after(cumulative);
    for (const [selector,title,key,symbol,route] of [['.growth-panel','成长数据','growth','stats','#learning'],['.wealth-panel','财富成长','wealth','wallet','#finance']]) {
      const panel=$(selector), link=document.createElement('a'); link.href=route; link.id='my-'+key+'-entry';
      link.className='settings-row ui-group-row personal-hub-row';
      link.innerHTML='<span class="ui-row-icon" data-icon="'+symbol+'"></span><span class="ui-row-copy"><strong>'+title+'</strong><small id="my-'+key+'-sub"></small></span><span class="ui-row-meta" id="my-'+key+'-meta"></span><span class="ui-row-chevron" data-icon="chevronRight"></span>';
      panel.before(link); cumulative.append(panel);
      link.addEventListener('click',event=>{
        if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
        event.preventDefault(); openUiPage(route);
        if(key==='growth'){
          chooseModuleDate('learning',today());
          window.LifeLearningUI.restore({view:'stats'}); window.LifeLearningUI.render();
        }else{
          $('#finance-period').value=today().slice(0,7); $('#finance-period').dispatchEvent(new Event('change'));
          $('#finance-history-range').value='month'; $('#finance-history-search').value=''; historyPages.finance=1;
          renderHistory('finance'); renderFinanceOverview();
        }
        rememberView();
      });
    }
    const growthExtra=document.createElement('p'); growthExtra.id='personal-growth-extra'; growthExtra.className='subtle-copy';
    $('.growth-panel').append(growthExtra);
    const streakRule=document.createElement('p'); streakRule.className='subtle-copy'; streakRule.textContent='学习日按有记录的日期去重（含历史0分钟记录）；连续学习截至今天或昨天。计划时长不计入实际学习。'; $('.growth-panel').append(streakRule);
    const monthCopy=document.createElement('p'); monthCopy.id='personal-finance-month'; monthCopy.className='subtle-copy';
    $('.wealth-panel').append(monthCopy);
    const wealthRule=document.createElement('p'); wealthRule.className='subtle-copy'; wealthRule.textContent='累计净结余＝全部收入－全部支出；不同于账户余额或资产总额。财富目标由你手动设置。'; $('.wealth-panel').append(wealthRule);
    const about=document.createElement('details'); about.id='personal-about'; about.className='personal-about compose-details';
    about.innerHTML='<summary>关于 Life OS <small>本地网页 · JSON v11</small></summary><p class="subtle-copy">生活记录保存在当前浏览器来源；笔记仅主动同步至授权Notion，没有自动备份。</p>';
    cumulative.after(about);
    const dataHelp=document.createElement('a');dataHelp.id='personal-data-help';dataHelp.className='text-button';dataHelp.href='#settings';dataHelp.dataset.openPage='';dataHelp.textContent='查看应用与数据说明';about.after(dataHelp);
    $('#home-date-open').addEventListener('click', () => {
      $('#overview-date-slot').append($('.date-control'));
      $('#home-date-dialog').showModal();
    });
    $('#home-date-close').addEventListener('click', () => window.LifeUI.closeSheet($('#home-date-dialog')));
    $('#home-date-today').addEventListener('click', () => {
      $('#selected-date').value = today();
      $('#selected-date').dispatchEvent(new Event('change'));
      window.LifeUI.closeSheet($('#home-date-dialog'));
    });
    $('#quick-record-close').addEventListener('click', () => finishQuickRecordSheet(false));
    $('#bill-section').addEventListener('click', (event) => {
      if (event.target.matches('[data-bill-sheet-backdrop]')) returnUiPage('#finance');
    });
    document.addEventListener('keydown', (event) => {
      if (window.location.hash !== '#bill/new' || document.querySelector('dialog[open]')) return;
      if (event.key === 'Escape') { event.preventDefault(); returnUiPage('#finance'); return; }
      if (event.key !== 'Tab') return;
      const controls = [...$('#bill-section').querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],summary')].filter((node) => node.getClientRects().length);
      if (!controls.length) return;
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || !$('#bill-section .bill-sheet-surface').contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    document.addEventListener('toggle', (event) => {
      const details = event.target.closest?.('.bill-row-more');
      if (!details) return;
      const menu = details.querySelector(':scope > div');
      if (!details.open) { menu?.classList.remove('is-positioned'); menu?.style.removeProperty('top'); menu?.style.removeProperty('right'); return; }
      document.querySelectorAll('.bill-row-more[open]').forEach((other) => { if (other !== details) other.open = false; });
      if (!menu) return;
      menu.classList.add('is-positioned');
      const anchor = details.querySelector('summary').getBoundingClientRect();
      const height = menu.getBoundingClientRect().height;
      const bottomLimit = window.innerHeight - 76;
      const top = anchor.bottom + height + 8 <= bottomLimit ? anchor.bottom + 4 : Math.max(8, anchor.top - height - 4);
      menu.style.top = `${top}px`;
      menu.style.right = `${Math.max(8, window.innerWidth - anchor.right)}px`;
    }, true);
    document.addEventListener('click', (event) => {
      if (event.target.closest('.bill-row-more')) return;
      document.querySelectorAll('.bill-row-more[open]').forEach((details) => { details.open = false; });
    });
    window.addEventListener('scroll', (event) => {
      // Caret scrolling on input blur is not a change to the menu's page position.
      if (event.target instanceof Element && event.target.matches('input,textarea')) return;
      document.querySelectorAll('.bill-row-more[open]').forEach((details) => { details.open = false; });
    }, true);
    $('#quick-record-back').addEventListener('click', () => {
      $('#quick-record-status').textContent = '';
      $('#quick-record-status').classList.remove('is-error');
      $('#quick-record-form').classList.add('hidden');
      $('#quick-record-choices').classList.remove('hidden');
      $('#quick-record-form').dataset.kind = '';
      $('#quick-record-heading').textContent = selectedDate() === today() ? '今日记录' : '记录当日';
      $('#quick-record-choices button').focus({ preventScroll: true });
    });
    $('#quick-record-choices').addEventListener('click', (event) => {
      const choice = event.target.closest('[data-quick-kind]');
      if (choice) selectQuickRecordKind(choice.dataset.quickKind);
    });
    $('#quick-record-form').addEventListener('submit', saveQuickRecord);
    document.querySelectorAll('input[name="quick-finance-type"]').forEach((input) => input.addEventListener('change', updateQuickFinanceCategories));
    $('#quick-record-sheet').addEventListener('cancel', (event) => { event.preventDefault(); finishQuickRecordSheet(false); });
    $('#quick-record-sheet').addEventListener('click', (event) => { if (event.target === $('#quick-record-sheet')) finishQuickRecordSheet(false); });
    $('#idea-tags-toggle').addEventListener('click', () => {
      const open = $('#idea-tags-editor').classList.toggle('hidden') === false;
      $('#idea-tags-toggle').setAttribute('aria-expanded', String(open));
      if (open) { renderTagDraft(); $('#idea-tag-input').focus(); }
    });
    $('#idea-tag-add').addEventListener('click', () => addDraftTag($('#idea-tag-input').value));
    $('#idea-tag-input').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); addDraftTag(event.target.value); } });
    $('#diary-form').addEventListener('input', () => { noteFormChanged = true; $('#idea-edit-cancel').classList.remove('hidden'); $('#idea-edit-cancel').textContent = noteEdit ? '取消编辑' : '清空草稿'; });
    $('#idea-edit-cancel').addEventListener('click', async () => {
      if (!await confirmAction('放弃当前妙想的未保存草稿？已保存的记录不受影响。', '放弃草稿', '放弃草稿')) return;
      try { await window.LifeIdeasEditor.discard(); } catch(error) { toast(error.message,true);return; }
      resetIdeaForm(); window.LifeIdeasUI.discarded();
    });
    ['#idea-query','#idea-tag-filter'].forEach((selector) => $(selector).addEventListener(selector === '#idea-query' ? 'input' : 'change', () => { diaryPage = 1; renderDiary(); rememberView(); }));
    $('#idea-clear').addEventListener('click', clearIdeaFilters);
    ['#global-query','#global-type','#global-date'].forEach((selector) => $(selector).addEventListener(selector === '#global-query' ? 'input' : 'change', () => { searchPage = 1; renderGlobalSearch(); rememberView(); }));
    $('#selected-date').addEventListener('change', () => queueMicrotask(rememberView));
    $('#global-clear').addEventListener('click', () => { $('#global-query').value = $('#global-type').value = $('#global-date').value = ''; searchPage = 1; renderGlobalSearch(); $('#global-query').focus(); });
    $('#global-prev').addEventListener('click', () => { searchPage -= 1; renderGlobalSearch(); $('#global-results').scrollTop = 0; });
    $('#global-next').addEventListener('click', () => { searchPage += 1; renderGlobalSearch(); $('#global-results').scrollTop = 0; });
    document.addEventListener('input', (event) => {
      const form = event.target.closest('form');
      if (form && !['diary-form','daily-record-form'].includes(form.id)) otherDraftForms.add(form.id);
    });
    document.addEventListener('reset', (event) => { otherDraftForms.delete(event.target.id); });
    window.addEventListener('beforeunload', (event) => {
      if (noteFormChanged || dailyDrafts.size || (dailyFormBaseline && dailyFormSignature() !== dailyFormBaseline) || otherDraftForms.size) { event.preventDefault(); event.returnValue = ''; }
    });
    document.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const card = event.target.closest('[data-home-card]');
      if (card) {
        event.preventDefault();
        const date = selectedDate();
        if (card.dataset.homeCard === 'note') { clearIdeaFilters(); $('#diary-filter').value = 'date'; $('#diary-filter-date').value = date; if (!noteFormChanged && !noteEdit) $('#diary-date').value = date; diaryPage = 1; renderDiary(); }
        if (card.dataset.homeCard === 'study') { learningViewDate=date; window.LifeLearningUI.home(); $('#study-history-range').value = 'selected'; $('#study-history-search').value = ''; historyPages.study = 1; renderHistory('study'); }
        if (card.dataset.homeCard === 'finance') { $('#finance-period').value = date.slice(0,7); $('#finance-history-anchor').value = date; $('#finance-history-range').value = 'selected'; $('#finance-history-search').value = ''; historyPages.finance = 1; renderHistory('finance'); renderFinanceOverview(); }
        if (card.dataset.homeCard === 'task') { scheduleViewDate=date; window.LifeScheduleUI.restore({ view:'day', month:date.slice(0,7), status:'all', scope:'selected' }); renderTasks(data.tasks.filter(task=>task.date===date)); }
        if (card.dataset.homeCard === 'health') window.LifeHealthUI.chooseDate(date);
        if (card.dataset.homeCard === 'habits') { $('#personal-date').value = date; renderHabits(); }
        openUiPage(card.getAttribute('href')); return;
      }
      const remove = event.target.closest('[data-remove-note-tag]');
      if (remove) { pendingNoteTags = pendingNoteTags.filter((tag) => tag !== remove.dataset.removeNoteTag); noteFormChanged = true; renderTagDraft(); return; }
      const reuse = event.target.closest('[data-reuse-note-tag]');
      if (reuse) { addDraftTag(reuse.dataset.reuseNoteTag); return; }
      const result = event.target.closest('[data-search-type]');
      if (result) { event.preventDefault(); openSearchResult(result.dataset.searchType, result.dataset.searchId); }
      const sourcePage = event.target.closest('[data-entry-source-page]');
      if (sourcePage) { event.preventDefault(); openEntrySource(sourcePage.dataset.entrySourcePage, sourcePage.dataset.entryId); }
    });
  }

  function renderWorkspaceHome() {
    const date = selectedDate(), scope = date === today() ? '今日' : '当日';
    const notes = personalData.diary.filter((note) => note.date === date).sort((a,b) => b.createdAt - a.createdAt);
    const tasks = data.tasks.filter((task) => task.date === date), completed = tasks.filter((task) => task.completed).length;
    $('#overview-notes').textContent = notes.length;
    $('#overview-note-preview').textContent = notes.length ? (notes[0].title || notes[0].content).replace(/\s+/g,' ').slice(0,90) : '这一天还没有妙想';
    $('#home-scope-label').textContent = scope + ' · ' + date;
    $('#home-avatar').textContent = Array.from(personalData.profile.nickname.trim())[0] || '我';
    $('#home-nickname').textContent = personalData.profile.nickname.trim() || '我的生活';
    $('#progress-title').textContent = tasks.length ? scope + '日程' : '暂无日程';
    $('#task-fraction').textContent = completed + ' / ' + tasks.length;
    const finances = data.finances.filter((item) => item.date === date);
    $('#overview-income').textContent = finances.length ? money(centsTotal(finances, 'income') / 100) : '—';
    $('#overview-expense').textContent = finances.length ? money(centsTotal(finances, 'expense') / 100) : '—';
    $('#overview-balance').textContent = finances.length ? money((centsTotal(finances, 'income') - centsTotal(finances, 'expense')) / 100) : '—';
    $('.today-record-fab').setAttribute('aria-label', date === today() ? '记录今天' : '记录当日');
    $('.today-record-fab').title = date === today() ? '记录今天' : '记录当日';
    window.LifeHealthUI.renderHomeCard(date);
    window.LifeNotesUI.renderHomeCard();
    $('#home-habits-completed').textContent = personalDataError ? '—' : personalData.habits.filter(habit=>habit.checkedDates.includes(date)).length;
    $('#home-habits-summary').textContent = personalDataError ? '个人数据暂不可读取' : scope + ' · 共 ' + personalData.habits.length + ' 项习惯';
    const goalsCompleted = personalData.goals.filter(goal=>goal.completed).length;
    $('#home-goals-active').textContent = personalDataError ? '—' : personalData.goals.length - goalsCompleted;
    $('#home-goals-summary').textContent = personalDataError ? '个人数据暂不可读取' : goalsCompleted + ' 项已完成 · 全部目标';
  }

  function renderTagDraft() {
    $('#idea-selected-tags').innerHTML = pendingNoteTags.map((tag) => '<button class="idea-tag" type="button" data-remove-note-tag="' + escapeHtml(tag) + '" aria-label="移除标签：' + escapeHtml(tag) + '">' + escapeHtml('#' + tag) + '<span data-icon="close"></span></button>').join('');
    $('#idea-reuse-tags').innerHTML = window.LifeContent.allTags(noteTags).filter((tag) => !pendingNoteTags.some((value) => value.toLocaleLowerCase() === tag.toLocaleLowerCase())).map((tag) => '<button type="button" class="idea-tag" data-reuse-note-tag="' + escapeHtml(tag) + '">' + escapeHtml('#' + tag) + '</button>').join('');
  }

  function addDraftTag(value) {
    const candidate = window.LifeContent.assign(window.LifeContent.blank(), 'draft', [...pendingNoteTags, value]);
    const error = window.LifeContent.validate(candidate);
    if (error) { $('#idea-status').textContent = error; return; }
    pendingNoteTags = candidate.assignments[0].tags;
    $('#idea-tag-input').value = ''; noteFormChanged = true; $('#idea-status').textContent = ''; renderTagDraft();
  }

  function clearIdeaFilters() {
    $('#idea-query').value = $('#idea-tag-filter').value = '';
    $('#diary-filter').value = 'all'; diaryPage = 1; renderDiary();
  }

  function resetIdeaForm() {
    noteEdit = null; pendingNoteTags = []; noteFormChanged = false;
    $('#diary-form').reset(); $('#diary-date').value = today();
    $('#idea-submit').innerHTML = window.LifeIcons.render('check'); $('#idea-edit-cancel').classList.add('hidden');
    $('#idea-status').textContent = ''; renderTagDraft(); window.LifeIdeasEditor?.reset();
  }

  async function beginNoteEdit(id) {
    if (noteFormChanged && !await confirmAction('当前有未保存的妙想。放弃草稿并打开这条记录？', '切换编辑', '放弃并打开')) return;
    try {
      if(noteFormChanged)await window.LifeIdeasEditor.discard();
      else if(await window.LifeIdeasRich.get('drafts','current')){toast('还有未保存草稿，请先通过新建入口恢复，或在妙想菜单中确认放弃。',true);return;}
    }catch(error){toast(error.message,true);return;}
    const stored = readStoredPersonalForBackup(), storedTags = readNoteTags();
    if (stored.error || storedTags.error) { toast(stored.error || storedTags.error,true); return; }
    const note = stored.data.diary.find((row) => row.id === id);
    if (!note) { toast('这条妙想已不存在。',true); return; }
    personalData = stored.data; noteTags = storedTags.data;
    noteEdit = { expected: JSON.stringify(note), id, tags: JSON.stringify(window.LifeContent.tagsFor(noteTags,id)) };
    pendingNoteTags = window.LifeContent.tagsFor(noteTags,id);
    window.LifeIdeasEditor.reset();
    $('#idea-tag-input').value = ''; $('#idea-status').textContent = '';
    $('#diary-date').value = note.date; $('#diary-title-input').value = note.title; $('#diary-content-input').value = note.content;
    noteFormChanged = false; renderTagDraft(); $('#idea-submit').innerHTML = window.LifeIcons.render('check'); $('#idea-edit-cancel').textContent = '取消编辑'; $('#idea-edit-cancel').classList.remove('hidden');
    window.LifeIdeasUI.openEditor();
  }

  async function saveIdea(event) {
    event.preventDefault();
    const button = $('#idea-submit'); if (button.disabled) return; button.disabled = true;
    window.LifeIdeasEditor.setSaving(true);
    try {
      if ($('#idea-tag-input').value.trim()) { $('#idea-status').textContent = '请先添加输入中的标签，或清空标签输入。'; return; }
      const prepared = await window.LifeIdeasEditor.prepare();
      const stored = readStoredPersonalForBackup(), storedTags = readNoteTags();
      if (stored.error || storedTags.error) { $('#idea-status').textContent = stored.error || storedTags.error; return; }
      const existing = noteEdit ? stored.data.diary.find((row) => row.id === noteEdit.id) : null;
      if (noteEdit && (!existing || JSON.stringify(existing) !== noteEdit.expected || JSON.stringify(window.LifeContent.tagsFor(storedTags.data,noteEdit.id)) !== noteEdit.tags)) { $('#idea-status').textContent = '这条妙想或标签已在其他页面改变。输入仍保留，请复制后重新打开最新记录。'; return; }
      const note = { id: existing?.id || prepared.saveId, date: existing?.date || $('#diary-date').value, title: existing?.title ?? $('#diary-title-input').value, content: prepared.plain, createdAt: existing?.createdAt ?? Date.now() };
      if (!existing && stored.data.diary.some(n=>n.id===note.id)) { $('#idea-status').textContent='这条草稿已保存，请重新打开原记录编辑；不会重复新增。'; return; }
      const next = JSON.parse(JSON.stringify(stored.data));
      next.diary = existing ? next.diary.map((row) => row.id === note.id ? note : row) : [...next.diary,note];
      const nextTags = window.LifeContent.assign(storedTags.data,note.id,pendingNoteTags);
      const error = !note.content ? '请填写妙想内容。' : validatePersonalData(next) || window.LifeContent.validate(nextTags,next.diary);
      if (error) { $('#idea-status').textContent = error; return; }
      const rich=window.LifeIdeasRich.read(stored.data.diary);
      if(rich.error)throw new Error(rich.error);
      if(rich.raw!==prepared.metaRaw)throw new Error('格式数据已在其他页面变化，请保留输入并重新打开最新记录。');
      const nextRich={version:1,documents:rich.data.documents.filter(d=>d.recordId!==note.id)};
      nextRich.documents.push({recordId:note.id,plainTextSnapshot:note.content,delta:prepared.delta,attachmentIds:window.LifeIdeasRich.refs(prepared.delta),updatedAt:Date.now()});
      const richError=window.LifeIdeasRich.validate(nextRich,null,false);if(richError)throw new Error(richError);
      const expected=Object.fromEntries([PERSONAL_STORAGE_KEY,NOTE_TAGS_KEY,window.LifeIdeasRich.key].map(k=>[k,localStorage.getItem(k)]));
      const committed=await window.LifeIdeasRich.commit([[PERSONAL_STORAGE_KEY,next],[NOTE_TAGS_KEY,nextTags],[window.LifeIdeasRich.key,nextRich]],writeStoreTransaction,{expected,clearRevision:prepared.revision,clearDraftSnapshot:prepared.draftSnapshot});

      personalData = next; noteTags = nextTags; if (!existing) diaryPage = 1; resetIdeaForm();
      render(); toast(committed.warning?'妙想已保存；'+committed.warning:'妙想已保存',Boolean(committed.warning)); window.LifeIdeasUI.saved(note,!existing);
    } catch(error) { $('#idea-status').textContent='保存失败：'+error.message; toast('妙想未能保存，输入仍保留',true); } finally { window.LifeIdeasEditor.setSaving(false); button.disabled = false; }
  }

  function deleteIdea(id) {
    const stored = readStoredPersonalForBackup(), storedTags = readNoteTags();
    if (stored.error || storedTags.error) { toast(stored.error || storedTags.error,true); return; }
    const next = stored.data;
    next.diary = next.diary.filter((row) => row.id !== id);
    const nextTags = { assignments: storedTags.data.assignments.filter((row) => row.recordId !== id) };
    const error = writeStoreTransaction([[PERSONAL_STORAGE_KEY,next],[NOTE_TAGS_KEY,nextTags]]);
    if (error) { toast(error,true); return; }
    personalData = next; noteTags = nextTags;
    if (noteEdit?.id === id) resetIdeaForm();
    render(); toast('妙想已删除');
    if (isNoteRoute(window.location.hash)) returnUiPage('#daily-notes');
  }

  function readIdeaDraft() {
    if(!noteEdit&&!noteFormChanged)return null;
    return {edit:noteEdit,dirty:noteFormChanged,date:$('#diary-date').value,title:$('#diary-title-input').value,content:$('#diary-content-input').value,tags:[...pendingNoteTags],tagInput:$('#idea-tag-input').value,...(window.LifeIdeasEditor?.snapshot(noteEdit?.id||'new')||{})};
  }

  function restoreIdeaDraft(draft) {
    if(!draft||typeof draft.content!=='string'||!Array.isArray(draft.tags))return;
    noteEdit=draft.edit||null;noteFormChanged=Boolean(draft.dirty);pendingNoteTags=draft.tags.filter(t=>typeof t==='string');
    $('#diary-date').value=draft.date||today();$('#diary-title-input').value=draft.title||'';$('#diary-content-input').value=draft.content;$('#idea-tag-input').value=draft.tagInput||'';
    $('#idea-submit').innerHTML=window.LifeIcons.render('check');$('#idea-edit-cancel').classList.toggle('hidden',!noteEdit&&!noteFormChanged);renderTagDraft();window.LifeIdeasEditor?.restore(draft);
  }

  let ideaDeleteBusy=false;
  async function deleteSelectedIdeas(ids) {
    if(ideaDeleteBusy)return false;
    ideaDeleteBusy=true;
    try{
      const unique=[...new Set(ids)],before=readStoredPersonalForBackup(),beforeTags=readNoteTags();
      if(before.error||beforeTags.error){toast(before.error||beforeTags.error,true);return false;}
      const chosen=before.data.diary.filter(n=>unique.includes(n.id));
      if(!chosen.length){toast('所选妙想已不存在。',true);return false;}
      if(!await confirmAction('确定删除明确选中的 '+chosen.length+' 条妙想及其标签关联吗？其他记录会保留。','删除所选妙想','确认删除'))return false;
      const current=readStoredPersonalForBackup(),tags=readNoteTags();
      if(current.error||tags.error){toast(current.error||tags.error,true);return false;}
      if(chosen.some(note=>JSON.stringify(current.data.diary.find(n=>n.id===note.id))!==JSON.stringify(note)||JSON.stringify(window.LifeContent.tagsFor(tags.data,note.id))!==JSON.stringify(window.LifeContent.tagsFor(beforeTags.data,note.id)))){toast('所选记录已发生变化，请重新选择。未删除任何记录。',true);return false;}
      const selected=new Set(chosen.map(n=>n.id));
      const next={...current.data,diary:current.data.diary.filter(n=>!selected.has(n.id))};
      const nextTags={assignments:tags.data.assignments.filter(row=>!selected.has(row.recordId))};
      const error=validatePersonalData(next)||window.LifeContent.validate(nextTags,next.diary)||writeStoreTransaction([[PERSONAL_STORAGE_KEY,next],[NOTE_TAGS_KEY,nextTags]]);
      if(error){toast(error,true);return false;}
      personalData=next;noteTags=nextTags;if(selected.has(noteEdit?.id))resetIdeaForm();render();toast('已删除 '+chosen.length+' 条所选妙想');return true;
    }finally{ideaDeleteBusy=false;}
  }

  function readDailyForm() {
    return { values: ['daily-completed-items','daily-study-minutes','daily-income','daily-expense','daily-summary'].map((id) => [id,$('#'+id).value]), energy: $('input[name="daily-energy"]:checked')?.value || '' };
  }
  function applyDailyForm(value) {
    value.values.forEach(([id,text]) => { $('#'+id).value = text; });
    document.querySelectorAll('input[name="daily-energy"]').forEach((input) => { input.checked = input.value === value.energy; });
  }
  function dailyFormSignature() { return JSON.stringify(readDailyForm()); }

  function searchRows() {
    return window.LifeContent.search(data,personalData,noteTags,categoryData,{query:$('#global-query').value,type:$('#global-type').value,date:$('#global-date').value});
  }
  function rememberView() {
    history.replaceState({ ...(history.state || {}), homeDate: selectedDate(), viewSnapshot: captureUiView() }, '', window.location.href);
  }
  function searchTarget(type,id) {
    return (({ note:'#note/', task:'#task/', habit:'#habit/', goal:'#goal/' })[type] || '#entry/'+type+'/') + encodeURIComponent(id);
  }
  function renderGlobalSearch() {
    const labels = {note:'妙想',task:'任务',study:'学习',finance:'收支',habit:'习惯',goal:'长期目标',profile:'个人资料'};
    const rows = searchRows(), pages = Math.max(1,Math.ceil(rows.length/10));
    searchPage = Math.min(pages,Math.max(1,searchPage));
    $('#global-status').textContent = !$('#global-query').value.trim() ? '输入关键词，搜索已保存的本地内容。' : rows.length ? '找到 ' + rows.length + ' 项 · ' + ($('#global-date').value || '全部日期') : '没有匹配结果。可清除类型、日期或更换关键词。';
    $('#global-results').innerHTML = rows.slice((searchPage-1)*10,searchPage*10).map((row) => '<a class="search-result" href="' + searchTarget(row.type,row.id) + '" data-search-type="' + row.type + '" data-search-id="' + escapeHtml(row.id) + '"' + (row.type === 'task' ? ' data-open-task="'+escapeHtml(row.id)+'"' : '') + '><small>' + labels[row.type] + ' · ' + escapeHtml(row.date || ($('#global-date').value && row.type === 'habit' ? '打卡 '+$('#global-date').value : '无固定日期')) + '</small><strong>' + escapeHtml(row.title) + '</strong><p>' + escapeHtml(row.content.slice(0,120)) + '</p></a>').join('');
    $('#global-page').textContent = rows.length ? searchPage+' / '+pages+' 页' : '暂无结果';
    $('#global-prev').disabled = searchPage <= 1; $('#global-next').disabled = searchPage >= pages;
  }
  function openSearchResult(type,id) {
    data = loadData(); personalData = loadPersonalData();
    const storedTags = readNoteTags(); if (!storedTags.error) noteTags = storedTags.data;
    if (dataError || personalDataError || storedTags.error) { toast(dataError || personalDataError || storedTags.error,true); return; }
    const row = searchRows().find((item) => item.id === id && item.type === type);
    if (!row) { renderGlobalSearch(); toast('这条记录已不存在或已不符合搜索条件。',true); return; }
    if (type === 'task') { openTaskDetail(id); return; }
    if (type === 'note') { openUiPage('#note/'+encodeURIComponent(id)); return; }
    if (type === 'habit') { openUiPage('#habit/'+encodeURIComponent(id)); return; }
    if (type === 'goal') { openUiPage('#goal/'+encodeURIComponent(id)); return; }
    openUiPage('#entry/'+type+'/'+encodeURIComponent(id));
  }

  function renderEntryDetail(route) {
    let type,id;
    try { [,type,id] = route.slice(1).split('/'); id=decodeURIComponent(id || ''); } catch(error) { return false; }
    const row = type === 'study' ? data.studies.find((item) => item.id === id) : type === 'finance' ? data.finances.find((item) => item.id === id) : type === 'profile' && id === 'profile' ? personalData.profile : null;
    if (!row) return false;
    const title = type === 'study' ? '学习记录' : type === 'finance' ? '收支记录' : '个人资料';
    const content = type === 'study' ? row.content+'\n'+row.duration+' 分钟' : type === 'finance' ? (row.note ? row.note+'\n' : '')+'收入 '+money(row.income)+'\n支出 '+money(row.expense)+'\n差额 '+money(row.income-row.expense) : Object.values(row).filter(Boolean).join('\n');
    $('#entry-detail').innerHTML = '<button class="page-back" type="button" data-back-fallback="#search"><span data-icon="back"></span> 返回搜索</button><p class="eyebrow">'+escapeHtml(row.date || '个人空间')+'</p><h2>'+title+'</h2><p class="entry-body">'+escapeHtml(content)+'</p><button class="secondary-button" type="button" data-entry-source-page="'+type+'" data-entry-id="'+escapeHtml(id)+'">'+(type === 'profile' ? '编辑资料' : '打开对应页面')+'</button>';
    return true;
  }
  function openEntrySource(type,id) {
    if (type === 'profile') { openPersonalProfile(); return; }
    const row = (type === 'study' ? data.studies : data.finances).find((item) => item.id === id);
    if (!row) { toast('记录已不存在。',true); return; }
    if (type === 'study') {
      learningViewDate = row.date; $('#study-history-range').value = 'selected'; $('#study-history-search').value = ''; historyPages.study=1; window.LifeLearningUI.showRecords(); render(); openUiPage('#learning');
    } else {
      $('#finance-period').value = row.date.slice(0,7); $('#finance-history-anchor').value = row.date; $('#finance-history-range').value = 'selected'; $('#finance-history-search').value = ''; historyPages.finance=1; render(); openUiPage('#finance');
    }
  }

  function primaryMobileTarget(target) {
    if (['#habits','#goals'].includes(target) || isHabitRoute(target) || isGoalRoute(target)) return '#overview';
    if (window.LifeNotesUI.matches(target)) return '#overview';
    if (window.LifeHealthUI.matches(target)) return '#overview';
    if (window.LifeSocialUI.matches(target)) return '#social';
    if (target === '#monthly') return '#personal';
    if (target.startsWith('#entry/')) {
      const source=history.state?.lifeReturn?.returnRoute;
      if (source && source!==target && !source.startsWith('#entry/')) return primaryMobileTarget(source);
      return target.startsWith('#entry/finance/') ? '#finance' : target.startsWith('#entry/profile/') ? '#personal' : '#records';
    }
    if (isTaskDetailRoute(target)) return taskNavigationState()?.returnRoute === '#overview' ? '#overview' : '#records';
    if (target === '#today-record') return primaryMobileTarget(activeDailyReturnRoute && activeDailyReturnRoute !== target ? activeDailyReturnRoute : '#overview');
    if (window.LifeIdeasUI.matches(target) || recordRoutes.has(target) || isNoteRoute(target) || isGoalRoute(target) || isHabitRoute(target)) return '#records';
    if (target === '#backup' || target === '#settings') return '#personal';
    if (target === '#categories') return history.state?.lifeReturn?.returnRoute === '#settings' ? '#personal' : '#finance';
    if (target === '#bill/new') return '#finance';
    const financeView = window.LifeFinanceViews.match(target);
    if (financeView) return financeView.primary === '#monthly' ? '#personal' : financeView.primary || '#finance';
    return ['#overview', '#finance', '#social', '#personal'].includes(target) ? target : '#overview';
  }

  function replaceUiRoute(target) {
    const ideaMenuReplacement=location.hash==='#ideas/menu'&&['#ideas/search','#ideas/select','#ideas/write'].includes(target);
    history.replaceState(ideaMenuReplacement?history.state:null, '', window.location.pathname + window.location.search + target);
    $('#bill-section').classList.remove('bill-sheet-closing');
    billClosePending = false;
    runPageTransition(() => { syncNavigation(target); window.scrollTo({ top: 0, behavior: 'auto' }); });
  }

  function captureUiView() {
    const selectors = ['#overview-section', '#diary-list', '#habit-list', '#goal-current-list', '#finance', '#finance .table-wrap', '#task-list', '#global-results', '#finance-detail-list', '#learning-plan-list', '#learning .table-wrap','#health-history-list','#notes-list'];
    const scrollers = {};
    selectors.forEach((selector) => { const node = $(selector); if (node) scrollers[selector] = node.scrollTop; });
    const fields = {};
    ['selected-date','diary-filter','diary-filter-date','idea-query','idea-tag-filter','global-query','global-type','global-date','study-history-range','study-history-search','finance-period','insights-anchor','finance-category-type','finance-history-anchor','finance-history-range','finance-history-search','finance-history-start','finance-history-end','study-history-start','study-history-end'].forEach((id) => { if ($('#' + id)) fields[id] = $('#' + id).value; });
    return { scrollY: window.scrollY, scrollers, diaryPage, searchPage, fields, notes:window.LifeNotesUI.snapshot(), health:window.LifeHealthUI.snapshot(), historyPages: { ...historyPages }, insights: {period:insightsPeriod,metric:trendMetric,rankingType}, statisticsOtherOpen:$('.statistics-other').open, monthlyLegacyOpen:$('#monthly-legacy-detail').open, social:window.LifeSocialUI.snapshot(), personalSummaryOpen:$('#personal-summary-detail').open, personalAboutOpen:$('#personal-about').open, personalPanels:[...$('.personal-growth-grid').children].map(node=>Boolean(node.open)), ideas:window.LifeIdeasUI.snapshot(), schedule:window.LifeScheduleUI.snapshot(), learning:window.LifeLearningUI.snapshot() };
  }

  let ideaRestoreGeneration=0;
  function restoreUiView(view) {
    if (!view || typeof view !== 'object') return;
    if (view.social) window.LifeSocialUI.restore(view.social);
    if (view.health) window.LifeHealthUI.restore(view.health);
    if (view.notes) window.LifeNotesUI.restore(view.notes);
    if (view.ideas) window.LifeIdeasUI.restore(view.ideas);
    if (view.insights) { insightsPeriod=view.insights.period; trendMetric=view.insights.metric; rankingType=view.insights.rankingType; }
    if (typeof view.statisticsOtherOpen === 'boolean') $('.statistics-other').open=view.statisticsOtherOpen;
    if (typeof view.monthlyLegacyOpen === 'boolean') $('#monthly-legacy-detail').open=view.monthlyLegacyOpen;
    Object.entries(view.fields || {}).forEach(([id, value]) => { const field = document.getElementById(id); if (field && typeof value === 'string') field.value = value; });
    if (view.schedule) window.LifeScheduleUI.restore(view.schedule);
    if (view.learning) window.LifeLearningUI.restore(view.learning);
    if (!view.fields) {
      if (view.diaryFilter) $('#diary-filter').value = view.diaryFilter;
      if (view.diaryFilterDate) $('#diary-filter-date').value = view.diaryFilterDate;
    }
    diaryPage = Number(view.diaryPage) || 1;
    searchPage = Number(view.searchPage) || 1;
    if (view.historyPages) Object.assign(historyPages, view.historyPages);
    if (Array.isArray(view.personalPanels)) [...$('.personal-growth-grid').children].forEach((node,index)=>{if(node.tagName==='DETAILS')node.open=Boolean(view.personalPanels[index]);});
    $('#personal-summary-detail').open=typeof view.personalSummaryOpen==='boolean'?view.personalSummaryOpen:Boolean(view.personalPanels?.slice(0,2).some(Boolean));
    if(typeof view.personalAboutOpen==='boolean')$('#personal-about').open=view.personalAboutOpen;
    if (!recordEditors.study && !otherDraftForms.has('study-form')) $('#study-date').value = learningDate();
    if (!$('#task-id').value && !otherDraftForms.has('task-form')) $('#task-date').value = scheduleDate();
    render();
    const ideaRestore=++ideaRestoreGeneration,ideaRoute=location.hash,ideaActivity=window.LifeIdeasUI.activity();
    requestAnimationFrame(() => {
      window.scrollTo({ top: Number(view.scrollY) || 0, behavior: 'auto' });
      Object.entries(view.scrollers || {}).forEach(([selector, top]) => { const node = $(selector); if (node) node.scrollTop = Number(top) || 0; });
      if(window.LifeIdeasUI.matches(ideaRoute))window.LifeIdeasRich.layoutReady().then(()=>requestAnimationFrame(()=>{
        if(ideaRestore===ideaRestoreGeneration&&location.hash===ideaRoute&&ideaActivity===window.LifeIdeasUI.activity())$('#diary-list').scrollTop=Number(view.scrollers?.['#diary-list'])||0;
      }));
    });
  }

  function openUiPage(target) {
    if (!target || target === (window.location.hash || '#overview')) return;
    const source = window.location.hash || '#overview';
    const viewSnapshot = captureUiView();
    const previous = history.state && typeof history.state === 'object' ? history.state : {};
    history.replaceState({ ...previous, viewSnapshot }, '', window.location.href);
    const context = { returnRoute: source, site: 'my-life-dashboard' };
    history.pushState({ lifeReturn: context, homeDate: selectedDate(), ideaContext:window.LifeIdeasUI.isIdeas(target)?window.LifeIdeasUI.snapshot():undefined, viewSnapshot:window.LifeIdeasUI.matches(target)?viewSnapshot:['#learning','#tasks','#social/search'].includes(target)||window.LifeHealthUI.matches(target)||window.LifeNotesUI.matches(target)?{...viewSnapshot,scrollY:0,scrollers:{}}:undefined, uiDepth: (Number(history.state?.uiDepth) || 0) + 1 }, '', window.location.pathname + window.location.search + target);
    activeUiReturn = context;
    if (target === '#bill/new') billSheetReturnFocus = document.activeElement;
    runPageTransition(() => { syncNavigation(target); window.scrollTo({ top: 0, behavior: 'auto' }); });
  }

  function returnUiPage(fallback) {
    if (window.location.hash === '#bill/new' && !billClosePending) {
      billClosePending = true;
      $('#bill-section').classList.add('bill-sheet-closing');
      window.setTimeout(() => {
        if (window.location.hash === '#bill/new') returnUiPage(fallback);
        else { $('#bill-section').classList.remove('bill-sheet-closing'); billClosePending = false; }
      }, window.LifeUI.motionDuration('fast'));
      return;
    }
    const context = history.state?.lifeReturn;
    if (context?.site === 'my-life-dashboard' && context.returnRoute && context.returnRoute !== window.location.hash) {
      activeUiReturn = context;
      history.back();
    } else { replaceUiRoute(fallback || '#overview'); window.LifeIdeasUI.finishNavigation(); }
    if (window.location.hash !== '#bill/new') billClosePending = false;
  }

  function syncNavigation(target) {
    if (learningRouteActive && target !== '#learning' && window.LifeLearning.active(learningMeta)?.status === 'running') toast('专注计时仍在继续，可返回学习暂停或结束');
    learningRouteActive = target === '#learning';
    target = target || '#overview';
    if ($('#schedule-repeat-dialog').open && target !== '#tasks') window.LifeUI.closeSheet($('#schedule-repeat-dialog'));
    if ($('#finance-filter-dialog').open && target !== '#finance') $('#finance-filter-dialog').close();
    if ($('#finance-more-dialog').open && target !== '#finance') $('#finance-more-dialog').close();
    if ($('#finance-category-dialog').open && target !== '#finance') $('#finance-category-dialog').close();
    if ($('#insights-date-dialog').open && target !== '#monthly') $('#insights-date-dialog').close();
    const financeView = window.LifeFinanceViews.match(target);
    const social = window.LifeSocialUI.matches(target);
    const health = window.LifeHealthUI.matches(target);
    const notes = window.LifeNotesUI.matches(target);
    const entryRoute = target.startsWith('#entry/');
    const task = isTaskDetailRoute(target), note = isNoteRoute(target), goal = isGoalRoute(target), habit = isHabitRoute(target);
    if (!routeSectionIds[target] && !entryRoute && !task && !note && !goal && !habit && !financeView && !social && !health && !notes) { replaceUiRoute('#overview'); return; }
    let base = target;
    if (social) base = '#social';
    if (health) base = '#health';
    if (notes) base = '#notes';
    let financeViewTitle = '';
    if (financeView) {
      const view = window.LifeFinanceViews.renderRoute(target);
      if (view.error) { toast(view.error,true); replaceUiRoute(view.fallback || '#finance'); return; }
      financeViewTitle = view.title; base = '#finance-detail';
    }
    if (entryRoute) { if (!renderEntryDetail(target)) { toast('这条记录已不存在，请重新搜索。', true); replaceUiRoute('#search'); return; } base = '#entry'; }
    if (task) {
      const id = taskIdFromRoute(target);
      if (!id || !renderTaskDetail(id)) { routeToTaskList(); return; }
      base = '#tasks';
    }
    if (note || goal || habit) {
      let id = '';
      try { id = decodeURIComponent(target.slice(note || goal ? 6 : 7)); } catch (error) { replaceUiRoute(note ? '#daily-notes' : goal ? '#goals' : '#habits'); return; }
      const valid = note ? renderNoteDetail(id) : goal ? renderGoalDetail(id) : renderHabitDetail(id);
      if (!valid) {
        if(note&&window.LifeIdeasUI.consumeDeleted(id)){returnUiPage('#daily-notes');return;}
        toast('这条记录已不存在。', true); replaceUiRoute(note ? '#daily-notes' : goal ? '#goals' : '#habits'); return;
      }
      base = note ? '#daily-notes' : goal ? '#goals' : '#habit-detail';
    }
    const visibleId = habit ? 'habit-detail-section' : routeSectionIds[base];
    document.querySelectorAll('main > .page-section').forEach((section) => {
      const remainsBehindBillSheet = target === '#bill/new' && section.id === 'finance';
      section.classList.toggle('route-hidden', section.id !== visibleId && !remainsBehindBillSheet);
    });
    const routeBackbar = $('#route-backbar');
    $('.today-record-fab').classList.toggle('hidden', target !== '#overview');
    const routeTitle = (social && target !== '#social' ? (target === '#social/search' ? '搜索社交' : '帖子') : target === '#monthly' ? '统计' : '') || financeViewTitle || ({ '#search': '搜索', '#daily-notes': '妙想', '#habits': '习惯', '#learning': '学习', '#tasks': '日程', '#goals': '长期目标', '#backup': '数据备份', '#settings': '设置', '#categories': '分类管理', '#bill/new': '新增收支' })[target] || (task ? '日程详情' : target === '#today-record' ? '今日回顾' : note ? '妙想详情' : goal ? '目标详情' : habit ? '习惯详情' : entryRoute ? '记录详情' : '');
    const showRouteBack = !['#overview', '#records', '#finance', '#social', '#personal', '#bill/new'].includes(target);
    routeBackbar.classList.toggle('hidden', !showRouteBack);
    $('#route-back-title').textContent = notes ? ({'#notes':'笔记','#notes/new':'新建笔记','#notes/data':'笔记备份','#notes/setup':'连接Notion'})[target] || (target.startsWith('#notes/edit/')?'编辑笔记':'笔记详情') : health ? ({'#health':'健康','#health/history':'健康历史','#health/data':'健康数据','#health/demo':'健康演示'})[target] || '健康记录' : routeTitle;
    const fallback = social ? '#social' : target === '#monthly' ? '#personal' : financeView ? financeView.fallback : task ? '#tasks' : note || window.LifeIdeasUI.matches(target)&&target!=='#daily-notes' ? '#daily-notes' : goal ? '#goals' : habit ? '#habits' : entryRoute ? '#search' : ({ '#search':'#overview', '#daily-notes':'#records', '#habits':'#overview', '#goals':'#overview', '#learning':'#records', '#tasks':'#records', '#backup':'#personal', '#settings':'#personal', '#categories':'#finance', '#bill/new':'#finance' })[target] || '#overview';
    routeBackbar.dataset.fallback = notes ? target==='#notes'?'#overview':'#notes' : health ? target==='#health'?'#overview':'#health' : fallback;
    window.LifeUI.syncRoute(target, document.getElementById(visibleId));
    if (lastAnimatedSection !== target) {
      const visibleSection = document.getElementById(visibleId);
      if (visibleSection) {
        visibleSection.classList.remove('ios-page-enter');
        void visibleSection.offsetWidth;
        visibleSection.classList.add('ios-page-enter');
        window.setTimeout(() => visibleSection.classList.remove('ios-page-enter'), window.LifeUI.motionDuration('normal') + 20);
      }
      lastAnimatedSection = target;
    }
    $('#task-list-view').classList.toggle('hidden', task);
    $('#task-detail-view').classList.toggle('hidden', !task);
    window.LifeIdeasUI.route(target);
    $('#daily-notes-slot').classList.toggle('hidden', note);
    $('#daily-notes-section > .section-heading').classList.toggle('hidden', note);
    $('#note-detail').classList.toggle('hidden', !note);
    $('#goals-slot').classList.toggle('hidden', goal);
    $('#goals-section > .section-heading').classList.toggle('hidden', goal);
    $('#goal-detail').classList.toggle('hidden', !goal);
    const active = primaryMobileTarget(target);
    document.querySelectorAll('.main-nav .nav-link, .mobile-bottom-link').forEach((item) => {
      const selected = item.getAttribute('href') === active;
      item.classList.toggle('active', selected);
      if (selected) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
    });
    document.body.classList.toggle('month-view', target === '#monthly');
    document.body.classList.toggle('social-view', social);
    window.LifeSocialUI.route(target);
    window.LifeHealthUI.route(target);
    window.LifeNotesUI.route(target);
    document.body.classList.toggle('finance-view', target === '#finance');
    document.body.classList.toggle('bill-sheet-open', target === '#bill/new');
    const dateSlot = target === '#overview' ? '#overview-date-slot' : null;
    if (dateSlot && $(dateSlot)) $(dateSlot).append($('.date-control'));
    else $('#date-control-parking').append($('.date-control'));
    if (target === '#bill/new') { renderBillCategories(); requestAnimationFrame(() => window.LifeFinanceViews.billFocus()?.focus({ preventScroll: true })); }
    if (target === '#categories') renderCategories();
    if (target === '#monthly') renderInsights();
    if (target === '#search') renderGlobalSearch();
    if (window.LifeIdeasUI.matches(target)) renderDiary();
  }

  function handleHistoryNavigation() {
    if (history.state?.quickRecordSheet) {
      if (!quickSheetOpen) showQuickRecordSheet(true);
      return;
    }
    if (quickSheetOpen) { finishQuickRecordSheet(true); return; }
    const target = window.location.hash || '#overview';
    const closingBillSheet = document.body.classList.contains('bill-sheet-open') && target !== '#bill/new';
    activeUiReturn = history.state?.lifeReturn || null;
    if (target === '#today-record') activeDailyReturnRoute = activeUiReturn?.returnRoute || activeDailyReturnRoute;
    if (isTaskDetailRoute(target)) {
      activeTaskNavigation = history.state?.taskNavigation || activeTaskNavigation;
      runPageTransition(() => syncNavigation(target)); return;
    }
    const taskContext = activeTaskNavigation;
    runPageTransition(() => {
      syncNavigation(target);
      if (taskContext && target === taskContext.returnRoute) restoreTaskSource(taskContext);
      activeTaskNavigation = null;
      if (history.state?.viewSnapshot) restoreUiView(history.state.viewSnapshot);
      else if(window.LifeNotesUI.matches(target)){window.scrollTo({top:0,behavior:'auto'});rememberView();}
      else if (['#learning','#tasks','#social/search'].includes(target)||window.LifeHealthUI.matches(target)) rememberView();
      window.LifeIdeasUI.finishNavigation();
      if (closingBillSheet && billSheetReturnFocus instanceof HTMLElement) requestAnimationFrame(() => billSheetReturnFocus.focus({ preventScroll: true }));
      if (closingBillSheet) { $('#bill-section').classList.remove('bill-sheet-closing'); billClosePending = false; }
    });
  }

  document.querySelectorAll('.nav-link').forEach((link) => link.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openUiPage(link.getAttribute('href'));
  }));
  window.addEventListener('hashchange', handleHistoryNavigation);
  window.addEventListener('popstate', handleHistoryNavigation);

  $('#confirm-cancel').addEventListener('click', () => finishConfirmation(false));
  $('#confirm-accept').addEventListener('click', () => finishConfirmation(true));
  $('#confirm-dialog').addEventListener('cancel', (event) => { event.preventDefault(); finishConfirmation(false); });
  $('#confirm-dialog').addEventListener('close', () => { if (confirmationResolve) finishConfirmation(false); });
  $('#bill-form').addEventListener('submit', submitBill);
  document.querySelectorAll('input[name="bill-type"]').forEach((input) => input.addEventListener('change', renderBillCategories));
  $('#category-form').addEventListener('submit', submitCategory);
  $('#category-cancel').addEventListener('click', resetCategoryForm);
  $('#category-manage-type').addEventListener('change', () => { resetCategoryForm(); renderCategories(); });
  $('#finance-category-type').addEventListener('change', renderFinanceOverview);
  $('#finance-period').addEventListener('change', () => {
    const month = $('#finance-period').value;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return;
    $('#finance-history-anchor').value = month + '-01';
    $('#finance-history-range').value = 'month';
    historyPages.finance = 1;
    renderHistory('finance'); renderFinanceOverview();
  });
  $('#finance-history-anchor').addEventListener('change', () => { historyPages.finance = 1; renderHistory('finance'); });
  $('#finance-advanced-open').addEventListener('click', () => {
    resetRecordForm('finance');
    $('#finance-date').value = $('#finance-history-anchor').value || today();
    populateCategorySelect('#finance-income-category', 'income');
    populateCategorySelect('#finance-expense-category', 'expense');
    if ($('#finance-filter-dialog').open) window.LifeUI.closeSheet($('#finance-filter-dialog'),()=>$('#finance-editor').showModal());
    else $('#finance-editor').showModal();
  });
  $('#finance-editor').addEventListener('cancel', () => resetRecordForm('finance'));
  $('#diary-filter').addEventListener('change', () => { diaryPage = 1; renderDiary(); rememberView(); });
  $('#diary-filter-date').addEventListener('change', () => { diaryPage = 1; renderDiary(); rememberView(); });
  $('#insights-anchor').addEventListener('change', renderInsights);
  $('#insights-type').addEventListener('change',event=>{
    trendMetric=event.target.value;
    if(trendMetric!=='balance')rankingType=trendMetric;
    renderInsights();
  });
  $('#insights-now').addEventListener('click', () => { $('#insights-anchor').value = today(); renderInsights(); });
  ['#month-year', '#month-month'].forEach((selector) => $(selector).addEventListener('change', () => {
    if (insightsPeriod === 'month') {
      $('#insights-anchor').value = $('#month-year').value + '-' + $('#month-month').value + '-01';
      renderInsights();
    }
  }));

  $('#month-month').value = String(new Date().getMonth() + 1).padStart(2, '0');
  populateMonthYears();
  const directTask = data.tasks.find(task => task.id === taskIdFromRoute());
  const startingDate = isValidDate(history.state?.viewSnapshot?.fields?.['selected-date']) ? history.state.viewSnapshot.fields['selected-date'] : isValidDate(history.state?.homeDate) ? history.state.homeDate : directTask?.date || today();
  setFormDates(startingDate);
  learningViewDate = isValidDate(history.state?.viewSnapshot?.learning?.date) ? history.state.viewSnapshot.learning.date : startingDate;
  scheduleViewDate = isValidDate(history.state?.viewSnapshot?.schedule?.date) ? history.state.viewSnapshot.schedule.date : directTask?.date || startingDate;
  $('#finance-period').value = today().slice(0, 7);
  $('#finance-history-anchor').value = today();
  $('#bill-date').value = today();
  $('#insights-anchor').value = today();
  $('#diary-filter-date').value = today();
  $('#personal-date').value = today();
  $('#diary-date').value = today();
  $('#daily-record-date').value = today();
  fillDailyRecordForm(startingDate);
  $('#goal-date-input').value = today();
  fillPersonalSettingsForm();
  const metaRead = readFinanceMeta();
  financeMeta = metaRead.data || window.LifeFinanceMeta.blank(); financeMetaError = metaRead.error;
  window.LifeFinanceViews.configure({
    read: () => ({data,categories:categoryData,meta:financeMeta,metaError:financeMetaError,month:$('#finance-period').value || today().slice(0,7)}),
    open:openUiPage, makeId, confirm:confirmAction, saveMeta:saveFinanceMeta, refreshBill:renderBillCategories, clearDraft:id=>otherDraftForms.delete(id),
    chooseMonth:openFinanceMonth,
    showFinanceMonth:month=>{ $('#finance-period').value=month; $('#finance-period').dispatchEvent(new Event('change')); },
  });
  window.LifeIdeasUI.init({
    notes:()=>personalData.diary, refresh:renderDiary, remember:rememberView, firstPage:()=>{diaryPage=1;},
    open:openUiPage, replace:replaceUiRoute, back:returnUiPage, edit:beginNoteEdit, remove:deleteSelectedIdeas,
    draft:readIdeaDraft, restoreDraft:restoreIdeaDraft, resetDraft:resetIdeaForm,
    reveal:id=>{
      const filtered=Boolean($('#idea-query').value.trim()||$('#idea-tag-filter').value||$('#diary-filter').value==='date');
      $('#idea-query').value=$('#idea-tag-filter').value='';$('#diary-filter').value='all';
      diaryPage=1;
      $('#diary-list').scrollTop=0;if(filtered)toast('妙想已保存 · 已清除列表条件以显示新记录');
    },
  });
  window.LifeScheduleUI.init({
    date:scheduleDate, today, makeId, meta:()=>scheduleMeta, refresh:render, remember:rememberView,
    chooseDate:date=>chooseModuleDate('schedule',date),
    restoreDate:date=>{if(isValidDate(date)&&location.hash==='#tasks')scheduleViewDate=date;},
    saveSeries:saveScheduleSeries, generate:generateScheduleSeries, toggleSeries:toggleScheduleSeries,
    confirm:confirmAction, hasDraft:id=>otherDraftForms.has(id), clearDraft:id=>otherDraftForms.delete(id),
  });
  window.LifeLearningUI.init({
    date:learningDate, today, read:()=>({data,meta:learningMeta,schedule:scheduleMeta}), remember:rememberView,
    chooseDate:date=>chooseModuleDate('learning',date),
    restoreDate:date=>{if(isValidDate(date)&&location.hash==='#learning')learningViewDate=date;},
    goal:saveLearningGoal, plan:saveLearningPlan, archive:archiveLearningPlan, focus:focusAction, newRecord:newLearningRecord,
    confirm:confirmAction, toast, open:openUiPage, hasDraft:id=>otherDraftForms.has(id), clearDraft:id=>otherDraftForms.delete(id), markDraft:id=>otherDraftForms.add(id),
  });
  $('#finance-month-open').addEventListener('click',openFinanceMonth);
  $('#finance-month-cancel').addEventListener('click',()=>closeFinanceMonth(false));
  $('#finance-month-confirm').addEventListener('click',()=>closeFinanceMonth(true));
  $('#finance-month-dialog').addEventListener('cancel',event=>{event.preventDefault();closeFinanceMonth(false);});
  window.LifeSocialUI.init({open:openUiPage,remember:rememberView,toast,profile:()=>personalData.profile});
  routeSectionIds['#health']='health-section';
  window.LifeHealthUI.init({today,makeId,read:()=>window.LifeHealth.read(localStorage),save:saveHealth,open:openUiPage,remember:rememberView,toast,confirm:confirmAction,refreshHome:renderWorkspaceHome,markDraft:id=>otherDraftForms.add(id),clearDraft:id=>otherDraftForms.delete(id)});
  routeSectionIds['#notes']='notes-section';
  window.LifeNotesUI.init({makeId,read:()=>window.LifeNotes.read(localStorage),save:saveNotes,open:openUiPage,back:returnUiPage,remember:rememberView,toast,confirm:confirmAction,refreshHome:renderWorkspaceHome,markDraft:id=>otherDraftForms.add(id),clearDraft:id=>otherDraftForms.delete(id)});
  render();
  renderBillCategories();
  syncNavigation(window.location.hash || '#overview');
  if (history.state?.viewSnapshot) restoreUiView(history.state.viewSnapshot);
  if (history.state?.quickRecordSheet) showQuickRecordSheet(true);
})();
