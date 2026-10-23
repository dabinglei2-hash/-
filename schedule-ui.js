/* A view of the existing task array; all writes are delegated to app.js. */
(function (root) {
  'use strict';
  const S = root.LifeSchedule, $ = selector => document.querySelector(selector);
  const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const icon = name => root.LifeIcons.render(name);
  let config, state = { view: 'day', month: '', status: 'all', scope: 'selected' }, lastDate = '', repeatExpected = null;
  const priorityLabel = value => ({ low: '低优先级', medium: '中优先级', high: '高优先级' })[value] || '';
  function snapshot() { return { ...state }; }
  function restore(value) {
    if (!value || typeof value !== 'object') return;
    if (['day', 'calendar', 'todo'].includes(value.view)) state.view = value.view;
    if (S.dateValid(value.month + '-01')) state.month = value.month;
    if (['all', 'open', 'done'].includes(value.status)) state.status = value.status;
    if (['selected', 'all'].includes(value.scope)) state.scope = value.scope;
    lastDate = config.date();
  }
  function init(options) {
    config = options;
    const toolbar = document.createElement('div');
    toolbar.id = 'schedule-toolbar';
    toolbar.innerHTML = '<div class="schedule-dates"><button type="button" class="ui-icon-button" data-schedule-day="-1" aria-label="查看前一天">' + icon('back') + '</button><div id="schedule-date-slot"></div><button type="button" class="ui-icon-button" data-schedule-day="1" aria-label="查看后一天">' + icon('chevronRight') + '</button><button type="button" class="secondary-button" id="schedule-today">今天</button></div>'
      + '<div class="segmented schedule-tabs" role="tablist" aria-label="日程视图"><button type="button" id="schedule-tab-day" role="tab" data-schedule-view="day" aria-controls="schedule-content">今日</button><button type="button" id="schedule-tab-calendar" role="tab" data-schedule-view="calendar" aria-controls="schedule-content">日历</button><button type="button" id="schedule-tab-todo" role="tab" data-schedule-view="todo" aria-controls="schedule-content">待办</button></div>'
      + '<section id="schedule-calendar" class="hidden" aria-label="月历"><div class="schedule-month-heading"><button type="button" class="ui-icon-button" data-schedule-month="-1" aria-label="上个月">' + icon('back') + '</button><h3 id="schedule-month-title"></h3><button type="button" class="ui-icon-button" data-schedule-month="1" aria-label="下个月">' + icon('chevronRight') + '</button></div><div class="schedule-weekdays" aria-hidden="true">' + ['一','二','三','四','五','六','日'].map(day => '<span>' + day + '</span>').join('') + '</div><div id="schedule-month-grid" class="schedule-month-grid" aria-label="选择日程日期"></div></section>';
    $('#task-list-view').prepend(toolbar);
    $('#schedule-date-slot').append($('#tasks-date-slot'));
    const content = document.createElement('div'); content.id = 'schedule-content'; content.setAttribute('role', 'tabpanel');
    $('#task-list-view .content-grid').before(content); content.append($('#task-list-view .content-grid'));
    const filters = document.createElement('div'); filters.className = 'schedule-filters';
    filters.innerHTML = '<label><span class="sr-only">日程完成状态</span><select id="schedule-status"><option value="all">全部状态</option><option value="open">未完成</option><option value="done">已完成</option></select></label><label id="schedule-scope-label" class="hidden"><span class="sr-only">待办日期范围</span><select id="schedule-scope"><option value="selected">所选日期</option><option value="all">所有日期</option></select></label><button class="text-button hidden" type="button" id="schedule-clear">清除筛选</button>';
    $('#task-list').before(filters);
    $('#task-list').tabIndex = 0; $('#task-list').setAttribute('aria-label', '日程列表');
    $('#task-list').setAttribute('aria-describedby', 'schedule-list-summary');
    const summary = document.createElement('p'); summary.id = 'schedule-list-summary'; summary.className = 'subtle-copy'; summary.setAttribute('aria-live', 'polite');
    filters.after(summary);
    const progress = document.createElement('div'); progress.id = 'schedule-progress'; progress.className = 'task-progress-track';
    progress.setAttribute('role', 'progressbar'); progress.setAttribute('aria-label', '所选日期日程完成率'); progress.setAttribute('aria-valuemin', '0'); progress.setAttribute('aria-valuemax', '100'); progress.innerHTML = '<span></span>';
    $('#task-list-view .section-heading').after(progress);
    const durationChoices = document.createElement('div'); durationChoices.className = 'schedule-durations';
    durationChoices.innerHTML = '<span>计划时长</span>' + [15,30,60,90].map(value => '<button class="secondary-button" type="button" data-schedule-duration="' + value + '">' + value + ' 分</button>').join('');
    $('#task-end').closest('.form-row').after(durationChoices);
    const detailFields = document.createElement('div'); detailFields.className = 'schedule-detail-fields';
    detailFields.innerHTML = '<div class="form-row"><label>优先级<select id="task-priority"><option value="">未设置</option><option value="low">低</option><option value="medium">中</option><option value="high">高</option></select></label><label>截止日期<input id="task-deadline" type="date"></label></div><label>备注 <span class="label-hint">可选</span><textarea id="task-note" rows="2" maxlength="2000" placeholder="补充计划信息"></textarea></label><p class="form-status" id="task-form-status" role="status"></p>';
    durationChoices.after(detailFields);
    const routines = document.createElement('details'); routines.id = 'schedule-routines'; routines.className = 'compose-details';
    routines.innerHTML = '<summary>重复与例行 <span class="soft-badge" id="schedule-series-count">0 项</span></summary><div class="schedule-routine-body"><button class="secondary-button" id="schedule-repeat-new" type="button">' + icon('add') + ' 新建重复规则</button><div id="schedule-series-list"></div></div>';
    content.after(routines);
    const sheet = document.createElement('dialog'); sheet.id = 'schedule-repeat-dialog'; sheet.className = 'editor-dialog ui-sheet'; sheet.setAttribute('aria-labelledby', 'schedule-repeat-title');
    sheet.innerHTML = '<div class="sheet-heading ui-sheet-header"><h2 id="schedule-repeat-title">重复规则</h2><button type="button" class="ui-icon-button" id="schedule-repeat-close" aria-label="关闭重复规则">' + icon('close') + '</button></div><form id="schedule-repeat-form" class="form-stack"><input type="hidden" id="repeat-id"><label>标题<input id="repeat-title" maxlength="120" required></label><div class="form-row"><label>开始日期<input id="repeat-start-date" type="date" required></label><label>结束日期<input id="repeat-end-date" type="date" required></label></div><fieldset class="schedule-repeat-week"><legend>重复星期</legend>' + ['一','二','三','四','五','六','日'].map((day,index) => '<label><input type="checkbox" name="repeat-weekday" value="' + (index + 1) + '" checked><span>' + day + '</span></label>').join('') + '</fieldset><div class="form-row"><label>计划开始<input id="repeat-start" type="time"></label><label>计划结束<input id="repeat-end" type="time"></label></div><div class="form-row"><label>优先级<select id="repeat-priority"><option value="">未设置</option><option value="low">低</option><option value="medium">中</option><option value="high">高</option></select></label><label>截止日延后天数<input id="repeat-deadline-offset" type="number" min="0" max="366" step="1" placeholder="可选"></label></div><label>备注<textarea id="repeat-note" rows="2" maxlength="2000"></textarea></label><p class="subtle-copy">最多366天。保存规则后手动确认生成；修改规则不会改写已有日程。</p><p id="repeat-status" class="form-status" role="status"></p><button id="repeat-save" class="primary-button" type="submit">保存规则</button></form>';
    document.body.append(sheet);
    sheet.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const controls = [...sheet.querySelectorAll('button:not(:disabled),input:not([type="hidden"]):not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')]
        .filter(element => element.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    toolbar.addEventListener('click', event => {
      const view = event.target.closest('[data-schedule-view]'), day = event.target.closest('[data-schedule-day]'), month = event.target.closest('[data-schedule-month]'), date = event.target.closest('[data-schedule-date]');
      if (view) { state.view = view.dataset.scheduleView; $('#task-list').scrollTop = 0; refresh(); }
      else if (day) config.chooseDate(S.addDays(config.date(), Number(day.dataset.scheduleDay)));
      else if (month) {
        const [year, number] = state.month.split('-').map(Number), target = new Date(state.month + '-01T00:00:00Z');
        target.setUTCFullYear(year, number - 1 + Number(month.dataset.scheduleMonth), 1);
        const next = target.toISOString().slice(0, 10); if (S.dateValid(next)) config.chooseDate(next);
      } else if (date) config.chooseDate(date.dataset.scheduleDate);
    });
    $('.schedule-tabs').addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const tabs = [...$('.schedule-tabs').children], index = tabs.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowLeft' ? 2 : 1)) % 3;
      tabs[next].click(); tabs[next].focus();
    });
    $('#schedule-today').addEventListener('click', () => config.chooseDate(config.today()));
    $('#schedule-status').addEventListener('change', event => { state.status = event.target.value; refresh(); });
    $('#schedule-scope').addEventListener('change', event => { state.scope = event.target.value; refresh(); });
    $('#schedule-clear').addEventListener('click', () => { state.status = 'all'; state.scope = 'selected'; refresh(); });
    durationChoices.addEventListener('click', event => {
      const button = event.target.closest('[data-schedule-duration]'); if (!button) return;
      const start = S.minutes($('#task-start').value);
      if (start === null) { formStatus('请先填写开始时间。'); $('#task-start').focus(); return; }
      const end = start + Number(button.dataset.scheduleDuration);
      if (end >= 1440) { formStatus('时长超出当天，请分成两天安排。'); return; }
      $('#task-end').value = String(Math.floor(end / 60)).padStart(2, '0') + ':' + String(end % 60).padStart(2, '0');
      $('#task-end').dispatchEvent(new Event('input', { bubbles: true })); formStatus('');
    });
    $('#schedule-repeat-new').addEventListener('click', () => openRepeat());
    $('#schedule-repeat-close').addEventListener('click', () => root.LifeUI.closeSheet(sheet));
    $('#schedule-series-list').addEventListener('click', event => {
      const button = event.target.closest('button'); if (!button) return;
      if (button.dataset.editSeries) openRepeat(button.dataset.editSeries);
      if (button.dataset.generateSeries) config.generate(button.dataset.generateSeries);
      if (button.dataset.toggleSeries) config.toggleSeries(button.dataset.toggleSeries);
    });
    $('#schedule-repeat-form').addEventListener('submit', async event => {
      event.preventDefault(); const button = $('#repeat-save'); if (button.disabled) return;
      root.LifeUI.setBusy(button, true);
      try {
        const existing = config.meta().series.find(row => row.id === $('#repeat-id').value);
        const row = { id: existing?.id || config.makeId(), title: $('#repeat-title').value.trim(), startDate: $('#repeat-start-date').value,
          endDate: $('#repeat-end-date').value, weekdays: [...sheet.querySelectorAll('[name="repeat-weekday"]:checked')].map(input => Number(input.value)),
          start: $('#repeat-start').value, end: $('#repeat-end').value, active: existing?.active ?? true, priority: $('#repeat-priority').value || null,
          deadlineOffsetDays: $('#repeat-deadline-offset').value === '' ? null : Number($('#repeat-deadline-offset').value), note: $('#repeat-note').value.trim(),
          createdAt: existing?.createdAt ?? Date.now(), updatedAt: Date.now() };
        const error = config.saveSeries(row, repeatExpected);
        $('#repeat-status').textContent = error;
        if (!error) { config.clearDraft('schedule-repeat-form'); root.LifeUI.closeSheet(sheet); }
      } finally { root.LifeUI.setBusy(button, false); }
    });
  }
  function formStatus(message) { $('#task-form-status').textContent = message; }
  function refresh() { config.refresh(); config.remember(); }
  async function openRepeat(id = '') {
    const form = $('#schedule-repeat-form'), row = config.meta().series.find(value => value.id === id);
    if (config.hasDraft(form.id) && $('#repeat-id').value !== id
      && !await config.confirm('放弃未保存的重复规则，打开另一条规则？', '切换规则', '放弃并打开')) return;
    if (!config.hasDraft(form.id) || $('#repeat-id').value !== id) {
      form.reset(); config.clearDraft(form.id); repeatExpected = row ? JSON.stringify(row) : null;
      $('#repeat-id').value = row?.id || ''; $('#repeat-title').value = row?.title || '';
      $('#repeat-start-date').value = row?.startDate || config.date(); $('#repeat-end-date').value = row?.endDate || S.addDays(config.date(), 6);
      $('#repeat-start').value = row?.start || ''; $('#repeat-end').value = row?.end || '';
      $('#repeat-priority').value = row?.priority || ''; $('#repeat-note').value = row?.note || '';
      $('#repeat-deadline-offset').value = row?.deadlineOffsetDays ?? '';
      form.querySelectorAll('[name="repeat-weekday"]').forEach(input => { input.checked = row ? row.weekdays.includes(Number(input.value)) : true; });
      $('#repeat-status').textContent = '';
    }
    $('#schedule-repeat-dialog').showModal(); $('#repeat-title').focus();
  }
  function card(task, meta, allTasks, timeline) {
    const details = S.detailFor(meta, task.id), length = S.duration(task), overlaps = S.conflicts(task, allTasks);
    const time = task.start || task.end ? `${task.start || '待定'} – ${task.end || '待定'}` : '未安排时间';
    const style = timeline ? ` style="--schedule-block-height:${Math.min(148, Math.max(92, 78 + (length || 0) * .4))}px"` : '';
    const extra = [priorityLabel(details.priority), details.deadline ? '截止 ' + details.deadline : '', overlaps.length ? '时间重叠' : ''].filter(Boolean);
    return '<article class="task-item schedule-item ' + (timeline ? 'schedule-time-block ' : '') + (task.completed ? 'completed' : '') + '" data-schedule-task="' + esc(task.id) + '"' + style + '>'
      + (timeline ? '<time class="schedule-time-label">' + esc(task.start) + '</time>' : '')
      + '<div class="schedule-item-body"><label class="task-check-hit"><input class="task-checkbox" type="checkbox" data-toggle-task="' + esc(task.id) + '"' + (task.completed ? ' checked' : '') + ' aria-label="完成日程：' + esc(task.title) + '"></label><div class="schedule-item-copy"><a class="task-name task-detail-link" data-open-task="' + esc(task.id) + '" href="#task/' + encodeURIComponent(task.id) + '">' + esc(task.title) + '</a><div class="task-time">' + esc((state.view === 'todo' && state.scope === 'all' ? task.date + ' · ' : '') + time + (length ? ' · ' + length + ' 分钟' : '')) + '</div>'
      + (extra.length ? '<div class="schedule-item-meta">' + extra.map(text => '<span>' + esc(text) + '</span>').join('') + '</div>' : '')
      + (details.note ? '<p class="schedule-item-note">' + esc(details.note) + '</p>' : '') + '</div><div class="task-actions"><button type="button" class="icon-button" data-edit-task="' + esc(task.id) + '" aria-label="编辑日程：' + esc(task.title) + '">' + icon('edit') + '</button><button type="button" class="icon-button delete-button" data-delete-task="' + esc(task.id) + '" aria-label="删除日程：' + esc(task.title) + '">' + icon('delete') + '</button></div></div></article>';
  }
  function render(items, tasks, meta, date) {
    if (!config) return;
    if (lastDate !== date) { state.month = date.slice(0, 7); lastDate = date; }
    if (!state.month) state.month = date.slice(0, 7);
    $('#schedule-tab-day').textContent = date === config.today() ? '今日' : '当日';
    $('#task-list-view').dataset.scheduleMode = state.view;
    document.querySelectorAll('[data-schedule-view]').forEach(button => {
      const active = button.dataset.scheduleView === state.view;
      button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
    });
    $('#schedule-content').setAttribute('aria-labelledby', 'schedule-tab-' + state.view);
    $('#schedule-calendar').classList.toggle('hidden', state.view !== 'calendar');
    $('#schedule-scope-label').classList.toggle('hidden', state.view !== 'todo');
    $('#schedule-status').value = state.status; $('#schedule-scope').value = state.scope;
    $('#schedule-clear').classList.toggle('hidden', state.status === 'all' && (state.view !== 'todo' || state.scope === 'selected'));
    const completed = items.filter(task => task.completed).length, rate = items.length ? Math.round(completed / items.length * 100) : 0;
    $('#schedule-progress').setAttribute('aria-valuenow', String(rate)); $('#schedule-progress > span').style.width = rate + '%';
    let visible = (state.view === 'todo' && state.scope === 'all' ? tasks : items).filter(task => state.view !== 'todo' || !task.start);
    visible = visible.filter(task => state.status === 'all' || (state.status === 'done' ? task.completed : !task.completed))
      .slice().sort((a, b) => state.view === 'todo' && state.scope === 'all' ? a.date.localeCompare(b.date) || S.compare(a, b) : S.compare(a, b));
    const scheduled = visible.filter(task => task.start), waiting = visible.filter(task => !task.start);
    const rows = state.view === 'todo' ? visible.map(task => card(task, meta, tasks, false)).join('')
      : (scheduled.length ? '<h3 class="schedule-group-title">时间线</h3>' + scheduled.map(task => card(task, meta, tasks, true)).join('') : '')
        + (waiting.length ? '<h3 class="schedule-group-title">待安排</h3>' + waiting.map(task => card(task, meta, tasks, false)).join('') : '');
    $('#task-list').innerHTML = rows;
    $('#schedule-list-summary').textContent = (state.view === 'todo' && state.scope === 'all' ? '所有日期' : date) + ' · ' + (state.view === 'todo' ? '未设置开始时间' : '日程') + ' · ' + visible.length + ' 项';
    $('#task-badge').textContent = visible.length + ' 项';
    $('#task-empty').classList.toggle('hidden', visible.length > 0);
    $('#task-empty strong').textContent = state.status !== 'all' ? '没有符合条件的日程' : state.view === 'todo' ? '没有待安排的任务' : '这一天还没有日程';
    $('#task-empty p').textContent = state.status !== 'all' ? '可清除状态筛选，查看其他日程。' : '快速添加一项，或展开下方表单安排时间。';
    const counts = new Map(); tasks.forEach(task => counts.set(task.date, (counts.get(task.date) || 0) + 1));
    $('#schedule-month-title').textContent = Number(state.month.slice(0, 4)) + ' 年 ' + Number(state.month.slice(5)) + ' 月';
    $('#schedule-month-grid').innerHTML = S.calendar(state.month).map(day => day ? '<button type="button" class="schedule-calendar-day' + (day.slice(0,7) !== state.month ? ' outside-month' : '') + (day === date ? ' selected' : '') + (day === config.today() ? ' is-today' : '') + '" data-schedule-date="' + day + '" aria-label="' + day + '，' + (counts.get(day) || 0) + ' 项日程" aria-pressed="' + (day === date) + '"><span>' + Number(day.slice(8)) + '</span><small aria-hidden="true">' + (counts.has(day) ? '·' : '') + '</small></button>' : '<span></span>').join('');
    $('#schedule-series-count').textContent = meta.series.length + ' 项';
    $('#schedule-series-list').innerHTML = meta.series.map(row => '<article class="schedule-series-row"><div><strong>' + esc(row.title) + '</strong><p>' + esc(row.startDate + ' 至 ' + row.endDate) + '</p><p>' + (row.active ? (row.weekdays.length === 7 ? '每日' : '每周 ' + row.weekdays.map(day => ['一','二','三','四','五','六','日'][day-1]).join('、')) : '已暂停') + ' · 待生成 ' + S.missingDates(meta,row.id).length + ' 项</p></div><div class="schedule-series-actions"><button type="button" class="secondary-button" data-edit-series="' + esc(row.id) + '">编辑</button><button type="button" class="secondary-button" data-toggle-series="' + esc(row.id) + '">' + (row.active ? '暂停' : '启用') + '</button><button type="button" class="primary-button" data-generate-series="' + esc(row.id) + '"' + (!row.active || !S.missingDates(meta,row.id).length ? ' disabled' : '') + '>预览生成</button></div></article>').join('') || '<p class="subtle-copy">暂无重复规则。创建规则后仍需确认生成，不会自动改写历史。</p>';
  }
  root.LifeScheduleUI = Object.freeze({ init, render, snapshot, restore, formStatus, priorityLabel });
})(window);
