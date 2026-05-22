/**
 * Tab Collector — background.js (Service Worker)
 *
 * 功能：
 * - 右键菜单：复制当前标签页 Markdown / 保存全部标签页 Markdown
 * - 监听扩展安装/更新事件
 *
 * 兼容性：
 * - Chromium MV3 Service Worker：完整支持
 * - Firefox MV3（>=109）：支持 chrome.* 命名空间 + Service Worker
 */

/* ===== 工具函数 ===== */

/**
 * 格式化时间戳为 YYYY-MM-DD HH:mm:ss。
 * @param {Date} date
 * @returns {string}
 */
function formatDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 生成用于文件名的日期时间字符串（不含冒号，兼容 Windows 文件名限制）。
 * @param {Date} date
 * @returns {string}
 */
function formatFileDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
}

/**
 * 对 Markdown 标题中的特殊字符进行转义。
 * @param {string} title
 * @returns {string}
 */
function escapeMdTitle(title) {
  return (title || 'Untitled').replace(/[[\]*_`#|]/g, '\\$&');
}

/** 将 Markdown 文本转为 Data URL（Service Worker 中替代 Blob/URL.createObjectURL） */
function markdownToDataUrl(markdown) {
  return 'data:text/markdown;charset=UTF-8,' + encodeURIComponent(markdown);
}

/** 根据标签页数组生成 Markdown 内容（多标签页格式）。
 * @param {chrome.tabs.Tab[]} tabs
 * @param {string} dateTimeStr
 * @returns {string}
 */
function buildMultiMd(tabs, dateTimeStr) {
  const lines = [`# Tabs - ${dateTimeStr}`, ''];
  for (const tab of tabs) {
    const title = escapeMdTitle(tab.title);
    const url = tab.url || 'about:blank';
    lines.push(`- [${title}](${url})`);
  }
  lines.push('');
  return lines.join('\n');
}

/* ===== 右键菜单 ===== */

/** 创建或更新右键菜单项 */
function createContextMenus() {
  // 移除旧菜单（避免安装/更新时重复注册）
  chrome.contextMenus.removeAll(function () {
    chrome.contextMenus.create({
      id: 'copy-tab-md',
      title: '复制此标签页链接',
      contexts: ['page'],
    });

    chrome.contextMenus.create({
      id: 'save-all-tabs-md',
      title: '保存全部标签页为 Markdown',
      contexts: ['page'],
    });
  });
}

/* ===== 右键菜单点击处理 ===== */

/** 复制当前标签页链接为 Markdown 格式 [标题](URL) 到剪贴板 */
function handleCopySingleTab(tab) {
  const title = escapeMdTitle(tab.title);
  const url = tab.url || 'about:blank';
  const markdown = `- [${title}](${url})`;

  // 通过 scripting.executeScript 在目标页面中调用 navigator.clipboard.writeText
  // (activeTab 权限允许在用户交互触发的上下文中注入脚本)
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (text) => {
      navigator.clipboard.writeText(text).catch((err) => {
        console.error('[TabCollector] 剪贴板写入失败:', err);
      });
    },
    args: [markdown],
  }).catch((err) => {
    console.error('[TabCollector] 注入脚本失败:', err);
  });
}

/** 处理保存全部标签页 */
async function handleSaveAllTabs(tab) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  if (!tabs || tabs.length === 0) return;

  const now = new Date();
  const dateTimeStr = formatDateTime(now);
  const markdown = buildMultiMd(tabs, dateTimeStr);
  // Service Worker 中无法使用 Blob/URL.createObjectURL，改用 Data URL
  const url = markdownToDataUrl(markdown);
  const filename = 'tabs-' + formatFileDateTime(now) + '.md';

  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: false,
    conflictAction: 'uniquify',
  });
}

/* ===== 事件绑定 ===== */

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (!tab) return;

  switch (info.menuItemId) {
    case 'copy-tab-md':
      handleCopySingleTab(tab);
      break;
    case 'save-all-tabs-md':
      handleSaveAllTabs(tab);
      break;
  }
});

/* ===== 安装 / 更新 ===== */

chrome.runtime.onInstalled.addListener(function (details) {
  createContextMenus();

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

/* ===== Service Worker 激活 ===== */

console.log('[TabCollector] Service Worker 已激活');
