document.addEventListener('DOMContentLoaded', function () {
    checkZendeskUrl();

    document.getElementById('setZendeskDomain').addEventListener('click', function () {
        openZendesk();
    });

    document.getElementById('openZendesk').addEventListener('click', function () {
        openZendesk();
    });

    document.getElementById('resetZendeskDomain').addEventListener('click', function () {
        ResetDomain();
    });

    function setZendeskURL() {
        const zendeskUrl = document.getElementById('zendeskUrl').value;
        if (zendeskUrl) {
            browser.storage.local.set({ zendeskUrl: zendeskUrl }, function () {
                console.log('Zendesk URL saved: ' + zendeskUrl);
                checkZendeskUrl();
            });
        }
    }

    function openZendesk() {
        browser.storage.local.get('zendeskUrl', function (data) {
            if (data.zendeskUrl) {
                getMessageSubject().then(subject => {
                    console.log("Opening URL");
                    const zdUrl = caseUrl(data.zendeskUrl, subject);
                    if (zdUrl) {
                        browser.windows.openDefaultBrowser(zdUrl);
                    } else {
                        console.log("Ticket ID not found in subject.");
                        alert("Ticket ID not found in subject.");
                    }
                }).catch(error => {
                    console.log("Error getting message subject: " + error);
                    alert("Error getting message subject: " + error);
                });
            } else {
                alert("Zendesk URL is not set.");
                console.log("Zendesk URL is not set.");
            }
        });
    }

    function checkZendeskUrl() {
        browser.storage.local.get('zendeskUrl', function (data) {
            const zendeskInput = document.getElementById('zendeskUrl');
            const setButton = document.getElementById('setZendeskDomain');
            const openButton = document.getElementById('openZendesk');
            const resetButton = document.getElementById('resetZendeskDomain');
            if (data.zendeskUrl) {
                zendeskInput.value = data.zendeskUrl;
                zendeskInput.disabled = true;
                setButton.disabled = true;
                openButton.disabled = false;
                resetButton.disabled = false;
            } else {
                zendeskInput.value = '';
                zendeskInput.disabled = false;
                setButton.disabled = false;
                openButton.disabled = true;
                resetButton.disabled = true;
            }
        });
    }

    function extractTicketID(inputString) {
        const regex = /Ticket ID:\s*(\d+)/;
        const match = inputString.match(regex);
        if (match && match[1]) {
            return match[1];
        } else {
            return null; // or you could throw an error or return a default value
        }
    }

    function getMessageSubject() {
        return browser.mailTabs.getSelectedMessages().then(selectedMessages => {
            return selectedMessages.messages[0].subject;
        });
    }

    function caseUrl(zendeskUrl, subject) {
        const ticketId = extractTicketID(subject);
        if (ticketId) {
            return zendeskUrl + '/agent/tickets/' + ticketId;
        } else {
            return null;
        }
    }
});
function ResetDomain() {
    browser.storage.local.remove('zendeskUrl', function () {
        console.log('Zendesk URL cleared.');
        const zendeskInput = document.getElementById('zendeskUrl');
        zendeskInput.value = '';
        zendeskInput.disabled = false;
        document.getElementById('setZendeskDomain').disabled = false;
        document.getElementById('openZendesk').disabled = true;
        document.getElementById('resetZendeskDomain').disabled = true;
    });
}