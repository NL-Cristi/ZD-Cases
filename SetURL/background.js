console.log("Background script loaded");
let myImapAccount;
let monitorFolder;
let ticketFolder;
var openedSyncFolder; // Initialize as array
let closedSyncFolder = []; // Initialize as array
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
            createCaseFolder(message, sendResponse);
            break;
        case "closeCaseFolder":
            archiveCaseFolder(sendResponse);
            break;
        case "syncFolderMails":
            console.log("Syncing folder mails");
            syncFolderMails(sendResponse);
            break;
        case "restoreArchivedFolder":
            restoreArchivedFolder(sendResponse);
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
        monitorOpenClosedFolders = await browser.folders.getSubFolders(monitorFolder);

        // Check if the array contains an object with the name "Open"
        let containsOpen = monitorOpenClosedFolders.some(folder => folder.name === "Open");

        // Check if the array contains an object with the name "Closed"
        let containsClosed = monitorOpenClosedFolders.some(folder => folder.name === "Closed");

        if (containsOpen && containsClosed) {
            console.log("The array contains objects with the names 'Open' and 'Closed'.");
            await PopulateOpenClosedFolders();
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
                closedSyncFolder.push(newClosedFolder);
                console.log("New subfolder 'Closed' created:", newClosedFolder);
            }

            console.log("The array contains objects with the names 'Open' and 'Closed'.");
            await PopulateOpenClosedFolders();
        }
    } catch (error) {
        console.error("Error processing subfolders or creating new folder:", error);
    }
}

async function PopulateOpenClosedFolders() {
    monitorOpenClosedFolders = await browser.folders.getSubFolders(monitorFolder);
    openedSyncFolder = monitorOpenClosedFolders.find(folder => folder.name === 'Open');
    closedSyncFolder = monitorOpenClosedFolders.find(folder => folder.name === 'Closed');
}

// Function to output the current time to the console every 5 minutes
function runEvery5Minutes() {
    setInterval(async () => {
        let currentTime = new Date().toLocaleTimeString();
        console.log("Current time:", currentTime);
        let tempFolders = await GetAllFolders();
        console.log("FoldersCount:", tempFolders.length);
        await autoSyncOpenFolderMails();
    }, 5 * 60000); // 1 minutes in milliseconds// 5 minutes in milliseconds (5 * 60,000)
}

// Start the interval
runEvery5Minutes();

