/* PWA lifecycle only. No business storage, API synchronization or forced reload. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const base = new URL('./', document.currentScript.src);
  let registration = null, installPrompt = null, checking = false;
  function mode() { return navigator.standalone === true || matchMedia('(display-mode:standalone)').matches; }
  function network() {
    $('pwa-network').textContent = navigator.onLine ? '网络可用（不代表已同步）' : '离线 · 使用本机数据';
    $('pwa-mode').textContent = mode() ? '独立窗口' : '浏览器网页';
    $('pwa-install').textContent = installPrompt ? '安装 Life OS' : '安装说明';
  }
  function message(text) { $('pwa-message').textContent = text; }
  function workerInfo(worker) {
    if (!worker) return;
    const channel = new MessageChannel();
    const timeout = setTimeout(() => channel.port1.close(), 4000);
    channel.port1.onmessage = event => {
      clearTimeout(timeout); channel.port1.close();
      if (event.data?.type !== 'LIFEOS_PWA_INFO') return;
      $('pwa-release').textContent = 'PWA · ' + event.data.version;
      $('pwa-cache').textContent = '基础资源已缓存 · 可离线打开';
    };
    worker.postMessage({ type:'LIFEOS_PWA_INFO' }, [channel.port2]);
  }
  function state() {
    if (!registration) return;
    if (registration.waiting) {
      $('pwa-version').textContent = '新版已备妥，关闭全部窗口后应用';
      message('请先保存表单。关闭全部 Life OS 标签与独立窗口后重开；当前窗口继续使用原版本。');
    } else if (registration.installing) {
      $('pwa-version').textContent = '正在校验并下载资源';
    } else if (registration.active) {
      $('pwa-version').textContent = '当前外壳已就绪';
      workerInfo(registration.active);
    }
  }
  function watch(worker) {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'redundant') {
        $('pwa-version').textContent = '新资源未就绪，保留当前版本';
        if (!registration.active) $('pwa-cache').textContent = '基础资源未完整缓存';
        message('资源校验或下载未完成，可联网后重试；个人记录不受影响。');
      } else state();
    });
  }
  async function check() {
    if (checking || !registration) return;
    checking = true; $('pwa-check').disabled = true;
    message('正在检查应用资源版本；不会同步个人记录。');
    try { await registration.update(); state(); if (!registration.waiting && !registration.installing) message('已完成更新检查。没有强制刷新；离线能力以资源缓存状态为准。'); }
    catch (error) { message('无法完成更新检查，请联网后重试。已缓存版本和个人记录保留。'); console.warn('Life OS PWA update check failed:', error.name); }
    finally { checking = false; $('pwa-check').disabled = false; }
  }
  async function start() {
    network();
    $('pwa-install').addEventListener('click', async () => {
      if (!installPrompt) { $('pwa-guide').open = true; $('pwa-guide').scrollIntoView({block:'nearest'}); return; }
      const pending = installPrompt; installPrompt = null;
      try { await pending.prompt(); const choice = await pending.userChoice; message(choice.outcome === 'accepted' ? '已接受浏览器安装请求，请检查系统安装结果。' : '已取消安装，可稍后重试。'); }
      catch (error) { message('浏览器未完成安装请求，请使用系统菜单安装。'); console.warn('Life OS install prompt failed:', error.name); }
      network();
    });
    $('pwa-check').addEventListener('click', check);
    window.addEventListener('online', network); window.addEventListener('offline', network);
    window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; network(); });
    window.addEventListener('appinstalled', () => { installPrompt = null; network(); message('浏览器报告安装完成；请在主屏幕核对 Life OS。'); });
    matchMedia('(display-mode:standalone)').addEventListener('change', network);
    if (!window.isSecureContext || !('serviceWorker' in navigator)) {
      $('pwa-cache').textContent = '当前环境不支持离线外壳';
      $('pwa-version').textContent = '需要 HTTPS 与 Service Worker 支持';
      $('pwa-check').disabled = true; return;
    }
    try {
      // Do not replace an unrelated existing worker or register overlapping scopes.
      const existing = await navigator.serviceWorker.getRegistration(base.href);
      const worker = existing?.active || existing?.waiting || existing?.installing;
      if (existing && (existing.scope !== base.href || (worker && worker.scriptURL !== new URL('sw.js',base).href))) {
        throw new Error('existing-worker');
      }
      registration = await navigator.serviceWorker.register(new URL('sw.js',base).href, {scope:base.href, updateViaCache:'none'});
      registration.addEventListener('updatefound', () => { watch(registration.installing); state(); });
      watch(registration.installing); state();
      navigator.serviceWorker.addEventListener('controllerchange', state);
    } catch (error) {
      $('pwa-cache').textContent = '离线外壳尚未就绪';
      $('pwa-version').textContent = '注册失败 · 本地记录功能保留';
      message(error.message === 'existing-worker' ? '检测到其他 Service Worker，已停止注册以免冲突；请核实部署路径。' : '无法注册离线外壳，请检查 HTTPS、托管权限和资源路径后重试。');
      $('pwa-check').disabled = true;
      console.warn('Life OS PWA registration failed:', error.name);
    }
  }
  start();
})();
