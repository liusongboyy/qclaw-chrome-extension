// QClaw Chrome Extension - Popup Script

// Configuration
const QCLAW_HOST = 'http://localhost:8080';
const API_BASE = `${QCLAW_HOST}/api`;

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
document.addEventListener('DOMContentLoaded', async () => {
  await checkConnection();
  setupEventListeners();
});

// Check QClaw connection
async function checkConnection() {
  try {
    const response = await fetch(`${API_BASE}/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      connectionStatus.classList.add('connected');
      connectionStatus.querySelector('.status-text').textContent = '已连接';
    } else {
      setDisconnected();
    }
  } catch (error) {
    console.error('Connection check failed:', error);
    setDisconnected();
  }
}

function setDisconnected() {
  connectionStatus.classList.remove('connected');
  connectionStatus.querySelector('.status-text').textContent = '未连接';
}

// Setup event listeners
function setupEventListeners() {
  // Send button
  btnSend.addEventListener('click', sendCommand);
  
  // Enter key in input
  commandInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendCommand();
    }
  });
  
  // Quick action buttons
  btnScreenshot.addEventListener('click', takeScreenshot);
  btnClipboard.addEventListener('click', readClipboard);
  btnPageInfo.addEventListener('click', getPageInfo);
  btnOpenPanel.addEventListener('click', openControlPanel);
}

// Send command to QClaw
async function sendCommand() {
  const command = commandInput.value.trim();
  if (!command) return;
  
  showResponse('正在发送命令...', 'loading');
  btnSend.disabled = true;
  
  try {
    const response = await fetch(`${API_BASE}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showResponse(data.message || '命令已发送', 'success');
      commandInput.value = '';
    } else {
      showResponse(data.error || '命令执行失败', 'error');
    }
  } catch (error) {
    console.error('Send command failed:', error);
    showResponse('无法连接到QClaw服务', 'error');
  } finally {
    btnSend.disabled = false;
  }
}

// Take screenshot of current tab
async function takeScreenshot() {
  showResponse('正在截取屏幕...', 'loading');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Use chrome.tabs.captureVisibleTab
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png',
      quality: 100
    });
    
    // Send to QClaw
    const response = await fetch(`${API_BASE}/screenshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        image: dataUrl,
        tabId: tab.id,
        url: tab.url
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showResponse('截图已发送给QClaw', 'success');
    } else {
      showResponse(data.error || '截图发送失败', 'error');
    }
  } catch (error) {
    console.error('Screenshot failed:', error);
    showResponse('截图失败: ' + error.message, 'error');
  }
}

// Read clipboard
async function readClipboard() {
  showResponse('正在读取剪贴板...', 'loading');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Execute script to read clipboard
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: async () => {
        try {
          return await navigator.clipboard.readText();
        } catch (e) {
          return null;
        }
      }
    });
    
    const clipboardText = results[0].result;
    
    if (clipboardText) {
      // Send to QClaw
      await fetch(`${API_BASE}/clipboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clipboardText })
      });
      
      showResponse(`剪贴板内容已发送 (${clipboardText.length}字符)`, 'success');
    } else {
      showResponse('剪贴板为空或无法读取', 'error');
    }
  } catch (error) {
    console.error('Clipboard read failed:', error);
    showResponse('读取剪贴板失败', 'error');
  }
}

// Get current page info
async function getPageInfo() {
  showResponse('正在获取页面信息...', 'loading');
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Get page info via script execution
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        return {
          title: document.title,
          url: window.location.href,
          description: document.querySelector('meta[name="description"]')?.content || '',
          keywords: document.querySelector('meta[name="keywords"]')?.content || '',
          selectors: {
            headings: document.querySelectorAll('h1, h2, h3').length,
            links: document.querySelectorAll('a').length,
            images: document.querySelectorAll('img').length,
            buttons: document.querySelectorAll('button').length
          }
        };
      }
    });
    
    const pageInfo = results[0].result;
    
    // Send to QClaw
    await fetch(`${API_BASE}/pageinfo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pageInfo)
    });
    
    showResponse(`页面: ${pageInfo.title}`, 'success');
  } catch (error) {
    console.error('Get page info failed:', error);
    showResponse('获取页面信息失败', 'error');
  }
}

// Open QClaw control panel
function openControlPanel() {
  window.open(QCLAW_HOST, '_blank');
}

// Show response message
function showResponse(message, type = 'default') {
  responseArea.innerHTML = `<div class="response-content ${type}">${escapeHtml(message)}</div>`;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
