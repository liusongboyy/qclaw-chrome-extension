// QClaw Chrome Extension - Popup Script
// Uses WebSocket to connect to QClaw Gateway

const QCLAW_HOST = 'localhost';
const QCLAW_PORT = 18789;
const AUTH_TOKEN = 'ed880d4d890f158a5773f9108f71fe73c2a25301e17f01b1';
const SESSION_KEY = 'agent:main:main';

let ws = null;
let isConnected = false;
let connectResolve = null;
let pendingRunId = null;

// DOM Elements
const connectionStatus = document.getElementById('connectionStatus');
const commandInput = document.getElementById('commandInput');
const btnSend = document.getElementById('btnSend');
const responseArea = document.getElementById('responseArea');
const btnScreenshot = document.getElementById('btnScreenshot');
const btnClipboard = document.getElementById('btnClipboard');
const btnPageInfo = document.getElementById('btnPageInfo');
const btnOpenPanel = document.getElementById('btnOpenPanel');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  connect().catch(err => {
    console.error('Initial connect failed:', err.message);
  });
});

// Connect to QClaw via WebSocket
function connect() {
  return new Promise((resolve, reject) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }

    const wsUrl = `ws://${QCLAW_HOST}:${QCLAW_PORT}/`;
    console.log('Connecting to:', wsUrl);
    connectResolve = resolve;

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket open, waiting for challenge...');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleMessage(msg);
        } catch (e) {
          console.error('Parse error:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setDisconnected();
        reject(new Error('WebSocket error'));
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        isConnected = false;
        setDisconnected();
      };

      setTimeout(() => {
        if (!isConnected) {
          reject(new Error('Connection timeout'));
        }
      }, 8000);

    } catch (error) {
      console.error('Connect error:', error);
      reject(error);
    }
  });
}

// Handle incoming messages
function handleMessage(msg) {
  // Step 1: Server sends challenge → we respond with connect
  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    console.log('Got challenge, responding...');
    send({
      type: 'req',
      id: 'connect',
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: { id: 'cli', version: '2026.2.1', platform: 'macos', mode: 'cli' },
        role: 'operator',
        scopes: ['operator.read', 'operator.write'],
        auth: { token: AUTH_TOKEN },
        locale: 'zh-CN',
        userAgent: 'openclaw-cli/2026.2.1'
      }
    });
    return;
  }

  // Step 2: Connect response
  if (msg.id === 'connect') {
    if (msg.ok) {
      console.log('Connected!');
      isConnected = true;
      setConnected();
      if (connectResolve) { connectResolve(); connectResolve = null; }
    } else {
      console.error('Connect rejected:', msg.error);
      setDisconnected();
    }
    return;
  }

  // Step 3: chat.send response → save runId
  if (msg.id && msg.id.startsWith('send-') && msg.ok) {
    pendingRunId = msg.payload.runId;
    console.log('Message sent, runId:', pendingRunId);
    return;
  }

  // Step 4: chat event with state=final → fetch history for reply
  if (msg.type === 'event' && msg.event === 'chat' && msg.payload?.state === 'final') {
    console.log('Chat final, fetching reply...');
    send({
      type: 'req',
      id: 'history-' + Date.now(),
      method: 'chat.history',
      params: { sessionKey: SESSION_KEY, limit: 2 }
    });
    return;
  }

  // Step 5: chat.history response → display assistant reply
  if (msg.id && msg.id.startsWith('history-') && msg.ok) {
    const messages = msg.payload?.messages || [];
    const assistant = messages.find(m => m.role === 'assistant');

    if (assistant) {
      if (assistant.stopReason === 'error') {
        showResponse('⚠️ QClaw 错误: ' + (assistant.errorMessage || '未知错误'), 'error');
      } else {
        const text = assistant.content
          ?.filter(c => c.type === 'text')
          .map(c => c.text)
          .join('') || '(无文本回复)';
        showResponse('🤖 ' + text, 'success');
      }
    }
    btnSend.disabled = false;
    return;
  }

  // agent lifecycle events
  if (msg.type === 'event' && msg.event === 'agent') {
    const phase = msg.payload?.data?.phase;
    if (phase === 'start') showResponse('🤔 思考中...', 'loading');
  }
}

