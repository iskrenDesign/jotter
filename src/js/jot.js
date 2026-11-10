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


// Asks for a .jot file and returns its text, or null when the person cancelled
export async function openJotFile() {
    // Desktop app: ask which file to open, then read it
    if (dialog && fs) {
        const picked = await dialog.open({
            multiple: false,
            filters: [{ name: "Jotter file", extensions: ["jot"] }],
        });
        if (!picked) return null;
        return fs.readTextFile(typeof picked === "string" ? picked : picked.path);
    }

    // Browser (Live Server): pick a file with a hidden input
    return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".jot";
        input.addEventListener("change", () => resolve(input.files[0] ? input.files[0].text() : null));
        input.addEventListener("cancel", () => resolve(null));
        input.click();
    });
}

// Checks the file and returns clean groups, or throws an error with a message for the person
export function parseJotFile(raw) {
    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        throw new Error("This is not a valid .jot file.");
    }
    if (!data || data.format !== "jot" || !Array.isArray(data.groups)) {
        throw new Error("This is not a valid .jot file.");
    }
    if (!Number.isInteger(data.version) || data.version < 1 || data.version > JOT_VERSION) {
        throw new Error("This file was made with a newer version of Jotter. Please update Jotter and try again.");
    }

    const clean = (value, fallback, max) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback);

    const groups = data.groups
        .map((group) => ({
            name: clean(group?.name, "Imported folder", 100),
            pages: (Array.isArray(group?.pages) ? group.pages : []).map((page) => ({
                title: clean(page?.title, "Untitled", 200),
                date: /^\d{2}\.\d{2}\.\d{4}$/.test(page?.date) ? page.date : "",
                pinned: page?.pinned === true,
                content: typeof page?.content === "string" ? page.content : "",
            })),
        }))
        .filter((group) => group.pages.length > 0);

    if (groups.length === 0) throw new Error("This file does not contain any pages.");
    return groups;
}