async function GetAllFolders() {
    try {
        // Retrieve all accounts
        const accounts = await browser.accounts.list();

        // Function to recursively get all folders
        const getFoldersRecursive = async (folders, flatList) => {
            for (let folder of folders) {
                flatList.push(folder);
                if (folder.subFolders && folder.subFolders.length > 0) {
                    await getFoldersRecursive(folder.subFolders, flatList);
                }
            }
        };

        // Array to hold all folders
        let allFolders = [];

        // Iterate through each account and get all folders
        for (let account of accounts) {
            let rootFolders = account.folders;
            await getFoldersRecursive(rootFolders, allFolders);
        }
        allFolders = allFolders.filter(folder => !folder.path.includes("MyFolder"));

        return allFolders;
    } catch (error) {
        console.error("Error retrieving folders:", error);
        return [];
    }
}
async function GetTicketFolder() {
    try {
        // Retrieve all accounts
        const accounts = await browser.accounts.list();

        // Function to recursively get all folders
        const getFoldersRecursive = async (folders, flatList) => {
            for (let folder of folders) {
                flatList.push(folder);
                if (folder.subFolders && folder.subFolders.length > 0) {
                    await getFoldersRecursive(folder.subFolders, flatList);
                }
            }
        };

        // Array to hold all folders
        let allFolders = [];

        // Iterate through each account and get all folders
        for (let account of accounts) {
            let rootFolders = account.folders;
            await getFoldersRecursive(rootFolders, allFolders);
        }
        allFolders = allFolders.filter(folder => folder.path.includes("Tickets"));

        return allFolders;
    } catch (error) {
        console.error("Error retrieving folders:", error);
        return [];
    }
}
async function getTicketFoldersInfo() {
    try {
        // Retrieve all accounts
        const accounts = await browser.accounts.list();

        // Function to recursively get all folders
        const getFoldersRecursive = async (folders, flatList) => {
            for (let folder of folders) {
                flatList.push(folder);
                if (folder.subFolders && folder.subFolders.length > 0) {
                    await getFoldersRecursive(folder.subFolders, flatList);
                }
            }
        };

        // Array to hold all folders
        let allFolders = [];

        // Iterate through each account and get all folders
        for (let account of accounts) {
            let rootFolders = account.folders;
            await getFoldersRecursive(rootFolders, allFolders);
        }

        // Filter folders that contain "Tickets" in their name or path
        const ticketFolders = allFolders.filter(folder =>
            folder.name.includes("Tickets") || folder.path.includes("Tickets")
        );

        // Get detailed info for each ticket folder

        return ticketFolders[0];
    } catch (error) {
        console.error("Error retrieving ticket folders info:", error);
        return [];
    }
}
async function GetAllOpenTicketIDFolders() {
    try {
        // Function to recursively get all subfolders
        const getSubFoldersRecursive = async (folders, flatList) => {
            for (let folder of folders) {
                flatList.push(folder);
                if (folder.subFolders && folder.subFolders.length > 0) {
                    await getSubFoldersRecursive(folder.subFolders, flatList);
                }
            }
        };

        // Retrieve all subfolders of the openedSyncFolder
        let rootFolders = await browser.folders.getSubFolders(openedSyncFolder);

        // Array to hold all folders
        let allFolders = [];

        // Get all folders recursively
        await getSubFoldersRecursive(rootFolders, allFolders);

        return allFolders;
    } catch (error) {
        console.error("Error retrieving open ticket ID folders:", error);
        return [];
    }
}
async function getAllOpenTicketID() {
    try {
        // Retrieve all open ticket ID folders
        const allFolders = await GetAllOpenTicketIDFolders();

        // Create an array that only contains the name value from each folder object
        const folderNames = allFolders.map(folder => folder.name);

        return folderNames;
    } catch (error) {
        console.error("Error retrieving open ticket ID folder names:", error);
        return [];
    }
}
async function getAllOpenTicketSubjects() {
    try {
        // Retrieve all open ticket ID folders
        const allFolders = await GetAllOpenTicketIDFolders();

        // Create an array that only contains the extracted ticket ID value from each folder name
        const ticketIDs = allFolders.map(folder => {
            // Extract the numerical part (ticket ID) using a regular expression
            const match = folder.name.match(/(\d+)/);
            // Return the formatted ticket ID if a match is found
            return match ? `Ticket ID: ${match[1]}` : null;
        }).filter(ticketID => ticketID !== null); // Filter out any null values

        return ticketIDs;
    } catch (error) {
        console.error("Error retrieving open ticket ID folder names:", error);
        return [];
    }
}

async function* getMessages(folder) {
    let page = await browser.messages.list(folder);
    yield* page.messages;

    while (page.id) {
        page = await browser.messages.continueList(page.id);
        yield* page.messages;
    }
}

async function getAllTicketIDMessages(allFolders, ticketID) {
    const matchingMessages = [];

    await Promise.all(allFolders.map(async (folder) => {
        const messages = getMessages(folder);
        for await (let message of messages) {
            let fullMessage = await browser.messages.get(message.id);
            if (fullMessage.subject && fullMessage.subject.includes(ticketID)) {
                console.log("Full message:", fullMessage);
                matchingMessages.push(fullMessage);
            }
        }
    }));
    console.log("GOT matching messages:", matchingMessages);
    return matchingMessages;
}

// Example usage:
// GetAllFolders().then(async (allFolders) => {
//     const ticketID = "Ticket ID: 31659";
//     const messages = await getAllTicketIDMessages(allFolders, ticketID);
//     console.log("Matching messages:", messages);
// });

async function createCaseFolder(message, sendResponse) {
    console.log("Received createCaseFolder message in background:", message);
    if (message.folderName) {
        try {
            const caseID = await ReturnZDCaseID();
            console.log("Case ID retrieved:", caseID);
            console.log("Folder name:", message.folderName);

            // Add your folder creation logic here using caseID and folderName
            const combinedFolderName = `${caseID} - ${message.folderName}`;
            let openFolderSubfolders = await browser.folders.getSubFolders(openedSyncFolder);

            if (openFolderSubfolders.some(folder => folder.name === combinedFolderName)) {
                console.error("Folder already exists:", combinedFolderName);
                sendResponse({ success: false, error: "Folder already exists." });
            } else {
                console.log("Creating folder:", combinedFolderName);
                let newMonitorFolder = await browser.folders.create(openedSyncFolder, combinedFolderName);
                console.info("New folder created:", combinedFolderName);
                sendResponse({ success: true, folderName: combinedFolderName });
            }
        } catch (error) {
            console.error("Error processing folder creation:", error);
            sendResponse({ success: false, error: error.message });
        }
    } else {
        console.error("No folder name provided.");
        sendResponse({ success: false, error: "No folder name provided." });
    }
    console.log("LogAfter createCaseFolder in background");
}

