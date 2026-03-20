// QClaw Chrome Extension - Background Service Worker
// Handles extension lifecycle and coordinate with popup if needed

console.log('QClaw Background Service Worker loaded');

// Badge management
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: 'Q' });
  chrome.action.setBadgeBackgroundColor({ color: '#00d9ff' });
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received:', message);
  
  if (message.type === 'PING') {
    sendResponse({ pong: true, timestamp: Date.now() });
  }
  
  return true;
});
