// Where notes live: Documents\Jotter in the desktop app, localStorage in the browser
const fs = window.__TAURI__?.fs;
const options = fs ? { baseDir: fs.BaseDirectory.Document } : null;
const renameOptions = fs ? { oldPathBaseDir: fs.BaseDirectory.Document, newPathBaseDir: fs.BaseDirectory.Document } : null;
const indexPath = "Jotter/jotter.json";
const pagePath = (id) => `Jotter/pages/${id}.html`;
 
// Create Documents\Jotter\pages once, the first time the app starts
const setup = fs ? fs.mkdir("Jotter/pages", { ...options, recursive: true }) : null;
 
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
 
// A page was changed outside Jotter (for example on another computer, through Dropbox).
// error.text is the version from this Jotter that was NOT saved over it.
export class ConflictError extends Error {
    constructor(text) {
        super("The page was changed outside Jotter.");
        this.text = text;
    }
}
 
// Safe saving
// 1. Write to "name.tmp" first, then rename it over the real file, so a file is never half written.
// 2. One save at a time per file. If more text comes in meanwhile, only the newest is written next.
// 3. A failed save is tried again by itself (after 2, 4, 8... up to 30 seconds).
// 4. Pages only: if the file on disk is not what Jotter last read or wrote, it is not overwritten.
const files = {}; // path -> what is going on with that file
let statusListener = () => {};
 
function fileState(path) {
    files[path] ??= { text: null, running: false, failed: false, error: null, retryTimer: null, delay: 0, known: undefined, waiters: [] };
    return files[path];
}
 
function reportStatus() {
    const all = Object.values(files);
    const failed = all.find((file) => file.failed);
    const status = failed ? "error" : all.some((file) => file.running || file.text !== null) ? "saving" : "saved";
    statusListener(status, failed?.error);
}
 
// callback(status, error) is called with "saving", "saved" or "error"
export function onSaveStatus(callback) {
    statusListener = callback;
    reportStatus();
}
 
async function swapIn(tempPath, path) {
    // Windows can briefly lock a file (antivirus, Dropbox, Google Drive), so try a few times
    for (let attempt = 1; ; attempt++) {
        try {
            return await fs.rename(tempPath, path, renameOptions);
        } catch (error) {
            if (attempt >= 5) throw error;
            await wait(100 * attempt);
        }
    }
}
 
function writeSafely(path, text, checkConflict) {
    const file = fileState(path);
    file.text = text;
    file.checkConflict = checkConflict;
    const done = new Promise((resolve, reject) => file.waiters.push({ resolve, reject }));
    runSave(path);
    reportStatus();
    return done;
}
 
async function runSave(path) {
    const file = files[path];
    if (!file || file.running || file.retryTimer || file.text === null) return;
    file.running = true;
    const text = file.text;
    const waiters = file.waiters.splice(0);
    try {
        await setup;
        if (file.checkConflict && file.known !== undefined && (await fs.exists(path, options))) {
            const onDisk = await fs.readTextFile(path, options);
            if (onDisk !== file.known) {
                // Keep what is on disk. Hand the newest text from this Jotter back to the caller.
                file.known = onDisk;
                file.failed = false;
                file.error = null;
                const conflict = new ConflictError(file.text ?? text);
                file.text = null;
                [...waiters, ...file.waiters.splice(0)].forEach((waiter) => waiter.reject(conflict));
                return;
            }
        }
        const tempPath = `${path}.tmp`;
        await fs.writeTextFile(tempPath, text, options);
        await swapIn(tempPath, path);
        file.known = text;
        file.failed = false;
        file.error = null;
        file.delay = 0;
        if (file.text === text) file.text = null;
        waiters.forEach((waiter) => waiter.resolve());
    } catch (error) {
        // Keep the text (or newer text) and try again later
        file.failed = true;
        file.error = error;
        file.delay = Math.min((file.delay || 1000) * 2, 30000);
        file.retryTimer = setTimeout(() => {
            file.retryTimer = null;
            runSave(path);
        }, file.delay);
        waiters.forEach((waiter) => waiter.reject(error));
    } finally {
        file.running = false;
        reportStatus();
        runSave(path); // newer text may have come in while this save was running
    }
}
 
// The Retry button: try every failed save again now
export function retryFailedSaves() {
    for (const path in files) {
        const file = files[path];
        if (!file.retryTimer) continue;
        clearTimeout(file.retryTimer);
        file.retryTimer = null;
        file.delay = 0;
        runSave(path);
    }
}
 
// Before closing: try to finish every save. Resolves to true when everything is saved.
export async function flushSaves() {
    retryFailedSaves();
    for (;;) {
        const all = Object.values(files);
        if (!all.some((file) => file.running || (file.text !== null && !file.retryTimer))) {
            return !all.some((file) => file.failed);
        }
        await wait(50);
    }
}
 
export async function loadIndex() {
    if (!fs) return JSON.parse(localStorage.getItem("jotter-data") || "null");
    await setup;
    if (!(await fs.exists(indexPath, options))) return null;
    return JSON.parse(await fs.readTextFile(indexPath, options));
}
 
export async function saveIndex(data) {
    if (!fs) return localStorage.setItem("jotter-data", JSON.stringify(data));
    await writeSafely(indexPath, JSON.stringify(data, null, 2), false);
}
 
export async function loadPage(id) {
    if (!fs) return localStorage.getItem(`jotter-page-${id}`) || "";
    await setup;
    const path = pagePath(id);
    const file = fileState(path);
    // A newer version is still waiting to be written: use that
    if (file.text !== null) return file.text;
    const text = (await fs.exists(path, options)) ? await fs.readTextFile(path, options) : "";
    file.known = text;
    return text;
}
 
export async function savePage(id, html) {
    if (!fs) return localStorage.setItem(`jotter-page-${id}`, html);
    await writeSafely(pagePath(id), html, true);
}
 
export async function deletePage(id) {
    if (!fs) return localStorage.removeItem(`jotter-page-${id}`);
    await setup;
    const path = pagePath(id);
    const file = files[path];
    if (file) {
        // Drop saves that have not started, and wait for one that is running
        file.text = null;
        clearTimeout(file.retryTimer);
        file.retryTimer = null;
        file.waiters.splice(0).forEach((waiter) => waiter.resolve());
        while (file.running) await wait(50);
        delete files[path];
        reportStatus();
    }
    if (await fs.exists(path, options)) await fs.remove(path, options);
}
