// 紀錄每個 Tab 的側邊欄開啟狀態
const panelStates = {};

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Error setting panel behavior:', error));

chrome.runtime.onInstalled.addListener(() => {
  console.log('AssistiveTouch Productivity Panel installed.');
});

// 監聽來自內容腳本 (懸浮小按鈕) 或側邊欄的訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openSidePanel" && sender.tab) {
    const tabId = sender.tab.id;

    // 檢查目前狀態，如果未記錄則預設為關閉 (false)
    const isOpen = panelStates[tabId] || false;

    if (isOpen) {
      // 關閉側邊欄的最佳解：直接禁用，直到下次開啟前再重新啟用
      chrome.sidePanel.setOptions({
        tabId: tabId,
        enabled: false
      }).then(() => {
        panelStates[tabId] = false;
      }).catch(err => console.error('Failed to disable side panel', err));

    } else {
      // 請求開啟：先確保狀態為啟用，並給予正確路徑
      chrome.sidePanel.setOptions({
        tabId: tabId,
        path: 'sidepanel.html',
        enabled: true
      }).then(() => {
        // 再呼叫 open API 將其開啟
        return chrome.sidePanel.open({ tabId: tabId });
      }).then(() => {
        panelStates[tabId] = true;
      }).catch((error) => console.error('Failed to open side panel:', error));
    }
  } else if (message.action === "sidePanelClosedManually") {
    // 當使用者手動點擊 [X] 關閉側邊欄時，更新狀態
    if (message.tabId) {
      panelStates[message.tabId] = false;
    }
  }
});

// 當使用者自己關閉 Tab 時，清理狀態
chrome.tabs.onRemoved.addListener((tabId) => {
  delete panelStates[tabId];
});
