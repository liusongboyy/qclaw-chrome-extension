// QClaw Chrome Extension - Popup Script
// Uses WebSocket to connect to QClaw Gateway

const QCLAW_HOST = 'localhost';
const QCLAW_PORT = 18789;
const AUTH_TOKEN = 'ed880d4d890f158a5773f9108f71fe73c2a25301e17f01b1';

let ws = null;
let isConnected = false;
let pendingResponses = {};
let connectResolve = null;

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
  connect();
});

// Connect to QClaw via WebSocket
function connect() {
  return new Promise((resolve, reject) => {
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
          console.log('Received:', msg);
          handleMessage(msg);
        } catch (e) {
          console.error('Parse error:', e);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setDisconnected();
        reject(error);
      };
      
      ws.onclose = () => {
        console.log('WebSocket closed');
        isConnected = false;
        setDisconnected();
      };
      
      // Timeout for connection
      setTimeout(() => {
        if (!isConnected && connectResolve) {
          connectResolve = null;
          reject(new Error('Connection timeout'));
        }
      }, 5000);
      
    } catch (error) {
      console.error('Connect error:', error);
      reject(error);
    }
  });
}

// Handle incoming messages
function handleMessage(msg) {
  // Connection challenge - respond with connect request
  if (msg.type === 'event' && msg.event === 'connect.challenge') {
    const { nonce } = msg.payload;
    console.log('Got challenge, nonce:', nonce);
    
    send({
      type: 'req',
      id: 'connect',
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: 'cli',
          version: '2026.2.1',
          platform: 'macos',
          mode: 'cli'
        },
        role: 'operator',
        scopes: ['operator.read', 'operator.write'],
        auth: { token: AUTH_TOKEN },
        locale: 'zh-CN',
        userAgent: 'openclaw-cli/2026.2.1'
      }
    });
    return;
  }
  
  // Connection response
  if (msg.id === 'connect') {
    if (msg.ok) {
      console.log('Connected successfully!');
      isConnected = true;
      setConnected();
      if (connectResolve) {
        connectResolve();
        connectResolve = null;
      }
    } else {
      console.error('Connection rejected:', msg.error);
      setDisconnected();
    }
    return;
  }
  
  // Command responses
  if (msg.type === 'res' && msg.id && pendingResponses[msg.id]) {
    const resolver = pendingResponses[msg.id];
    delete pendingResponses[msg.id];
    
    if (msg.ok) {
      resolver.resolve(msg.payload || msg.result);
    } else {
      resolver.reject(new Error(msg.error || 'Command failed'));
    }
  }
  
  // Events (like agent responses)
  if (msg.type === 'event') {
    console.log('Event:', msg.event, msg.payload);
    if (msg.event === 'agent.response') {
      showResponse(msg.payload?.message || '收到响应', 'success');
    }
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

// Send command with promise-based response
function sendCommand() {
  const command = commandInput.value.trim();
  if (!command) return;
  
  if (!isConnected) {
    showResponse('未连接，正在重连...', 'error');
    connect().then(() => sendCommand());
    return;
  }
  
  showResponse('正在发送...', 'loading');
  btnSend.disabled = true;
  
  const id = 'cmd-' + Date.now();
  
  const promise = new Promise((resolve, reject) => {
    pendingResponses[id] = { resolve, reject };
    setTimeout(() => {
      if (pendingResponses[id]) {
        delete pendingResponses[id];
        reject(new Error('Timeout'));
      }
    }, 10000);
  });
  
  if (send({ type: 'req', id, method: 'agent.prompt', params: { message: command } })) {
    promise
      .then(() => {
        showResponse('命令已发送', 'success');
        commandInput.value = '';
      })
      .catch((err) => {
        showResponse(err.message, 'error');
      })
      .finally(() => {
        btnSend.disabled = false;
      });
  } else {
    showResponse('发送失败', 'error');
    btnSend.disabled = false;
  }
}

// Take screenshot
async function takeScreenshot() {
  showResponse('正在截取屏幕...', 'loading');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png', quality: 100 });
    
    if (isConnected) {
      send({
        type: 'req',
        id: 'screenshot-' + Date.now(),
        method: 'agent.prompt',
        params: { message: `[截图] ${dataUrl}` }
      });
    }
    showResponse('截图已发送', 'success');
  } catch (error) {
    showResponse('截图失败', 'error');
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
    
    const text = results[0]?.result;
    if (text && isConnected) {
      send({
        type: 'req',
        id: 'clipboard-' + Date.now(),
        method: 'agent.prompt',
        params: { message: `[剪贴板内容]\n${text}` }
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
        type: 'req',
        id: 'pageinfo-' + Date.now(),
        method: 'agent.prompt',
        params: { message: `[页面信息]\n标题: ${info.title}\nURL: ${info.url}\n描述: ${info.description}` }
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
  commandInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendCommand();
  });
  btnScreenshot.addEventListener('click', takeScreenshot);
  btnClipboard.addEventListener('click', readClipboard);
  btnPageInfo.addEventListener('click', getPageInfo);
  btnOpenPanel.addEventListener('click', openControlPanel);
}
