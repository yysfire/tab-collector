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

/**
 * 根据标签页数组生成 Markdown 内容（单标签页格式）。
 * @param {chrome.tabs.Tab} tab
 * @param {string} dateTimeStr
 * @returns {string}
 */
function buildSingleMd(tab, dateTimeStr) {
  const title = escapeMdTitle(tab.title);
  const url = tab.url || 'about:blank';
  return [`# Tabs - ${dateTimeStr}`, '', `- [${title}](${url})`, ''].join('\n');
}

/**
 * 根据标签页数组生成 Markdown 内容（多标签页格式）。
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
      title: '复制此标签页为 Markdown',
      contexts: ['tab'],
    });

    chrome.contextMenus.create({
      id: 'save-all-tabs-md',
      title: '保存全部标签页为 Markdown',
      contexts: ['tab'],
    });
  });
}

/* ===== 右键菜单点击处理 ===== */

/** 复制文本到剪贴板（通过后台页面无法直接访问 Clipboard API，所以用 downloads 写临时文件走下载窗口） */
async function handleCopySingleTab(tab) {
  const now = new Date();
  const dateTimeStr = formatDateTime(now);
  const markdown = buildSingleMd(tab, dateTimeStr);

  // 用 chrome.scripting 在 popup 中执行复制？不行，没有 activeTab 或 scripting 权限。
  // 最可靠的方式：通过 downloads API 写入一个小文件，或直接下载。
  // 但对于"复制"，更好的方式是用 chrome.downloads 直接提供 blob URL 下载。
  // 或者用 notify 提示用户已复制，但 SW 无法访问 Clipboard API。
  //
  // 替代方案：直接用 downloads API 下载单标签页文件
  const blob = new Blob([markdown], { type: 'text/markdown;charset=UTF-8' });
  const url = URL.createObjectURL(blob);
  const filename = 'tab-' + formatFileDateTime(now) + '-' + sanitizeFilename(tab.title) + '.md';

  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: false,
    conflictAction: 'uniquify',
  });

  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** 处理保存全部标签页 */
async function handleSaveAllTabs(tab) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  if (!tabs || tabs.length === 0) return;

  const now = new Date();
  const dateTimeStr = formatDateTime(now);
  const markdown = buildMultiMd(tabs, dateTimeStr);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=UTF-8' });
  const url = URL.createObjectURL(blob);
  const filename = 'tabs-' + formatFileDateTime(now) + '.md';

  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: false,
    conflictAction: 'uniquify',
  });

  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** 从标题中提取安全的文件名片段 */
function sanitizeFilename(title) {
  if (!title) return 'untitled';
  return title
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .replace(/\.+$/, '')
    .substring(0, 48) || 'untitled';
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
