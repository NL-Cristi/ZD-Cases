browser.runtime.onInstalled.addListener(() => {
    console.log("Zendesk Plugin installed.");
});

function openZendesk() {
    console.log("Opening Zendesk...");
    browser.storage.local.get('zendeskUrl', function (data) {
        if (data.zendeskUrl) {
            browser.windows.openDefaultBrowser(data.zendeskUrl);
            // browser.tabs.create({ url: data.zendeskUrl });
        } else {
            console.log("Zendesk URL is not set.");
        }
    });
}

browser.browserAction.onClicked.addListener(openZendesk);
