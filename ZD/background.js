console.log("Background script loaded");  // Log when the background script is loaded

browser.browserAction.onClicked.addListener(() => {
    console.log("Browser action clicked");
    browser.browserAction.setPopup({ popup: "popup.html" });
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Received message:", message);  // Log the received message
    switch (message.action) {
        case "openGoogle":
            console.log("Opening Google");
            OpenGoogle();
            sendResponse({ success: true });
            break;
        case "greet":
            console.log("Received message to backround:", message);

            sendResponse({ response: "Hello from the background script!" });
            console.log("LogAfter sendMessage in backround");
            break;
        case "openZDCase":
            console.log("Opening Zendesk case");
            OpenZDCase().then(result => {
                console.log("Zendesk case opened:", result);
                sendResponse(result);
            }).catch(error => {
                console.error("Error opening Zendesk case:", error);
                sendResponse({ success: false, message: error.message });
            });
            break;
        case "getCaseID":
            console.log("Getting case ID");
            ReturnZDCaseID().then(caseID => {
                console.log("Case ID retrieved:", caseID);
                sendResponse({ caseID: caseID });
            }).catch(error => {
                console.error("Error retrieving case ID:", error);
                sendResponse({ caseID: null, error: error.message });
            });
            break;
        default:
            console.error("Unknown action: " + message.action);
    }
    // Indicate that the response will be sent asynchronously
    return true;
});

async function OpenZDCase() {
    try {
        const data = await browser.storage.local.get('zendeskDomain');
        if (!data.zendeskDomain) {
            throw new Error("Zendesk URL is not set.");
        }
        const subject = await getMessageSubject();
        if (!subject) {
            throw new Error("No email subject found.");
        }

        const zdUrl = caseUrl(data.zendeskDomain, subject);

        if (zdUrl) {
            console.log("Opening Zendesk URL:", zdUrl);
            browser.windows.openDefaultBrowser(zdUrl);
            return { success: true };
        } else {
            throw new Error("Ticket ID not found in subject.");
        }
    } catch (error) {
        console.log("Error: " + error.message);
        return { success: false, message: error.message };
    }
}

async function ReturnZDCaseID() {
    try {
        const subject = await getMessageSubject();
        const caseID = extractTicketID(subject);
        return caseID;
    } catch (error) {
        console.error("Error retrieving case ID: ", error);
        throw error; // Re-throw the error to handle it in the background script
    }
}

function extractTicketID(subject) {
    const regex = /Ticket ID:\s*(\d+)/;
    const match = subject.match(regex);
    return match ? match[1] : null;
}

function OpenGoogle() {
    console.log("Opening Google in default browser");
    browser.windows.openDefaultBrowser("https://google.com");
}

async function getMessageSubject() {
    try {
        const mailTabs = await browser.mailTabs.query({ active: true, currentWindow: true });
        if (mailTabs.length === 0) {
            throw new Error("No active mail tab found.");
        }
        const selectedMessages = await browser.mailTabs.getSelectedMessages(mailTabs[0].id);
        if (!selectedMessages || selectedMessages.messages.length === 0) {
            throw new Error("No selected messages found.");
        }
        return selectedMessages.messages[0].subject;
    } catch (error) {
        console.error("Error getting message subject: ", error);
        throw error;
    }
}

function caseUrl(zendeskDomain, subject) {
    const ticketId = extractTicketID(subject);
    return ticketId ? `https://${zendeskDomain}.zendesk.com/agent/tickets/${ticketId}` : null;
}
