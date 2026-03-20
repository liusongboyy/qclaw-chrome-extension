# QClaw Chrome Extension 🦁

> QClaw AI Assistant Chrome 扩展程序 - 直接从浏览器控制你的AI助手

## 功能特点

- 🔗 **快速连接** - 一键连接本地QClaw服务
- 📸 **截图捕获** - 快速截取当前页面并发送给QClaw
- 📋 **剪贴板同步** - 读取剪贴板内容发送给QClaw
- 📄 **页面信息** - 获取当前页面的详细信息
- 🖥️ **控制面板** - 快速打开QClaw控制面板
- 💬 **命令发送** - 直接发送命令给QClaw

## 安装方法

### 开发模式安装（推荐）

1. 克隆或下载本仓库到本地
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 开启右上角的「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择本仓库的 `qclaw-chrome-extension` 文件夹

### 正式发布

本扩展将发布到 Chrome Web Store（开发中）

## 使用前提

1. **确保QClaw正在运行**
   
   本扩展需要连接本地QClaw服务（默认：`http://localhost:8080`）
   
   确保QClaw应用正在运行，或在设置中配置正确的API地址

2. **API端点**
   
   扩展会调用以下API端点：
   - `GET /api/status` - 检查连接状态
   - `POST /api/command` - 发送命令
   - `POST /api/screenshot` - 发送截图
   - `POST /api/clipboard` - 发送剪贴板内容
   - `POST /api/pageinfo` - 发送页面信息

## 项目结构

```
qclaw-chrome-extension/
├── manifest.json      # 扩展清单配置
├── popup.html        # 弹出窗口HTML
├── popup.css         # 弹出窗口样式
├── popup.js          # 弹出窗口逻辑
├── background.js     # 后台服务 worker
├── content.js        # 内容脚本
├── styles.css        # 内容脚本样式
├── images/           # 图标文件
└── README.md         # 本文件
```

## 配置说明

在 `popup.js` 中可以修改QClaw连接地址：

```javascript
const QCLAW_HOST = 'http://localhost:8080'; // 修改为你实际的地址
```

## 开发相关

### 修改后的热更新

修改代码后，在 `chrome://extensions/` 页面点击扩展的「刷新」按钮即可

### API开发

如果需要为扩展开发新的API端点，请在QClaw后端添加对应的路由处理器

## 许可证

MIT License

## 相关链接

- [QClaw 官网](https://qclaw.ai)
- [QClaw GitHub](https://github.com/openclaw/qclaw)
- [OpenClaw 文档](https://docs.openclaw.ai)
