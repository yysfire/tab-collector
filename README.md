# Tab Collector

一键保存当前浏览器窗口所有标签页为 Markdown 文件。

## 功能

- 单击扩展图标，弹出窗口显示当前窗口的标签页数量
- 点击"保存全部标签页"按钮，生成 Markdown 文件并自动下载
- Markdown 格式：`- [页面标题](URL)`，标题中的特殊字符自动转义
- 文件名格式：`tabs-YYYY-MM-DD-HHmmss.md`（兼容 Windows 文件名限制）
- 零构建工具，开箱即用

## 安装

### Chrome / Edge / Arc（Chromium 内核）

1. 打开 `chrome://extensions/`
2. 开启右上角 **开发者模式**
3. 点击 **"加载已解压的扩展程序"**
4. 选择本插件所在目录

### Firefox

1. 打开 `about:debugging#/runtime/this-firefox`
2. 点击 **"临时载入附加组件"**
3. 选择 `manifest.json`

## 使用

1. 在浏览器中打开多个标签页
2. 点击工具栏中的 **Tab Collector** 图标
3. 查看当前窗口标签页数量
4. 点击 **"保存全部标签页"**
5. 浏览器自动下载 `.md` 文件

输出示例：

```markdown
# Tabs - 2026-05-23 16:55:00
- [GitHub](https://github.com)
- [掘金 - 开发者社区](https://juejin.cn)
- [Stack Overflow](https://stackoverflow.com)
```

## 技术栈

- Manifest V3
- 纯 HTML + CSS + JavaScript
- 兼容 Chrome / Edge / Arc / Firefox（>= 109）

## 许可

[MIT](LICENSE) © 2026 yysfire