async function archiveCaseFolder(sendResponse) {
    console.log("LOG at the beginning of archiveCaseFolder in background");

    try {
        // Get the current selected tab and its displayed folder
        const currentSelectedTab = await messenger.mailTabs.getCurrent();
        const currentFolder = currentSelectedTab.displayedFolder;
        console.info("CurrentTab", currentSelectedTab);
        console.info("currentFolder", currentFolder);

        // Populate open and closed folders
        await PopulateOpenClosedFolders();

        // Get subfolders of open and closed folders
        const openFolderSubFolders = await messenger.folders.getSubFolders(openedSyncFolder);
        const closedFolderSubFolders = await messenger.folders.getSubFolders(closedSyncFolder);

        if (openFolderSubFolders.some(folder => folder.name === currentFolder.name)) {
            console.info("Folder exists in Open:", currentFolder.name);
            try {
                // Copy folder to closed folder
                const newMonitorFolder = await messenger.folders.copy(currentFolder, closedSyncFolder);

                try {
                    // Attempt to delete the original folder
                    await messenger.folders.delete(currentFolder);
                    console.info("Folder copied to Closed is:", currentFolder.name);
                    console.info("Moved Folder is:", newMonitorFolder);
                    sendResponse({ success: true, folderName: newMonitorFolder.name });
                } catch (deleteError) {
                    // Handle delete error specifically
                    console.error('Error deleting folder:', deleteError);
                    sendResponse({ success: true, folderName: newMonitorFolder.name });
                }

            } catch (copyError) {
                console.error('Error copying folder:', copyError);
                var errorMessage = copyError.message.split('because ')[1];
                sendResponse({ success: false, error: errorMessage });
            }
        } else if (closedFolderSubFolders.some(folder => folder.name === currentFolder.name)) {
            console.info("Folder is already in Closed:", currentFolder.name);
            sendResponse({ success: false, error: "Folder is already in CLOSED." });
        } else {
            console.error("Folder does not exist in Open:", currentFolder.name);
            sendResponse({ success: false, error: "Folder does not exist in Open." });
        }
    } catch (error) {
        console.error('Error in archiveCaseFolder:', error);
        sendResponse({ success: false, error: `Unexpected error: ${error.message}` });
    }

    console.log("LOG at the end of archiveCaseFolder in background");
}
async function restoreArchivedFolder(sendResponse) {
    console.log("LOG at the beginning of reOpenArchivedCase in background");

    try {
        // Get the current selected tab and its displayed folder
        const currentSelectedTab = await messenger.mailTabs.getCurrent();
        const currentFolder = currentSelectedTab.displayedFolder;
        console.info("CurrentTab", currentSelectedTab);
        console.info("currentFolder", currentFolder);

        // Populate open and closed folders
        await PopulateOpenClosedFolders();

        // Get subfolders of open and closed folders
        const openFolderSubFolders = await messenger.folders.getSubFolders(openedSyncFolder);
        const closedFolderSubFolders = await messenger.folders.getSubFolders(closedSyncFolder);

        if (closedFolderSubFolders.some(folder => folder.name === currentFolder.name)) {
            console.info("Folder exists in Closed:", currentFolder.name);
            try {
                // Copy folder to open folder
                const newMonitorFolder = await messenger.folders.copy(currentFolder, openedSyncFolder);

                try {
                    // Attempt to delete the original folder
                    await messenger.folders.delete(currentFolder);
                    console.info("Folder copied to Open is:", currentFolder.name);
                    console.info("Moved Folder is:", newMonitorFolder);
                    sendResponse({ success: true, folderName: newMonitorFolder.name });
                } catch (deleteError) {
                    // Handle delete error specifically
                    console.error('Error deleting folder:', deleteError);
                    sendResponse({ success: true, folderName: newMonitorFolder.name });
                }

            } catch (copyError) {
                console.error('Error copying folder:', copyError);
                var errorMessage = copyError.message.split('because ')[1];
                sendResponse({ success: false, error: errorMessage });
            }
        } else if (openFolderSubFolders.some(folder => folder.name === currentFolder.name)) {
            console.info("Folder is already in Open:", currentFolder.name);
            sendResponse({ success: false, error: "Folder is already in OPEN." });
        } else {
            console.error("Folder does not exist in Closed:", currentFolder.name);
            sendResponse({ success: false, error: "Folder does not exist in Closed." });
        }
    } catch (error) {
        console.error('Error in reOpenArchivedCase:', error);
        sendResponse({ success: false, error: `Unexpected error: ${error.message}` });
    }

    console.log("LOG at the end of reOpenArchivedCase in background");
}
async function syncFolderMails(sendResponse) {
    try {
        console.info("Syncing folder mails");
        const currentSelectedTab = await messenger.mailTabs.getCurrent();
        const currentFolder = currentSelectedTab.displayedFolder;
        console.info("currentFolderName is ", currentFolder.name);
        const match = currentFolder.name.match(/(\d+)/);

        // Ensure match is found to avoid undefined errors
        if (!match) {
            console.error("No ticket ID found in folder name");
            sendResponse({ success: false, error: "No ticket ID found in folder name" });
            return;
        }

        // Return the formatted ticket ID if a match is found
        const subjectToSearch = `Ticket ID: ${match[1]}`;
        console.info("subjectToSearch is:", subjectToSearch);
        console.info("currentFolder", currentFolder.name);

        const allFolders = await GetAllFolders();
        const allFilteredFolders = allFolders.filter(folder => !folder.path.includes("MyFolder"));
        const allWantedFolders = allFolders.filter(folder => folder.type === 'sent' || folder.type === 'inbox' || folder.name === 'Tickets' || folder.name === 'MyFolders' || folder.name === 'VSOS');
        const wantedFolders = allFolders.filter(folder => folder.name === 'Tickets');

        // Initialize myMessages as an empty array
        let myMessages = [];

        for (const folder of allWantedFolders) {
            console.info("FolderName is:", folder.name);

            let page = await messenger.messages.list(folder);
            let filteredMessages = page.messages.filter(message => message.subject.includes(subjectToSearch));

            // Add the messages from the first page
            myMessages = myMessages.concat(filteredMessages);

            // Continue retrieving messages if there are more pages
            while (page.id) {
                page = await messenger.messages.continueList(page.id);
                filteredMessages = page.messages.filter(message => message.subject.includes(subjectToSearch));
                myMessages = myMessages.concat(filteredMessages);
            }
        }
        let messageIDS = myMessages.map(message => message.id);
        let move = await browser.messages.move(messageIDS, currentFolder);
        console.info("Messages moved:", move);
        console.info("messagesFound:", myMessages.length);
        console.info("messageIDS Count:", messageIDS.length);
        console.info("end of For each loop");

        sendResponse({ success: true, messagesCount: messageIDS.length });
    } catch (error) {
        console.error('Error in syncFolderMails:', error);
        sendResponse({ success: false, error: `Unexpected error: ${error.message}` });
    }
}


