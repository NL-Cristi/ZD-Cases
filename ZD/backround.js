// background.js

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'setZendeskURL') {
        setZendeskURL(message.zendeskUrl).then(response => sendResponse(response));
        return true; // This keeps the sendResponse function valid after the listener returns
    } else if (message.action === 'openZendesk') {
        openZendesk().then(response => sendResponse(response));
        return true;
    } else if (message.action === 'checkZendeskUrl') {
        checkZendeskUrl().then(response => sendResponse(response));
        return true;
    } else if (message.action === 'resetDomain') {
        ResetDomain().then(response => sendResponse(response));
        return true;
    }
});

function setZendeskURL(zendeskUrl) {
    return new Promise((resolve, reject) => {
        browser.storage.local.set({ zendeskUrl: zendeskUrl }, () => {
            console.log('Zendesk URL saved: ' + zendeskUrl);
            resolve({ success: true });
        });
    });
}

function openZendesk() {
    return new Promise((resolve, reject) => {
        browser.storage.local.get('zendeskUrl', data => {
            if (data.zendeskUrl) {
                getMessageSubject().then(subject => {
                    console.log("Opening URL");
                    const zdUrl = caseUrl(data.zendeskUrl, subject);
                    if (zdUrl) {
                        browser.windows.openDefaultBrowser(zdUrl);
                        resolve({ success: true });
                    } else {
                        console.log("Ticket ID not found in subject.");
                        resolve({ success: false, message: "Ticket ID not found in subject." });
                    }
                }).catch(error => {
                    console.log("Error getting message subject: " + error);
                    resolve({ success: false, message: "Error getting message subject: " + error });
                });
            } else {
                console.log("Zendesk URL is not set.");
                resolve({ success: false, message: "Zendesk URL is not set." });
            }
        });
    });
}

function checkZendeskUrl() {
    return new Promise((resolve, reject) => {
        browser.storage.local.get('zendeskUrl', data => {
            resolve({ zendeskUrl: data.zendeskUrl });
        });
    });
}

function ResetDomain() {
    return new Promise((resolve, reject) => {
        browser.storage.local.remove('zendeskUrl', () => {
            console.log('Zendesk URL cleared.');
            resolve({ success: true });
        });
    });
}

function extractTicketID(inputString) {
    const regex = /Ticket ID:\s*(\d+)/;
    const match = inputString.match(regex);
    return match ? match[1] : null;
}

function getMessageSubject() {
    return browser.mailTabs.getSelectedMessages().then(selectedMessages => {
        return selectedMessages.messages[0].subject;
    });
}

function caseUrl(zendeskUrl, subject) {
    const ticketId = extractTicketID(subject);
    return ticketId ? `${zendeskUrl}/agent/tickets/${ticketId}` : null;
}
