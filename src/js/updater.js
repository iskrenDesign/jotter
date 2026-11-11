// Updates: checks GitHub for a newer version of Jotter and installs it (installed app only)
const updater = window.__TAURI__?.updater;

const dialog = document.querySelector(".update-dialog");
const title = dialog.querySelector(".confirm-dialog-title");
const message = dialog.querySelector(".confirm-dialog-message");
const progress = dialog.querySelector(".update-progress");
const actions = dialog.querySelector(".confirm-dialog-actions");

const LATER_KEY = "jotter-update-later";
const ONE_DAY = 24 * 60 * 60 * 1000;

let busy = false; // an update is downloading or installing
let pendingAnswer = null;

// Shows the dialog with a heading, a text, optional buttons and an optional progress bar
function render({ heading, text, buttons = [], percent = null }) {
    title.textContent = heading;
    message.textContent = text;
    progress.hidden = percent === null;
    if (percent !== null) progress.value = percent;
    actions.hidden = buttons.length === 0;
    actions.replaceChildren(
        ...buttons.map(({ label, value, primary }) => {
            const button = document.createElement("button");
            button.value = value;
            button.textContent = label;
            button.className = "dialog-button" + (primary ? " dialog-button-primary" : "");
            return button;
        }),
    );
    if (!dialog.open) dialog.showModal();
}

// Resolves with the value of the button that was clicked ("later" when the dialog is dismissed)
function ask(options) {
    render(options);
    return new Promise((resolve) => {
        pendingAnswer = resolve;
    });
}

function answer(value) {
    if (!pendingAnswer) return;
    const resolve = pendingAnswer;
    pendingAnswer = null;
    resolve(value);
}

actions.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button) answer(button.value);
});

dialog.addEventListener("cancel", (event) => {
    // Escape must not interrupt a download
    if (busy) event.preventDefault();
    else answer("later");
});

async function notify(heading, text) {
    await ask({ heading, text, buttons: [{ label: "OK", value: "ok", primary: true }] });
    dialog.close();
}

function isPostponed(version) {
    try {
        const later = JSON.parse(localStorage.getItem(LATER_KEY));
        return later?.version === version && Date.now() < later.until;
    } catch {
        return false;
    }
}

function postpone(version) {
    try {
        localStorage.setItem(LATER_KEY, JSON.stringify({ version, until: Date.now() + ONE_DAY }));
    } catch {}
}

async function install(update) {
    busy = true;
    let total = 0;
    let downloaded = 0;
    render({ heading: "Downloading update", text: "0%", percent: 0 });

    try {
        await update.downloadAndInstall((event) => {
            if (event.event === "Started") total = event.data.contentLength || 0;
            if (event.event === "Progress") {
                downloaded += event.data.chunkLength;
                const percent = total ? Math.min(100, Math.round((downloaded / total) * 100)) : 0;
                render({ heading: "Downloading update", text: `${percent}%`, percent });
            }
            if (event.event === "Finished") {
                render({ heading: "Installing update", text: "Jotter will close and open again by itself.", percent: 100 });
            }
        });
        // On Windows the app closes by itself while the installer runs, so we normally never get here
    } catch (error) {
        console.error("Update failed", error);
        busy = false;
        await notify(
            "The update could not be installed",
            "Please try again later, or download the newest version from the Releases page on GitHub.",
        );
    }
}

// manual = true when the person asked (always shows a result), false for the check at startup
export async function checkForUpdates({ manual = false } = {}) {
    if (busy || dialog.open) return;

    if (!updater) {
        if (manual) await notify("Updates", "Updates only work in the installed Jotter app.");
        return;
    }

    let update;
    try {
        update = await updater.check();
    } catch (error) {
        console.error("Update check failed", error);
        if (manual) await notify("Could not check for updates", "Please check your internet connection and try again.");
        return;
    }

    if (!update) {
        if (manual) {
            const version = await window.__TAURI__?.app?.getVersion?.();
            await notify("You're up to date", version ? `Jotter ${version} is the latest version.` : "You have the latest version of Jotter.");
        }
        return;
    }

    // At startup, do not ask again for 24 hours after the person chose "Later"
    if (!manual && isPostponed(update.version)) return;

    const choice = await ask({
        heading: "Update available",
        text: `Jotter ${update.version} is ready to install. You are using version ${update.currentVersion}.`,
        buttons: [
            { label: "Later", value: "later" },
            { label: "Update now", value: "update", primary: true },
        ],
    });

    if (choice !== "update") {
        postpone(update.version);
        if (dialog.open) dialog.close();
        return;
    }
    await install(update);
}