// Send JSON via WebSocket
function send(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
    return true;
  }
  return false;
}

// Generate idempotency key
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// Send command
function sendCommand() {
  const command = commandInput.value.trim();
  if (!command) return;

  if (!isConnected) {
    showResponse('未连接，正在重连...', 'error');
    connect().then(() => sendCommand()).catch(() => showResponse('连接失败', 'error'));
    return;
  }

  showResponse('📤 发送中...', 'loading');
  btnSend.disabled = true;

  const ok = send({
    type: 'req',
    id: 'send-' + Date.now(),
    method: 'chat.send',
    params: {
      sessionKey: SESSION_KEY,
      message: command,
      idempotencyKey: uuid()
    }
  });

  if (!ok) {
    showResponse('发送失败，请检查连接', 'error');
    btnSend.disabled = false;
    return;
  }

  commandInput.value = '';
  // btnSend re-enabled after history response arrives
  // Safety timeout
  setTimeout(() => { btnSend.disabled = false; }, 30000);
}

// Take screenshot
async function takeScreenshot() {
  showResponse('正在截取屏幕...', 'loading');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png', quality: 90 });
    if (isConnected) {
      send({
        type: 'req', id: 'send-' + Date.now(), method: 'chat.send',
        params: { sessionKey: SESSION_KEY, message: `[截图已附加] 当前页面截图`, idempotencyKey: uuid() }
      });
    }
    showResponse('截图已发送', 'success');
  } catch (error) {
    showResponse('截图失败: ' + error.message, 'error');
  }
}

// Read clipboard
async function readClipboard() {
  showResponse('正在读取剪贴板...', 'loading');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: async () => {
        try { return await navigator.clipboard.readText(); } catch (e) { return null; }
      }
    });
    const text = results[0]?.result;
    if (text && isConnected) {
      send({
        type: 'req', id: 'send-' + Date.now(), method: 'chat.send',
        params: { sessionKey: SESSION_KEY, message: `[剪贴板内容]\n${text}`, idempotencyKey: uuid() }
      });
      showResponse(`剪贴板已发送 (${text.length}字符)`, 'success');
    } else {
      showResponse('剪贴板为空', 'error');
    }
  } catch (error) {
    showResponse('读取失败', 'error');
  }
}

// Get page info
async function getPageInfo() {
  showResponse('正在获取页面信息...', 'loading');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => ({
        title: document.title,
        url: window.location.href,
        description: document.querySelector('meta[name="description"]')?.content || ''
      })
    });
    const info = results[0]?.result;
    if (info && isConnected) {
      send({
        type: 'req', id: 'send-' + Date.now(), method: 'chat.send',
        params: {
          sessionKey: SESSION_KEY,
          message: `[页面信息]\n标题: ${info.title}\nURL: ${info.url}\n描述: ${info.description}`,
          idempotencyKey: uuid()
        }
      });
    }
    showResponse(`页面: ${info?.title || '未知'}`, 'success');
  } catch (error) {
    showResponse('获取失败', 'error');
  }
}

// Open control panel
function openControlPanel() {
  window.open(`http://${QCLAW_HOST}:${QCLAW_PORT}/`, '_blank');
}

// UI helpers
function setConnected() {
  connectionStatus.classList.add('connected');
  connectionStatus.querySelector('.status-text').textContent = '已连接';
}

function setDisconnected() {
  connectionStatus.classList.remove('connected');
  connectionStatus.querySelector('.status-text').textContent = '未连接';
}

function showResponse(message, type = 'default') {
  responseArea.innerHTML = `<div class="response-content ${type}">${escapeHtml(message)}</div>`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function setupEventListeners() {
  btnSend.addEventListener('click', sendCommand);
  commandInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendCommand(); });
  btnScreenshot.addEventListener('click', takeScreenshot);
  btnClipboard.addEventListener('click', readClipboard);
  btnPageInfo.addEventListener('click', getPageInfo);
  btnOpenPanel.addEventListener('click', openControlPanel);
}
