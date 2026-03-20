// QClaw Chrome Extension - Content Script
// This runs on every page to enable page interaction with QClaw

(function() {
  'use strict';
  
  console.log('QClaw Content Script loaded');
  
  // Listen for messages from popup or background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received:', message);
    
    switch (message.type) {
      case 'GET_PAGE_CONTENT':
        sendResponse(getPageContent());
        break;
        
      case 'GET_SELECTED_TEXT':
        sendResponse({ text: window.getSelection().toString() });
        break;
        
      case 'HIGHLIGHT_ELEMENT':
        highlightElement(message.selector);
        sendResponse({ success: true });
        break;
        
      case 'CLICK_ELEMENT':
        clickElement(message.selector);
        sendResponse({ success: true });
        break;
        
      default:
        sendResponse({ error: 'Unknown message type' });
    }
    
    return true;
  });
  
  // Get comprehensive page content
  function getPageContent() {
    return {
      title: document.title,
      url: window.location.href,
      hostname: window.location.hostname,
      description: document.querySelector('meta[name="description"]')?.content || '',
      ogTitle: document.querySelector('meta[property="og:title"]')?.content || '',
      ogDescription: document.querySelector('meta[property="og:description"]')?.content || '',
      selectedText: window.getSelection().toString(),
      bodyText: document.body.innerText.substring(0, 5000),
      links: Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.innerText,
        href: a.href
      })).slice(0, 50),
      images: Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src,
        alt: img.alt,
        width: img.width,
        height: img.height
      })).slice(0, 20)
    };
  }
  
  // Highlight an element by selector
  function highlightElement(selector) {
    const element = document.querySelector(selector);
    if (element) {
      element.style.outline = '3px solid #00d9ff';
      element.style.outlineOffset = '2px';
      
      // Remove highlight after 3 seconds
      setTimeout(() => {
        element.style.outline = '';
        element.style.outlineOffset = '';
      }, 3000);
      
      return true;
    }
    return false;
  }
  
  // Click an element by selector
  function clickElement(selector) {
    const element = document.querySelector(selector);
    if (element) {
      element.click();
      return true;
    }
    return false;
  }
  
  // Notify background that content script is ready
  chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' });
  
})();
