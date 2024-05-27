console.log("PopUp script loaded");  // Log when the background script is loaded

document.getElementById('settingsButton').addEventListener('click', function () {
    browser.windows.create({
        url: "settings.html",
        type: "popup",
        width: 400,
        height: 200
    });
});

document.getElementById('openCaseButton').addEventListener('click', function () {
    browser.runtime.sendMessage({ action: "openGoogle" });
});

document.getElementById('getCaseIDButton').addEventListener('click', function () {
    browser.runtime.sendMessage({ action: "getCaseID" }, (response) => {
        if (browser.runtime.lastError) {
            console.error("Error retrieving case ID: ", browser.runtime.lastError);
            return;
        }
        if (response.error) {
            console.error("Error: ", response.error);
            window.alert("Error retrieving case ID: " + response.error);
        } else {
            console.log("Case ID: ", response.caseID);
            window.alert("Case ID: " + response.caseID);
        }
    });
});


document.getElementById('openZDCaseButton').addEventListener('click', function () {
    browser.storage.local.get('zendeskDomain').then(data => {
        if (!data.zendeskDomain) {
            window.alert("Zendesk domain is not set. Please set it in the settings.");
            return;
        }

        browser.runtime.sendMessage({ action: "openZDCase" }, (response) => {
            if (browser.runtime.lastError) {
                console.error("Error opening case: ", browser.runtime.lastError);
                return;
            }
            if (response.error) {
                console.error("Error: ", response.error);
                window.alert("Error opening case: " + response.error);
            } else {
                console.log("Case opened successfully");
            }
        });
    }).catch(error => {
        console.error("Error accessing storage: ", error);
        window.alert("Error accessing storage: " + error.message);
    });
});