/**
 * Tab Collector — popup.js
 * 弹出窗口逻辑：获取当前窗口标签页、展示统计、生成 Markdown 并触发下载。
 *
 * 兼容性说明：
 * - Chromium 系浏览器（Chrome / Edge / Arc / Opera）原生支持 chrome.* API。
 * - Firefox MV3 同样支持 chrome.* 命名空间，因此无需 browser.* 回退。
 *   若运行在极旧版本的 Firefox 中（不推荐），可通过 typeof browser !== 'undefined' 检测。
 */

(function () {
  'use strict';

  /* ===== DOM 引用 ===== */
  const tabCountEl = document.getElementById('tabCount');
  const saveBtn = document.getElementById('saveBtn');
  const toastEl = document.getElementById('toast');

  /* ===== 工具函数 ===== */

  /**
   * 获取当前窗口的所有标签页。
   * @returns {Promise<chrome.tabs.Tab[]>} 标签页数组
   */
  function fetchTabs() {
    return chrome.tabs.query({ currentWindow: true });
  }

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
   * 根据标签页数组生成 Markdown 内容。
   * @param {chrome.tabs.Tab[]} tabs
   * @param {string} dateTimeStr
   * @returns {string}
   */
  function buildMarkdown(tabs, dateTimeStr) {
    const lines = [`# Tabs - ${dateTimeStr}`, ''];

    for (const tab of tabs) {
      const title = (tab.title || 'Untitled').replace(/[[\]*_`#|]/g, '\\$&');
      const url = tab.url || 'about:blank';
      lines.push(`- [${title}](${url})`);
    }

    lines.push(''); // 末尾空行
    return lines.join('\n');
  }

  /**
   * 触发浏览器下载文件。
   * @param {string} content - 文件内容
   * @param {string} filename - 文件名
   * @param {string} mimeType - MIME 类型
   */
  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    chrome.downloads
      ? chrome.downloads.download({
          url: url,
          filename: filename,
          saveAs: false,
          conflictAction: 'uniquify',
        })
      : fallbackDownload(url, filename);

    // 延迟释放 Object URL，确保下载已开始
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /**
   * 降级下载方案：通过创建隐藏链接触发下载。
   * 适用于 chrome.downloads API 不可用的环境（如未声明 downloads 权限时）。
   * @param {string} url
   * @param {string} filename
   */
  function fallbackDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /**
   * 显示 Toast 提示。
   * @param {string} message
   * @param {number} duration - 显示时长（毫秒）
   */
  function showToast(message, duration) {
    toastEl.querySelector('.toast-text').textContent = message;
    toastEl.classList.remove('hidden');

    if (duration > 0) {
      clearTimeout(showToast._timer);
      showToast._timer = setTimeout(function () {
        toastEl.classList.add('hidden');
      }, duration);
    }
  }
  showToast._timer = 0;

  /* ===== 主流程 ===== */

  /**
   * 加载并显示标签页统计信息。
   */
  function loadStats() {
    tabCountEl.textContent = '…';
    tabCountEl.classList.add('loading');
    saveBtn.disabled = true;

    fetchTabs()
      .then(function (tabs) {
        tabCountEl.classList.remove('loading');
        tabCountEl.textContent = String(tabs.length);
        saveBtn.disabled = tabs.length === 0;

        // 缓存标签页数据，供保存按钮使用
        loadStats._cachedTabs = tabs;
      })
      .catch(function (err) {
        tabCountEl.classList.remove('loading');
        tabCountEl.textContent = '!';
        console.error('[TabCollector] 获取标签页失败:', err);
        showToast('获取标签页失败，请重试', 3000);
      });
  }
  loadStats._cachedTabs = [];

  /**
   * 处理"保存标签页"按钮点击事件。
   */
  function handleSave() {
    const tabs = loadStats._cachedTabs;
    if (!tabs || tabs.length === 0) {
      showToast('没有可保存的标签页', 2500);
      return;
    }

    var now = new Date();
    var dateTimeStr = formatDateTime(now);
    var fileDateTime = formatFileDateTime(now);
    var markdown = buildMarkdown(tabs, dateTimeStr);
    var filename = 'tabs-' + fileDateTime + '.md';

    try {
      downloadFile(markdown, filename, 'text/markdown;charset=UTF-8');
      showToast('已保存 ' + tabs.length + ' 个标签页', 3000);
    } catch (err) {
      console.error('[TabCollector] 下载失败:', err);
      showToast('保存失败，请重试', 3000);
    }
  }

  /* ===== 事件绑定 ===== */
  saveBtn.addEventListener('click', handleSave);

  /* ===== 初始化 ===== */
  loadStats();
})();
