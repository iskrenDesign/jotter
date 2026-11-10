// .jot files: one plain-text (JSON) file that holds folders, pages and everything in them
const dialog = window.__TAURI__?.dialog;
const fs = window.__TAURI__?.fs;

export const JOT_VERSION = 1;

function cleanFileName(name) {
    const cleaned = name.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
    return cleaned || "Jotter export";
}

// folders: [{ name, collapsed, pages: [{ title, date, pinned, content }] }]
// Returns true when the file was saved, false when the person cancelled
export async function saveJotFile(groups, fileName) {
    const text = JSON.stringify({
        app: "jotter",
        format: "jot",
        version: JOT_VERSION,
        exportedAt: new Date().toISOString(),
        groups,
    }, null, 2);
    const name = cleanFileName(fileName) + ".jot";

    // Desktop app: ask where to save, then write the file
    if (dialog && fs) {
        const path = await dialog.save({
            defaultPath: name,
            filters: [{ name: "Jotter file", extensions: ["jot"] }],
        });
        if (!path) return false;
        await fs.writeTextFile(path, text);
        return true;
    }

    // Browser (Live Server): download the file
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    return true;
}