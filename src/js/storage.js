// Where notes live: Documents\Jotter in the desktop app, localStorage in the browser
const fs = window.__TAURI__?.fs;
const options = fs ? { baseDir: fs.BaseDirectory.Document } : null;
const indexPath = "Jotter/jotter.json";
const pagePath = (id) => `Jotter/pages/${id}.html`;

// Create Documents\Jotter\pages once, the first time the app starts
const setup = fs ? fs.mkdir("Jotter/pages", { ...options, recursive: true }) : null;

export async function loadIndex() {
    if (!fs) return JSON.parse(localStorage.getItem("jotter-data") || "null");
    await setup;
    if (!(await fs.exists(indexPath, options))) return null;
    return JSON.parse(await fs.readTextFile(indexPath, options));
}

export async function saveIndex(data) {
    if (!fs) return localStorage.setItem("jotter-data", JSON.stringify(data));
    await setup;
    await fs.writeTextFile(indexPath, JSON.stringify(data, null, 2), options);
}

export async function loadPage(id) {
    if (!fs) return localStorage.getItem(`jotter-page-${id}`) || "";
    await setup;
    if (!(await fs.exists(pagePath(id), options))) return "";
    return fs.readTextFile(pagePath(id), options);
}

export async function savePage(id, html) {
    if (!fs) return localStorage.setItem(`jotter-page-${id}`, html);
    await setup;
    await fs.writeTextFile(pagePath(id), html, options);
}

export async function deletePage(id) {
    if (!fs) return localStorage.removeItem(`jotter-page-${id}`);
    await setup;
    if (await fs.exists(pagePath(id), options)) await fs.remove(pagePath(id), options);
}