// QClaw Chrome Extension - Popup Script

// Configuration
const QCLAW_HOST = 'localhost';
const QCLAW_PORT = 18789;
const AUTH_TOKEN = 'ed880d4d890f158a5773f9108f71fe73c2a25301e17f01b1';

let ws = null;
let reconnectTimer = null;
let messageId = 0;

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
  connectWebSocket();
  setupEventListeners();
});

// WebSocket connection
function connectWebSocket() {
  const wsUrl = `ws://${QCLAW_HOST}:${QCLAW_PORT}/`;
  
  try {
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connected, performing handshake...');
      sendConnectHandshake();
    };
    
    ws.onmessage = (event) => {
      handleMessage(JSON.parse(event.data));
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setDisconnected();
    };
    
    ws.onclose = () => {
      console.log('WebSocket closed');
      setDisconnected();
      // Reconnect after 3 seconds
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connectWebSocket();
        }, 3000);
      }
    };
  } catch (error) {
    console.error('Failed to connect:', error);
    setDisconnected();
  }
}

// Send connect handshake
function sendConnectHandshake() {
  sendRequest('connect', {
    minProtocol: 3,
    maxProtocol: 3,
    client: {
      id: 'chrome-extension',
      version: '1.0.0',
      platform: 'chrome',
      mode: 'operator'
    },
    role: 'operator',
    scopes: ['operator.read', 'operator.write'],
    auth: { token: AUTH_TOKEN },
    locale: 'zh-CN',
    userAgent: 'QClaw-Extension/1.0.0'
  });
}

// Handle incoming messages
function handleMessage(msg) {
  console.log('Received:', msg);
  
  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    // Got challenge, already responded with handshake
    return;
  }
  
  if (msg.type === 'res' && msg.id === 'connect') {
    if (msg.ok) {
      setConnected();
    } else {
      setDisconnected();
      console.error('Connection rejected:', msg);
    }
    return;
  }
  
  // Handle command responses
  if (msg.type === 'res' && msg.id && msg.id.startsWith('cmd-')) {
    if (msg.ok) {
      showResponse('命令已发送', 'success');
    } else {
      showResponse(msg.error || '命令执行失败', 'error');
    }
  }
}

// Send request via WebSocket
function sendRequest(method, params) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const id = `${method}-${Date.now()}`;
    ws.send(JSON.stringify({
      type: 'req',
      id: id,
      method: method,
      params: params
    }));
    return id;
  } else {
    console.error('WebSocket not connected');
    return null;
  }
}

// Send command
function sendCommand() {
  const command = commandInput.value.trim();
  if (!command) return;
  
  showResponse('正在发送命令...', 'loading');
  btnSend.disabled = true;
  
  const id = sendRequest('agent.prompt', { 
    message: command,
    sessionId: 'main'
  });
  
  if (id) {
    // Wait for response
    setTimeout(() => {
      btnSend.disabled = false;
    }, 2000);
  } else {
    showResponse('未连接到QClaw', 'error');
    btnSend.disabled = false;
  }
  commandInput.value = '';
}

// Take screenshot
async function takeScreenshot() {
  showResponse('正在截取屏幕...', 'loading');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png',
      quality: 100
    });
    
    sendRequest('browser.screenshot', {
      image: dataUrl,
      tabId: tab.id,
      url: tab.url
    });
    
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
        try { return await navigator.clipboard.readText(); } 
        catch (e) { return null; }
      }
    });
    
    const text = results[0].result;
    if (text) {
      sendRequest('clipboard.write', { text });
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
    
    sendRequest('page.info', results[0].result);
    showResponse(`页面: ${results[0].result.title}`, 'success');
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
  commandInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendCommand();
  });
  btnScreenshot.addEventListener('click', takeScreenshot);
  btnClipboard.addEventListener('click', readClipboard);
  btnPageInfo.addEventListener('click', getPageInfo);
  btnOpenPanel.addEventListener('click', openControlPanel);
}
