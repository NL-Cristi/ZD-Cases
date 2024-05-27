document.getElementById('settingsButton').addEventListener('click', function () {
    browser.windows.create({
        url: "settings.html",
        type: "popup",
        width: 400,
        height: 200
    });
});
