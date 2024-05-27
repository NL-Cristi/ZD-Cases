console.log("Background script loaded");
let myImapAccount;
let monitorFolder;
var openedSyncFolder;
let closedSyncFolder;
let monitorOpenClosedFolders;
populateDefaults();

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
        case "createCaseFolder":
            console.log("Received createCaseFolder message in background:", message);
            if (message.folderName) {
                console.log("Folder name:", message.folderName);
                // Add your folder creation logic here
                sendResponse({ success: true, folderName: message.folderName });
            } else {
                console.error("No folder name provided.");
                sendResponse({ success: false, error: "No folder name provided." });
            }
            console.log("LogAfter createCaseFolder in background");
            break;

        case "closeCaseFolder":
            console.log("Received closeCaseFolder message to backround:", message);

            sendResponse({ response: "Hello from the closeCaseFolder background script!" });
            console.log("LogAfter closeCaseFolder sendMessage in backround");
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

async function populateDefaults() {
    let myAccounts = await browser.accounts.list();

    // Find the IMAP account AND id = account1 at the same time
    let myImapAccount = myAccounts.filter(account => account.type === "imap" && account.id === "account1");

    // Error out if no IMAP account is found
    if (myImapAccount.length === 0) {
        console.error("No IMAP account found");
        return;
    } else {
        console.info("IMAP account1 found");
    }

    // Find the "MyFolders" folder
    for (let account of myImapAccount) {
        for (let folder of account.folders) {
            if (folder.name === "MyFolders") {
                monitorFolder = folder;
                console.info("MyFolders FOUND");
                break;
            }
        }
        if (monitorFolder) break;
    }

    if (!monitorFolder) {
        console.error("MyFolders not found");
        return;
    }

    try {
        // Get subfolders of monitorFolder
        let monitorOpenClosedFolders = await browser.folders.getSubFolders(monitorFolder);

        // Check if the array contains an object with the name "Open"
        let containsOpen = monitorOpenClosedFolders.some(folder => folder.name === "Open");

        // Check if the array contains an object with the name "Closed"
        let containsClosed = monitorOpenClosedFolders.some(folder => folder.name === "Closed");

        if (containsOpen && containsClosed) {
            console.log("The array contains objects with the names 'Open' and 'Closed'.");
        } else {
            if (!containsOpen) {
                // Create the "Open" folder
                let newOpenFolder = await browser.folders.create(monitorFolder, "Open");
                openedSyncFolder.push(newOpenFolder);
                console.log("New subfolder 'Open' created:", newOpenFolder);
            }

            if (!containsClosed) {
                // Create the "Closed" folder
                let newClosedFolder = await browser.folders.create(monitorFolder, "Closed");
                openedSyncFolder.push(newClosedFolder);
                console.log("New subfolder 'Closed' created:", newClosedFolder);
            }
        }
    } catch (error) {
        console.error("Error processing subfolders or creating new folder:", error);
    }
}

// Function to output the current time to the console every 5 minutes
function runEvery5Minutes() {
    setInterval(() => {
        let currentTime = new Date().toLocaleTimeString();
        console.log("Current time:", currentTime);
    }, 60000); // 5 minutes in milliseconds
}

// Start the interval
runEvery5Minutes();
