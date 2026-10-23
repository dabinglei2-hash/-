/* One workspace over canonical study records and schedule tasks; app.js owns writes. */
(function (root) {
  'use strict';
  const L = root.LifeLearning, $ = selector => document.querySelector(selector);
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  let config, state = { view: 'home', status: 'all', scope: 'selected', period: 'week' }, planExpected = null, busy = false, focusIdentity = '', goalDraftDate = '';
  const label = { running: '专注中 · 后台继续', paused: '已暂停', ended: '待确认保存', saved: '已保存', cancelled: '已取消' };
  function snapshot() { return { ...state, recordsOpen: $('#learning-records').open }; }
  function restore(value) {
    if (!value || typeof value !== 'object') return;
    if (['home', 'plans', 'focus', 'stats'].includes(value.view)) state.view = value.view;
    if (['all', 'open', 'done'].includes(value.status)) state.status = value.status;
    if (['selected', 'all'].includes(value.scope)) state.scope = value.scope;
    if (['week', 'month'].includes(value.period)) state.period = value.period;
    if (typeof value.recordsOpen === 'boolean') $('#learning-records').open = value.recordsOpen;
  }
  function chooseView(view) { state.view = view; render(); config.remember(); }
  function showRecords(focus = false) {
    state.view = 'home'; $('#learning-records').open = true; render(); config.remember();
    if (focus) $('#study-form').scrollIntoView({ block: 'start', behavior: 'auto' });
  }
  function status(id, text, error = false) { const node = $('#' + id); node.textContent = text; node.classList.toggle('is-error', Boolean(error)); }
  function init(options) {
    config = options;
    const section = $('#learning'), oldHeading = section.querySelector('.section-heading'), oldGrid = section.querySelector('.content-grid');
    const workspace = document.createElement('div'); workspace.id = 'learning-workspace';
    workspace.innerHTML = '<header class="learning-heading"><h2 class="sr-only">学习工作台</h2><div id="learning-date-toolbar"></div></header>'
      + '<div class="segmented learning-tabs" role="tablist" aria-label="学习工作台">' + [['home','首页'],['plans','计划'],['focus','专注'],['stats','统计']].map(([key,text]) => '<button type="button" id="learning-tab-' + key + '" role="tab" aria-controls="learning-view-' + key + '" data-learning-view="' + key + '">' + text + '</button>').join('') + '</div>'
      + '<section id="learning-view-home" role="tabpanel" aria-labelledby="learning-tab-home"><div class="learning-hero"><span id="learning-scope"></span><strong id="learning-actual"></strong><span id="learning-target-summary"></span><progress id="learning-goal-progress" max="100" value="0" aria-label="学习目标完成进度"></progress></div>'
      + '<div class="learning-actions"><button type="button" class="primary-button" data-learning-focus="">开始学习</button><button type="button" class="secondary-button" data-learning-new-record="">新增记录</button></div>'
      + '<details class="compose-details" id="learning-goal-editor"><summary>当天学习目标</summary><form id="learning-goal-form" class="learning-inline-form"><label>分钟<input id="learning-goal" type="number" min="1" max="1440" step="1" placeholder="未设置"></label><button type="submit" class="secondary-button">保存目标</button><button type="button" class="text-button" id="learning-goal-remove">移除</button></form><p id="learning-goal-status" role="status"></p></details>'
      + '<div class="learning-subheading"><h3>最近学习</h3><button class="text-button" type="button" id="learning-history-open">全部记录</button></div><div id="learning-recent"></div><p id="learning-home-plan" class="subtle-copy"></p></section>'
      + '<section id="learning-view-plans" role="tabpanel" aria-labelledby="learning-tab-plans"><div class="learning-subheading"><h3>学习计划</h3><button type="button" class="secondary-button" id="learning-plan-new">新增计划</button></div>'
      + '<div class="learning-filters"><label><span class="sr-only">计划状态</span><select id="learning-plan-status"><option value="all">全部状态</option><option value="open">待学习</option><option value="done">已完成</option></select></label><label><span class="sr-only">计划日期范围</span><select id="learning-plan-scope"><option value="selected">所选日期</option><option value="all">所有日期</option></select></label></div>'
      + '<p id="learning-plan-summary" class="subtle-copy"></p><div id="learning-plan-list" tabindex="0" aria-label="学习计划列表"></div><a href="#tasks" data-open-page class="text-button">打开日程</a>'
      + '<details id="learning-plan-editor" class="compose-details"><summary id="learning-plan-editor-title">新增或关联日程</summary><form id="learning-plan-form" class="form-stack"><input id="learning-plan-id" type="hidden"><label>关联已有日程 <span class="label-hint">可选</span><select id="learning-plan-link"><option value="">新建日程任务</option></select></label><div id="learning-plan-task-fields" class="form-stack"><label>学习主题<input id="learning-plan-title" maxlength="120" required></label><div class="form-row"><label>计划日期<input id="learning-plan-date" type="date" required></label><label>优先级<select id="learning-plan-priority"><option value="">未设置</option><option value="low">低</option><option value="medium">中</option><option value="high">高</option></select></label></div></div><label>预计分钟<input id="learning-plan-minutes" type="number" min="1" max="1440" step="1" required></label><p class="subtle-copy">计划保存在同一份日程中；预计时长不计入实际学习。</p><div class="learning-actions"><button type="submit" class="primary-button">保存计划</button><button type="button" class="secondary-button" id="learning-plan-cancel">取消编辑</button></div><p id="learning-plan-form-status" role="status"></p></form></details></section>'
      + '<section id="learning-view-focus" role="tabpanel" aria-labelledby="learning-tab-focus"><form id="learning-focus-form" class="form-stack"><label>关联学习计划 <span class="label-hint">可选</span><select id="learning-focus-plan"><option value="">自由学习</option></select></label><label>学习主题<input id="learning-focus-title" maxlength="100" required placeholder="这次想学什么？"></label><button type="submit" class="primary-button">开始计时</button></form>'
      + '<section id="learning-focus-active" class="hidden"><h3 id="learning-focus-subject"></h3><p id="learning-focus-label" class="subtle-copy"></p><output id="learning-clock" class="learning-clock" aria-label="专注累计时间">00:00:00</output><div id="learning-focus-controls" class="learning-actions"></div><div id="learning-focus-confirm" class="hidden"><label>实际记录日期<input id="learning-focus-date" type="date"></label><p id="learning-focus-minutes" class="subtle-copy"></p><button type="button" class="primary-button" id="learning-focus-save">确认保存学习记录</button></div></section><p id="learning-focus-status" role="status"></p><p class="subtle-copy">计时按时间差计算，刷新或离开后仍保留。结束后确认保存才计入实际时长。</p><div id="learning-focus-last" class="subtle-copy"></div></section>'
      + '<section id="learning-view-stats" role="tabpanel" aria-labelledby="learning-tab-stats"><h3>实际学习</h3><div id="learning-stats-metrics" class="learning-metrics"></div><p id="learning-stats-goal" class="subtle-copy"></p><div class="segmented learning-period"><button type="button" data-learning-period="week">本周</button><button type="button" data-learning-period="month">本月</button></div><p id="learning-trend-range" class="subtle-copy"></p><div id="learning-trend" class="learning-trend" role="img" aria-label="每日实际学习趋势"></div><details class="compose-details"><summary>每日分钟明细</summary><div id="learning-trend-detail"></div></details><p id="learning-stats-plan" class="subtle-copy"></p><div id="learning-stats-recent"></div></section>';
    section.prepend(workspace);
    $('#learning-date-toolbar').append($('#learning-date-slot'));
    const todayButton = document.createElement('button'); todayButton.type = 'button'; todayButton.className = 'text-button'; todayButton.textContent = '今天'; todayButton.id = 'learning-today';
    todayButton.addEventListener('click', () => config.chooseDate(config.today())); $('#learning-date-toolbar').append(todayButton);
    const records = document.createElement('details'); records.id = 'learning-records'; records.className = 'compose-details';
    records.innerHTML = '<summary>学习记录与历史</summary>'; section.append(records); records.append(oldHeading, oldGrid);
    oldHeading.querySelector('h2').textContent = '学习记录';
    section.addEventListener('click', handleClick);
    $('.learning-tabs').addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      const views = ['home','plans','focus','stats'], index = views.indexOf(state.view);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (index + (event.key === 'ArrowRight' ? 1 : 3)) % 4;
      event.preventDefault(); chooseView(views[next]); $('#learning-tab-' + views[next]).focus();
    });
    $('#learning-goal-form').addEventListener('submit', event => {
      event.preventDefault(); const date = goalDraftDate || config.date(), error = config.goal(date, $('#learning-goal').value);
      status('learning-goal-status', error || date + ' 目标已保存', error);
      if (!error) { config.clearDraft('learning-goal-form'); goalDraftDate = ''; render(); }
    });
    $('#learning-goal').addEventListener('input', () => { if (!goalDraftDate) goalDraftDate = config.date(); });
    $('#learning-focus-date').addEventListener('input', () => config.markDraft('learning-focus-confirm'));
    $('#learning-plan-form').addEventListener('submit', event => {
      event.preventDefault(); const error = config.plan({ id: $('#learning-plan-id').value, linkId: $('#learning-plan-link').value,
        title: $('#learning-plan-title').value, date: $('#learning-plan-date').value, priority: $('#learning-plan-priority').value,
        estimatedMinutes: $('#learning-plan-minutes').value }, planExpected);
      status('learning-plan-form-status', error || '计划已保存到日程', error);
      if (!error) { resetPlan(); config.toast('学习计划已保存'); }
    });
    $('#learning-focus-form').addEventListener('submit', event => {
      event.preventDefault(); action('start', { taskId: $('#learning-focus-plan').value, title: $('#learning-focus-title').value });
    });
    $('#learning-plan-link').addEventListener('change', updatePlanFields);
    $('#learning-focus-plan').addEventListener('change', () => {
      const task = config.read().data.tasks.find(row => row.id === $('#learning-focus-plan').value);
      if (task && task.title.length <= 100) $('#learning-focus-title').value = task.title;
      else if (task) status('learning-focus-status', '日程标题较长，请为本次计时填写不超过100字的主题。');
    });
    ['status', 'scope'].forEach(name => $('#learning-plan-' + name).addEventListener('change', event => { state[name] = event.target.value; render(); config.remember(); }));
    records.addEventListener('toggle', () => config.remember());
    document.addEventListener('visibilitychange', tick);
    setInterval(tick, 1000); // Display only. No writes or accumulated per-second counters.
  }
  function updatePlanFields() {
    const linking = Boolean($('#learning-plan-link').value);
    $('#learning-plan-task-fields').classList.toggle('hidden', linking);
    $('#learning-plan-title').required = $('#learning-plan-date').required = !linking;
  }
  function resetPlan() {
    $('#learning-plan-form').reset(); $('#learning-plan-id').value = ''; planExpected = null;
    $('#learning-plan-link').disabled = false; $('#learning-plan-editor-title').textContent = '新增或关联日程';
    $('#learning-plan-date').value = config.date(); config.clearDraft('learning-plan-form'); updatePlanFields();
  }
  async function editPlan(id) {
    if (config.hasDraft('learning-plan-form') && !await config.confirm('放弃当前计划输入，编辑所选计划？')) return;
    const { data, meta, schedule } = config.read(), task = data.tasks.find(row => row.id === id), plan = meta.plans.find(row => row.taskId === id && !row.archived);
    if (!task || !plan) { config.toast('计划已不存在', true); return; }
    resetPlan(); $('#learning-plan-id').value = id; $('#learning-plan-title').value = task.title;
    $('#learning-plan-date').value = task.date; $('#learning-plan-minutes').value = plan.estimatedMinutes;
    const detail = root.LifeSchedule.detailFor(schedule, id); $('#learning-plan-priority').value = detail.priority || '';
    $('#learning-plan-link').disabled = true; planExpected = JSON.stringify({ task, plan, detail });
    $('#learning-plan-editor-title').textContent = '编辑学习计划'; $('#learning-plan-editor').open = true;
    $('#learning-plan-title').focus();
  }
  function prepareFocus(taskId = '') {
    chooseView('focus');
    if (L.active(config.read().meta)) return;
    $('#learning-focus-plan').value = taskId;
    const task = config.read().data.tasks.find(row => row.id === taskId);
    if (task?.title.length <= 100) $('#learning-focus-title').value = task.title;
    else if (task) { $('#learning-focus-title').value = ''; status('learning-focus-status', '日程标题较长，请填写不超过100字的计时主题。'); }
    $('#learning-focus-title').focus();
  }
  async function action(name, fields = {}) {
    if (busy) return;
    busy = true;
    try {
      if (name === 'cancel' && !await config.confirm('取消本次计时？将保留计时历史，不生成学习记录。', '取消计时', '确认取消')) return;
      if (name === 'save' && !await config.confirm('将完整分钟保存为一条实际学习记录？不会自动完成日程。', '保存实际学习', '确认保存')) return;
      const error = config.focus(name, fields);
      status('learning-focus-status', error || ({ start:'计时已开始', pause:'计时已暂停', resume:'计时已继续', end:'成果已保留，请确认保存', save:'实际学习记录已保存', cancel:'计时已取消，未生成记录' })[name], error);
      if (!error) { config.clearDraft('learning-focus-form'); config.clearDraft('learning-focus-confirm'); config.toast(name === 'save' ? '学习记录已保存 · 统计已更新' : '计时状态已保存'); render(); }
    } finally { busy = false; }
  }
  async function handleClick(event) {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.learningView) chooseView(button.dataset.learningView);
    else if (button.hasAttribute('data-learning-focus')) prepareFocus(button.dataset.learningFocus);
    else if (button.hasAttribute('data-learning-new-record')) config.newRecord(button.dataset.learningNewRecord);
    else if (button.id === 'learning-history-open') showRecords(true);
    else if (button.id === 'learning-goal-remove') {
      const date = goalDraftDate || config.date(), error = config.goal(date, ''); status('learning-goal-status', error || date + ' 目标已移除，记录保留', error);
      if (!error) { $('#learning-goal').value = ''; config.clearDraft('learning-goal-form'); goalDraftDate = ''; render(); }
    } else if (button.id === 'learning-plan-new' || button.id === 'learning-plan-cancel') {
      if (config.hasDraft('learning-plan-form') && !await config.confirm('放弃当前计划输入？')) return;
      resetPlan(); $('#learning-plan-editor').open = button.id === 'learning-plan-new';
      if ($('#learning-plan-editor').open) $('#learning-plan-title').focus();
    } else if (button.dataset.learningEdit) editPlan(button.dataset.learningEdit);
    else if (button.dataset.learningArchive) {
      if (!await config.confirm('取消此学习关联？日程任务、完成状态和实际学习记录都会保留。')) return;
      const error = config.archive(button.dataset.learningArchive); config.toast(error || '学习关联已取消，日程保留', Boolean(error));
    } else if (button.dataset.learningAction) action(button.dataset.learningAction);
    else if (button.id === 'learning-focus-save') action('save', { date: $('#learning-focus-date').value });
    else if (button.dataset.learningPeriod) { state.period = button.dataset.learningPeriod; render(); config.remember(); }
    else if (button.dataset.learningRecord) config.open('#entry/study/' + encodeURIComponent(button.dataset.learningRecord));
  }
  function recordRows(rows) {
    return rows.length ? rows.map(row => '<button type="button" class="learning-record-row" data-learning-record="' + esc(row.id) + '"><span><strong>' + esc(row.content) + '</strong><small>' + esc(row.date) + '</small></span><span>' + row.duration + ' 分</span></button>').join('') : '<p class="empty-state">这段时间还没有学习记录。</p>';
  }
  function render() {
    if (!config) return;
    const { data, meta, schedule } = config.read(), date = config.date(), isToday = date === config.today();
    document.querySelectorAll('[data-learning-view]').forEach(button => {
      const selected = button.dataset.learningView === state.view; button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
    });
    ['home','plans','focus','stats'].forEach(view => $('#learning-view-' + view).classList.toggle('hidden', view !== state.view));
    $('#learning-records').classList.toggle('hidden', state.view !== 'home');
    const actual = data.studies.filter(row => row.date === date).reduce((sum, row) => sum + row.duration, 0), goal = meta.dailyGoals.find(row => row.date === date)?.minutes;
    $('#learning-scope').textContent = (isToday ? '今日' : date + ' · 当日') + '实际学习';
    $('#learning-actual').textContent = actual + ' 分钟';
    $('#learning-target-summary').textContent = goal ? '目标 ' + goal + ' 分钟 · 完成 ' + Math.round(actual / goal * 100) + '%' : '当天尚未设置目标';
    $('#learning-goal-progress').value = goal ? Math.min(100, actual / goal * 100) : 0;
    if (!config.hasDraft('learning-goal-form')) $('#learning-goal').value = goal || '';
    $('#learning-goal-form button[type="submit"]').textContent = goalDraftDate && goalDraftDate !== date ? '保存 ' + goalDraftDate + ' 目标' : '保存目标';
    const recent = data.studies.filter(row => row.date <= date).slice().sort((a,b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0,3);
    $('#learning-recent').innerHTML = recordRows(recent);
    const plans = meta.plans.filter(row => !row.archived).map(plan => ({ ...plan, task: data.tasks.find(row => row.id === plan.taskId) })).filter(row => row.task);
    const dayPlans = plans.filter(row => row.task.date === date), planned = dayPlans.reduce((sum,row) => sum + row.estimatedMinutes,0);
    $('#learning-home-plan').textContent = '当日计划 ' + dayPlans.length + ' 项 · 预计 ' + planned + ' 分钟（不计入实际）';
    $('#learning-plan-status').value = state.status; $('#learning-plan-scope').value = state.scope;
    const visible = plans.filter(row => (state.scope === 'all' || row.task.date === date) && (state.status === 'all' || row.task.completed === (state.status === 'done'))).sort((a,b) => a.task.date.localeCompare(b.task.date) || root.LifeSchedule.compare(a.task,b.task));
    $('#learning-plan-summary').textContent = (state.scope === 'all' ? '所有日期' : date) + ' · ' + visible.length + ' 项；完成状态与日程同步';
    $('#learning-plan-list').innerHTML = visible.map(row => '<article class="learning-plan-row"><div class="learning-plan-main"><label class="learning-check"><input type="checkbox" data-toggle-task="' + esc(row.taskId) + '"' + (row.task.completed ? ' checked' : '') + ' aria-label="完成 ' + esc(row.task.title) + '"></label><button type="button" class="learning-plan-title" data-open-task="' + esc(row.taskId) + '"><strong>' + esc(row.task.title) + '</strong><small>' + row.task.date + ' · 预计 ' + row.estimatedMinutes + ' 分钟' + (root.LifeScheduleUI.priorityLabel(root.LifeSchedule.detailFor(schedule,row.taskId).priority) ? ' · ' + root.LifeScheduleUI.priorityLabel(root.LifeSchedule.detailFor(schedule,row.taskId).priority) : '') + '</small></button></div><div class="learning-plan-actions"><button type="button" class="secondary-button" data-learning-focus="' + esc(row.taskId) + '">专注</button><button type="button" class="text-button" data-learning-new-record="' + esc(row.taskId) + '">记时长</button><button type="button" class="text-button" data-learning-edit="' + esc(row.taskId) + '">编辑</button><button type="button" class="text-button" data-learning-archive="' + esc(row.taskId) + '">取消关联</button></div></article>').join('') || '<p class="empty-state">当前条件下没有学习计划。可以新建或关联已有日程。</p>';
    // Preserve user selections and drafts when canonical lists refresh.
    const link = $('#learning-plan-link'), oldLink = link.value, focus = $('#learning-focus-plan'), oldFocus = focus.value;
    link.innerHTML = '<option value="">新建日程任务</option>' + data.tasks.filter(task => !plans.some(row => row.taskId === task.id)).map(task => '<option value="' + esc(task.id) + '">' + esc(task.date + ' · ' + task.title) + '</option>').join('');
    link.value = oldLink; updatePlanFields();
    focus.innerHTML = '<option value="">自由学习</option>' + plans.map(row => '<option value="' + esc(row.taskId) + '">' + esc(row.task.date + ' · ' + row.task.title) + '</option>').join(''); focus.value = oldFocus;
    if (!$('#learning-plan-date').value) $('#learning-plan-date').value = date;
    renderFocus(meta); renderStats(data, date, actual, goal, plans);
  }
  function renderFocus(meta) {
    const session = L.active(meta), identity = session?.id || '';
    $('#learning-focus-form').classList.toggle('hidden', Boolean(session)); $('#learning-focus-active').classList.toggle('hidden', !session);
    if (session) {
      $('#learning-focus-subject').textContent = session.title; $('#learning-focus-label').textContent = label[session.status];
      if (identity !== focusIdentity) $('#learning-focus-date').value = session.date;
      $('#learning-focus-controls').innerHTML = (session.status === 'running' ? [['pause','暂停'],['end','结束']] : session.status === 'paused' ? [['resume','继续'],['end','结束']] : [['resume','继续计时']]).concat([['cancel','取消计时']]).map(([action,text]) => '<button type="button" class="secondary-button" data-learning-action="' + action + '">' + text + '</button>').join('');
      $('#learning-focus-confirm').classList.toggle('hidden', session.status !== 'ended');
      $('#learning-focus-minutes').textContent = '将保存 ' + Math.floor(session.accumulatedMs / 60000) + ' 个完整分钟；零头保留在计时历史。尚未计入实际学习。';
    }
    focusIdentity = identity;
    const last = meta.focusSessions.filter(row => !L.unresolved(row)).slice(-1)[0];
    $('#learning-focus-last').textContent = last ? '上次：' + last.title + ' · ' + label[last.status] + (last.recordDeleted ? '（对应记录已删除，不会重新生成）' : '') : '';
    tick();
  }
  function tick() {
    if (!config) return; const session = L.active(config.read().meta); if (!session) return;
    const result = L.elapsed(session, Date.now()), seconds = Math.floor(result.ms / 1000);
    $('#learning-clock').textContent = [Math.floor(seconds / 3600),Math.floor(seconds / 60) % 60,seconds % 60].map(value => String(value).padStart(2,'0')).join(':');
    if (result.error) status('learning-focus-status',result.error,true);
  }
  function renderStats(data,date,actual,goal,plans) {
    const week = root.LifeInsights.summarize(data,'week',date), month = root.LifeInsights.summarize(data,'month',date);
    $('#learning-stats-metrics').innerHTML = [[date === config.today() ? '今日' : '当日',actual],[date === config.today() ? '本周' : '当周',week.totals.studyMinutes],[date === config.today() ? '本月' : '当月',month.totals.studyMinutes]].map(([text,value]) => '<div><small>' + text + '</small><strong>' + value + '<span> 分</span></strong></div>').join('');
    $('#learning-stats-goal').textContent = date + ' · ' + (goal ? '目标完成 ' + Math.round(actual / goal * 100) + '%（' + actual + '/' + goal + ' 分）' : '未设置当日目标');
    const summary = state.period === 'week' ? week : month, max = Math.max(1,...summary.buckets.map(row=>row.studyMinutes));
    document.querySelectorAll('[data-learning-period]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.learningPeriod === state.period)); });
    $('#learning-trend-range').textContent = summary.start + ' 至 ' + summary.end + ' · ' + summary.totals.studyMinutes + ' 分钟';
    $('#learning-trend').innerHTML = summary.buckets.map((row,index) => '<div title="' + esc(row.start + '：' + row.studyMinutes + ' 分钟') + '"><span style="height:' + Math.round(row.studyMinutes / max * 100) + '%"></span><small>' + (summary.buckets.length <= 7 || index % 5 === 0 ? esc(row.label) : '') + '</small></div>').join('');
    $('#learning-trend').setAttribute('aria-label', '实际学习趋势：' + summary.totals.studyMinutes + ' 分钟。完整数据见下方每日分钟明细。');
    $('#learning-trend-detail').innerHTML = summary.buckets.map(row => '<div class="learning-detail-row"><span>' + row.start + '</span><span>' + row.studyMinutes + ' 分</span></div>').join('');
    const rangePlans = plans.filter(row => row.task.date >= summary.start && row.task.date <= summary.end);
    $('#learning-stats-plan').textContent = '该周期计划 ' + rangePlans.length + ' 项 · 预计 ' + rangePlans.reduce((sum,row)=>sum+row.estimatedMinutes,0) + ' 分钟；未计入以上实际统计。';
    $('#learning-stats-recent').innerHTML = recordRows(data.studies.filter(row=>row.date >= summary.start && row.date <= summary.end).slice().sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt).slice(0,5));
  }
  root.LifeLearningUI = { init, render, snapshot, restore, showRecords, prepareFocus, home: () => chooseView('home') };
})(window);
