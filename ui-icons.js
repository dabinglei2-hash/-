/* The single icon registry. Static paths only; record text never enters SVG markup. */
(function (root) {
  'use strict';
  const paths = Object.freeze({
    home: '<path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/>',
    record: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h5"/>',
    finance: '<path d="M12 3v18M17 6H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H6"/>',
    stats: '<path d="M4 20V10h4v10m2 0V4h4v16m2 0v-7h4v7M3 20h18"/>',
    skills: '<path d="m2 9 10-6 10 6-10 6L2 9Zm4 3v6l6 3 6-3v-6m4-3v8"/>',
    profile: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    chevronRight: '<path d="m9 6 6 6-6 6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    add: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="m4 16 12-12 4 4L8 20H4v-4m10-10 4 4"/>',
    delete: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 10h16"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    study: '<path d="M3 4h6a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H3V4Zm18 0h-6a3 3 0 0 0-3 3v14a3 3 0 0 1 3-3h6V4Z"/>',
    task: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 12 3 3 5-6"/>',
    idea: '<path d="M9 18h6m-6 3h6M8 14a6 6 0 1 1 8 0c-1 .8-1 2-1 3H9c0-1 0-2.2-1-3Z"/>',
    goal: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    habit: '<path d="M4 8a8 8 0 0 1 14-2l2 2m0-5v5h-5M20 16a8 8 0 0 1-14 2l-2-2m0 5v-5h5"/>',
    settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
    export: '<path d="M12 16V3m-4 4 4-4 4 4M4 13v7h16v-7"/>',
    restore: '<path d="M12 3v13m-4-4 4 4 4-4M4 13v7h16v-7"/>',
    code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18"/>',
    ai: '<rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9 1v4m6-4v4M9 19v4m6-4v4M1 9h4m-4 6h4m14-6h4m-4 6h4M9 9h6v6H9z"/>',
    language: '<path d="M3 5h12M9 3v2m4 0c0 7-5 10-9 11m1-8c1 3 3 5 7 7m2 6 4-11 4 11m-6-4h4"/>',
    delivery: '<path d="M3 6h11v12H3zM14 10h4l3 4v4h-7"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
    tag: '<path d="M3 3h8l10 10-8 8L3 11V3Z"/><circle cx="7.5" cy="7.5" r="1"/>',
    empty: '<path d="m3 9 3-5h12l3 5v11H3V9Zm0 0h5l2 4h4l2-4h5"/>',
    alert: '<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3v.1"/>',
    food: '<path d="M5 3v7m3-7v7M3 6h7m-5 4h3M6.5 10v11M17 3c-3 2-3 8 0 9h2V3h-2Zm2 9v9"/>',
    shopping: '<path d="M4 8h16l1 13H3L4 8Zm4 0V6a4 4 0 0 1 8 0v2"/>',
    transport: '<rect x="4" y="3" width="16" height="16" rx="3"/><path d="M4 12h16M8 3v9M7 19v2m10-2v2"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 5h4m-3 14h2"/>',
    health: '<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M8 6V3h8v3m-4 4v7m-3-3.5h6"/>',
    work: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12l9 4 9-4m-9 1v5"/>',
    coffee: '<path d="M4 8h12v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Zm12 1h2a3 3 0 0 1 0 6h-2M7 2v3m5-3v3"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13m0-13C4 9 4 2 8 3c3 0 4 5 4 5Zm0 0c8 1 8-6 4-5-3 0-4 5-4 5Z"/>',
    fun: '<path d="M7 7h10c4 0 6 12 3 13-2 1-4-4-6-4h-4c-2 0-4 5-6 4C1 19 3 7 7 7ZM6 10v5m-2.5-2.5h5"/><circle cx="16" cy="11" r=".7"/><circle cx="18" cy="14" r=".7"/>',
    music: '<path d="M10 17V5l10-2v12M10 8l10-2"/><ellipse cx="6.5" cy="18" rx="3.5" ry="3"/><ellipse cx="16.5" cy="16" rx="3.5" ry="3"/>',
    camera: '<rect x="3" y="6" width="18" height="15" rx="2"/><path d="m7 6 2-3h6l2 3"/><circle cx="12" cy="13" r="4"/>',
    sport: '<path d="m3 8 5-5m8 18 5-5M5 10l5-5m4 14 5-5M7 7l10 10M2 5l3-3m14 20 3-3"/>',
    travel: '<path d="m3 11 7 1 7-8c2-2 4-1 3 1l-6 9 2 6-2 1-4-5-5 2-2-2 5-3-6-1 1-1Z"/>',
    family: '<path d="M3 21v-4a4 4 0 0 1 8 0v4m2 0v-4a4 4 0 0 1 8 0v4"/><circle cx="7" cy="6" r="3"/><circle cx="17" cy="6" r="3"/>',
    pet: '<path d="M6 16c0-3 3-6 6-6s6 3 6 6-3 4-6 3c-3 1-6 0-6-3Z"/><ellipse cx="5" cy="8" rx="2" ry="3"/><ellipse cx="10" cy="5" rx="2" ry="3"/><ellipse cx="15" cy="5" rx="2" ry="3"/><ellipse cx="20" cy="8" rx="2" ry="3"/>',
    tools: '<path d="m14 4 3 3 4-3a6 6 0 0 1-7 8l-8 9-3-3 9-8a6 6 0 0 1 2-6Z"/>',
    shirt: '<path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4c0 4-8 4-8 0Z"/>',
    plant: '<path d="M7 15h10l-1 6H8l-1-6Zm5 0V8M12 9C6 10 3 7 4 3c5 0 8 2 8 6Zm0 3c6 0 9-3 8-7-5 0-8 3-8 7Z"/>',
    wallet: '<path d="M20 7H5a2 2 0 0 1 0-4h13v4M4 5v15h17V7m0 5h-6v5h6"/>',
    card: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20M6 16h4"/>',
    savings: '<path d="M6 7c7-6 14 0 14 7v4h-3v3h-3v-3H9v3H6v-4H3v-6h3V7Zm2 0V3l4 2M12 8h3"/><circle cx="17" cy="11" r=".7"/>',
  });
  const labels={food:'餐饮',shopping:'购物',transport:'交通',home:'居家',phone:'通讯',health:'医疗',work:'工作',coffee:'饮品',gift:'礼物',finance:'收支',study:'学习',code:'开发',language:'语言',goal:'目标',fun:'娱乐',music:'音乐',camera:'摄影',sport:'运动',travel:'旅行',idea:'妙想',family:'家庭',pet:'宠物',tools:'工具',shirt:'服饰',plant:'植物',wallet:'钱包',card:'银行卡',savings:'储蓄',delivery:'外卖',tag:'通用分类',skills:'技能'};
  function render(name) {
    if (!Object.hasOwn(paths, name)) return '';
    return '<svg class="ui-icon" data-ui-icon="' + name + '" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + paths[name] + '</svg>';
  }
  function mount(scope = document) {
    scope.querySelectorAll('[data-icon]').forEach((element) => {
      const name = element.dataset.icon;
      if (!Object.hasOwn(paths, name) || element.firstElementChild?.getAttribute('data-ui-icon') === name) return;
      element.innerHTML = render(name);
      element.setAttribute('aria-hidden', 'true');
    });
  }
  root.LifeIcons = Object.freeze({ render, mount, names: Object.keys(paths), label:name=>labels[name]||name });
})(window);
