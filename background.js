// QClaw Chrome Extension - Background Service Worker

const QCLAW_HOST = 'http://localhost:8080';
const API_BASE = `${QCLAW_HOST}/api`;

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  switch (message.type) {
    case 'COMMAND':
      handleCommand(message.data).then(sendResponse);
      return true;
      
    case 'SCREENSHOT':
      handleScreenshot(message.data).then(sendResponse);
      return true;
      
    case 'CLIPBOARD':
      handleClipboard(message.data).then(sendResponse);
      return true;
      
    case 'PAGE_INFO':
      handlePageInfo(message.data).then(sendResponse);
      return true;
      
    case 'STATUS':
      checkQClawStatus().then(sendResponse);
      return true;
      
    default:
      sendResponse({ error: 'Unknown message type' });
  }
});

// Handle command execution
async function handleCommand(data) {
  try {
    const response = await fetch(`${API_BASE}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await response.json();
  } catch (error) {
    return { error: error.message };
  }
}

// Handle screenshot
async function handleScreenshot(data) {
  try {
    const response = await fetch(`${API_BASE}/screenshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await response.json();
  } catch (error) {
    return { error: error.message };
  }
}

// Handle clipboard
async function handleClipboard(data) {
  try {
    const response = await fetch(`${API_BASE}/clipboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await response.json();
  } catch (error) {
    return { error: error.message };
  }
}

// Handle page info
async function handlePageInfo(data) {
  try {
    const response = await fetch(`${API_BASE}/pageinfo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await response.json();
  } catch (error) {
    return { error: error.message };
  }
}

// Check QClaw status
async function checkQClawStatus() {
  try {
    const response = await fetch(`${API_BASE}/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      const data = await response.json();
      return { connected: true, status: data };
    }
    return { connected: false, error: 'QClaw not responding' };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

// Badge management
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: 'Q' });
  chrome.action.setBadgeBackgroundColor({ color: '#00d9ff' });
});

console.log('QClaw Background Service Worker loaded');
