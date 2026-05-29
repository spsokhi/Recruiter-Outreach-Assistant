// Tailor – background service worker
// Receives profile data from the content script, stores it, and opens the side panel.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'OPEN_PANEL') return;

  const tabId = sender.tab?.id;
  if (!tabId) return;

  // Persist profile so the side panel can read it
  chrome.storage.session.set({ profile: msg.profile, profileTabId: tabId }, () => {
    // Open the side panel for the current window
    chrome.sidePanel.open({ windowId: sender.tab.windowId });
    sendResponse({ ok: true });
  });

  return true; // keep message channel open for async sendResponse
});

// Allow the side panel to request the stored profile directly
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'GET_PROFILE') return;
  chrome.storage.session.get(['profile'], (data) => {
    sendResponse({ profile: data.profile || null });
  });
  return true;
});
