/**
 * Tab Collector — background.js (Service Worker)
 *
 * 功能：
 * - 处理扩展图标点击事件（由 manifest 中 action.default_popup 接管，此处作为预留）。
 * - 监听扩展安装/更新事件，执行初始化逻辑。
 * - 未来可扩展：监听快捷键命令、右键菜单等。
 *
 * 兼容性：
 * - Chromium MV3 Service Worker：完整支持。
 * - Firefox MV3（>=109）：支持 Service Worker 后台脚本。
 */

/* -------- 安装 / 更新 -------- */

chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === 'install') {
    console.log('[TabCollector] 扩展已安装 — v' + chrome.runtime.getManifest().version);
  } else if (details.reason === 'update') {
    console.log(
      '[TabCollector] 扩展已更新 — 从 ' +
        (details.previousVersion || '未知') +
        ' 到 v' +
        chrome.runtime.getManifest().version
    );
  }
});

/* -------- Service Worker 激活 -------- */

console.log('[TabCollector] Service Worker 已激活');
