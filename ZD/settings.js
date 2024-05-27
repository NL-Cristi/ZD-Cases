console.log("Settings script loaded");  // Log when the background script is loaded

document.addEventListener('DOMContentLoaded', function () {
    const currentUrlContainer = document.getElementById('currentUrlContainer');
    const currentZendeskDomain = document.getElementById('currentZendeskDomain');
    const formContainer = document.getElementById('formContainer');
    const zendeskDomainInput = document.getElementById('zendeskDomain');

    // Function to show the current URL container and hide the form container
    function showCurrentUrlContainer(zendeskDomain) {
        currentZendeskDomain.textContent = zendeskDomain;
        currentUrlContainer.classList.remove('hidden');
        formContainer.classList.add('hidden');
    }

    // Function to show the form container and hide the current URL container
    function showFormContainer() {
        currentUrlContainer.classList.add('hidden');
        formContainer.classList.remove('hidden');
        zendeskDomainInput.value = '';
    }

    // Check if there is a stored Zendesk URL when the page loads
    browser.storage.local.get('zendeskDomain').then((result) => {
        if (result.zendeskDomain) {
            showCurrentUrlContainer(result.zendeskDomain);
        }
    });

    // Save the new Zendesk URL and update the UI
    document.getElementById('saveButton').addEventListener('click', function () {
        const zendeskDomain = zendeskDomainInput.value;
        browser.storage.local.set({ zendeskDomain: zendeskDomain }).then(() => {
            console.log('Zendesk URL saved:', zendeskDomain);
            showCurrentUrlContainer(zendeskDomain);
        }).catch(err => {
            console.error('Error saving Zendesk URL:', err);
        });
    });

    // Close the window on cancel
    document.getElementById('cancelButton').addEventListener('click', function () {
        window.close();
    });

    // Reset the Zendesk URL and update the UI
    document.getElementById('resetButton').addEventListener('click', function () {
        browser.storage.local.remove('zendeskDomain').then(() => {
            console.log('Zendesk URL reset');
            showFormContainer();
        }).catch(err => {
            console.error('Error resetting Zendesk URL:', err);
        });
    });
});