async function autoSyncOpenFolderMails() {
    try {
        console.info("autoSyncOpenFolderMails folders mails");

        const allFolders = await GetAllFolders();
        await PopulateOpenClosedFolders();

        var openSubfolders = await GetAllOpenTicketIDFolders();
        // var ticketID = await getAllOpenTicketID();
        // var allOpenTicketSubjects = await getAllOpenTicketSubjects();
        const allWantedFolders = allFolders.filter(folder => folder.type === 'sent' || folder.type === 'inbox' || folder.name === 'Tickets' || folder.name === 'MyFolders' || folder.name === 'VSOS');

        for (const openFolder of openSubfolders) {
            console.info("Start of OpenFolder ForEAch loop");
            console.info("openFolder is:", openFolder.name);

            // Extract the numerical part (ticket ID) using a regular expression
            const match = openFolder.name.match(/(\d+)/);
            const subjectToSearch = `Ticket ID: ${match[1]}`;
            console.info(subjectToSearch);
            let myMessages = [];

            for (const wantedFolder of allWantedFolders) {
                console.info("Start of wantedFolder ForEAch loop");

                console.info("wantedFolder is:", wantedFolder.name);

                let page = await messenger.messages.list(wantedFolder);
                console.info("finding " + subjectToSearch + " in " + wantedFolder.name + " folder");
                let filteredMessages = page.messages.filter(message => message.subject.includes(subjectToSearch));

                // Add the messages from the first page
                myMessages = myMessages.concat(filteredMessages);

                // Continue retrieving messages if there are more pages
                while (page.id) {
                    page = await messenger.messages.continueList(page.id);
                    filteredMessages = page.messages.filter(message => message.subject.includes(subjectToSearch));
                    myMessages = myMessages.concat(filteredMessages);
                }
                console.info("ENd of wantedFolder ForEAch loop");

            }
            let messageIDS = myMessages.map(message => message.id);
            let move = await browser.messages.move(messageIDS, openFolder);
            console.info(messageIDS.length + " Messages moved for " + subjectToSearch + " to " + openFolder.name);
            // Return the formatted ticket ID if a match is found
            console.info("ENd of openFolder ForEAch loop");
        }

        console.info("after all tickets");


    } catch (error) {
        console.error('Error in syncFolderMails:', error);
    }
}
