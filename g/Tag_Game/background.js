chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'chrome-extension://lhjnnpbainjpdbggjpkagihhmbakbeff/play.html' });
});
