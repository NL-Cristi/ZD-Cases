// popup.js

document.addEventListener('DOMContentLoaded', function () {
    checkZendeskUrl();
    document.getElementById('setZendeskDomain').addEventListener('click', function () {
        const zendeskUrl = document.getElementById('zendeskUrl').value;
        browser.runtime.sendMessage({ action: 'setZendeskURL', zendeskUrl: zendeskUrl }).then(response => {
            console.log(response);
            checkZendeskUrl();
        });
    });
    document.getElementById('openZendesk').addEventListener('click', function () {
        browser.runtime.sendMessage({ action: 'openZendesk' }).then(response => {
            console.log(response);
            if (!response.success) {
                alert(response.message);
            }
        });
    });
    document.getElementById('resetZendeskDomain').addEventListener('click', function () {
        browser.runtime.sendMessage({ action: 'resetDomain' }).then(response => {
            console.log(response);
            checkZendeskUrl();
        });
    });

});

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