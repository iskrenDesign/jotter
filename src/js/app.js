import { editor } from "./editor.js";
import { placeMenu } from "./menus.js";
import { confirmDialog } from "./dialog.js";
import { loadIndex, saveIndex, loadPage, savePage, deletePage } from "./storage.js";
import { saveJotFile } from "./jot.js";

// Elements
const app = document.querySelector(".app");
const sidebarPages = document.querySelector(".sidebar-pages");
const pageTemplate = document.querySelector("#page-item-template");
const groupTemplate = document.querySelector("#page-group-template");
const moveItemTemplate = document.querySelector("#move-item-template");
const pinnedTemplate = document.querySelector("#pinned-item-template");
const groupMenu = document.querySelector("#group-menu");
const pageMenu = document.querySelector("#page-menu");
const moveMenu = document.querySelector("#move-menu");
const pageTitle = document.querySelector(".page-title");
const headerPageMenu = document.querySelector(".header-page-menu");
const searchInput = document.querySelector(".search-input");

// State
let activeGroup = null;  // the group whose menu is open
let activePage = null;   // the page whose menu is open
let selectedPage = null; // the page shown in the editor
let hoveredItem = null;  // the page or group header under the mouse

// Sidebar collapse
const narrowScreen = matchMedia("(max-width: 82rem)");

document.querySelectorAll(".sidebar-toggle").forEach((button) => {
    button.addEventListener("click", () => {
        app.classList.toggle("sidebar-collapsed");
    });
});

function fitSidebar() {
    app.classList.toggle("sidebar-collapsed", narrowScreen.matches);
}

narrowScreen.addEventListener("change", fitSidebar);
fitSidebar();

// Theme
const themeButtons = document.querySelectorAll(".theme-button");
const systemDark = matchMedia("(prefers-color-scheme: dark)");
let currentTheme = document.documentElement.dataset.theme;

function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.dataset.theme = theme;
    themeButtons.forEach((button) => {
        button.setAttribute("aria-pressed", button.dataset.themeChoice === theme);
    });
}

themeButtons.forEach((button) => {
    button.addEventListener("click", () => {
        localStorage.setItem("jotter-theme", button.dataset.themeChoice);
        applyTheme(button.dataset.themeChoice);
    });
});

systemDark.addEventListener("change", () => {
    if (!localStorage.getItem("jotter-theme")) applyTheme(systemDark.matches ? "dark" : "light");
});

applyTheme(document.documentElement.dataset.theme);

// Always print in the light theme
window.addEventListener("beforeprint", () => {
    document.documentElement.dataset.theme = "light";
});

window.addEventListener("afterprint", () => {
    document.documentElement.dataset.theme = currentTheme;
});

// Create pages and groups
function formatToday() {
    return new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function createPage(pageList, title = "New page", date = formatToday(), id = crypto.randomUUID()) {
    const newPage = pageTemplate.content.cloneNode(true);
    const page = newPage.querySelector(".page-item");
    page.dataset.id = id;
    page.querySelector(".page-item-title").textContent = title;
    page.querySelector(".page-item-date").textContent = date;
    pageList.append(newPage);
    return page;
}

function createGroup(name = "New folder") {
    const newGroup = groupTemplate.content.cloneNode(true);
    const group = newGroup.querySelector(".page-group");
    group.querySelector(".page-group-title").textContent = name;
    sidebarPages.append(newGroup);
    return group;
}

function removePageContent(page) {
    deletePage(page.dataset.id);
}

// Select page
async function selectPage(page) {
    document.querySelectorAll(".page-item[aria-current]").forEach((item) => item.removeAttribute("aria-current"));
    selectedPage = page;
    document.querySelectorAll(`.page-item[data-id="${page.dataset.id}"]`).forEach((item) => item.setAttribute("aria-current", "page"));
    pageTitle.textContent = page.querySelector(".page-item-title").textContent;
    headerPageMenu.hidden = false;
    const content = await loadPage(page.dataset.id);
    if (selectedPage !== page) return;
    editor.commands.setContent(content, { emitUpdate: false });
    editor.setEditable(true);
    localStorage.setItem("jotter-last-page", page.dataset.id);
}

function clearSelection() {
    selectedPage = null;
    pageTitle.textContent = "";
    headerPageMenu.hidden = true;
    editor.commands.clearContent();
    editor.setEditable(false);
}

// Pinned pages: a copy of the page is shown in the Pinned section at the top
function originalOf(item) {
    if (!item || !item.closest(".pinned-list")) return item;
    return document.querySelector(`.page-group .page-item[data-id="${item.dataset.id}"]`);
}

function renderPinned() {
    const pinnedList = document.querySelector(".pinned-list");
    const pinned = [...document.querySelectorAll(".page-group .page-item[data-pinned-at]")]
        .sort((a, b) => a.dataset.pinnedAt - b.dataset.pinnedAt);
    pinnedList.replaceChildren();
    pinned.forEach((page) => {
        const copy = pinnedTemplate.content.cloneNode(true);
        const item = copy.querySelector(".page-item");
        item.dataset.id = page.dataset.id;
        item.querySelector(".page-item-title").textContent = page.querySelector(".page-item-title").textContent;
        item.querySelector(".page-item-date").textContent = page.querySelector(".page-item-date").textContent;
        if (page === selectedPage) item.setAttribute("aria-current", "page");
        pinnedList.append(copy);
    });
}

function togglePin(page) {
    if (!page) return;
    if (page.dataset.pinnedAt) delete page.dataset.pinnedAt;
    else page.dataset.pinnedAt = Date.now();
    renderPinned();
}

// Page menu
function preparePageMenu(page) {
    activePage = page;
    pageMenu.querySelector('[data-action="pin-page"] .menu-item-label').textContent =
        page.dataset.pinnedAt ? "Unpin page" : "Pin page";
    pageMenu.querySelector(".menu-item-move").hidden = document.querySelectorAll(".page-group").length < 2;
}

headerPageMenu.addEventListener("click", () => {
    const rect = headerPageMenu.getBoundingClientRect();
    placeMenu(pageMenu, rect.bottom + 4, rect.right, "end");
    preparePageMenu(selectedPage);
});

// New page at the top of a group
function addPage(group) {
    const pageList = group.querySelector(".page-list");
    const page = createPage(pageList);
    pageList.prepend(page);
    selectPage(page);
}

// Sidebar clicks: + new page, chevron, group ⋮, page ⋮, select page
document.addEventListener("click", (event) => {
    // Export mode: clicking a page or folder ticks it instead of opening it
    if (app.classList.contains("export-mode")) {
        if (event.target.closest(".select-box")) return;
        const row = event.target.closest(".page-group .page-item, .page-group-header");
        if (row && !event.target.closest("button")) {
            row.querySelector(".select-box").click();
            return;
        }
    }
    const addPageButton = event.target.closest(".add-page-button");
        if (addPageButton) {
            addPage(addPageButton.closest(".page-group"));
        return;
    }

    const toggle = event.target.closest(".page-group-toggle");
    if (toggle) {
        const isExpanded = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", !isExpanded);
        toggle.closest(".page-group").classList.toggle("page-group-collapsed");
        return;
    }

    const groupMenuButton = event.target.closest(".group-menu-button");
    if (groupMenuButton) {
        const rect = groupMenuButton.getBoundingClientRect();
        placeMenu(groupMenu, rect.bottom + 4, rect.left);
        activeGroup = groupMenuButton.closest(".page-group");
        return;
    }

    const pageMenuButton = event.target.closest(".page-item-menu");
    if (pageMenuButton) {
        const rect = pageMenuButton.getBoundingClientRect();
        placeMenu(pageMenu, rect.bottom + 4, rect.left);
        preparePageMenu(originalOf(pageMenuButton.closest(".page-item")));
        return;
    }

    const unpinButton = event.target.closest(".unpin-button");
    if (unpinButton) {
        togglePin(originalOf(unpinButton.closest(".page-item")));
        return;
    }

    const page = event.target.closest(".page-item");
    if (page) {
        selectPage(originalOf(page));
        if (narrowScreen.matches) app.classList.add("sidebar-collapsed");
    }
});

// Rename
function startRename(title) {
    title.contentEditable = "true";
    title.focus();
    document.getSelection().selectAllChildren(title);
}

const pinPageButton = pageMenu.querySelector('[data-action="pin-page"]');

pinPageButton.addEventListener("click", () => {
    pageMenu.hidePopover();
    togglePin(activePage);
});

const renamePageButton = pageMenu.querySelector('[data-action="rename-page"]');

renamePageButton.addEventListener("click", () => {
    pageMenu.hidePopover();
    const pageGroup = activePage.closest(".page-group");
    if (pageGroup.classList.contains("page-group-collapsed")) pageGroup.querySelector(".page-group-toggle").click();
    startRename(activePage.querySelector(".page-item-title"));
});

const renameGroupButton = groupMenu.querySelector('[data-action="rename-group"]');

renameGroupButton.addEventListener("click", () => {
    groupMenu.hidePopover();
    startRename(activeGroup.querySelector(".page-group-title"));
});

// Finish renaming: Enter or click elsewhere
document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.matches(".page-item-title, .page-group-title")) {
        event.preventDefault();
        event.target.blur();
    }
});

document.addEventListener("focusout", (event) => {
    if (event.target.matches(".page-item-title, .page-group-title")) {
        event.target.contentEditable = "false";
        event.target.scrollLeft = 0;
        if (selectedPage && selectedPage.contains(event.target)) pageTitle.textContent = event.target.textContent;
        renderPinned();
    }
});

// Add new folder/group
const addGroupButton = groupMenu.querySelector('[data-action="add-group"]');

addGroupButton.addEventListener("click", () => {
    groupMenu.hidePopover();
    const group = createGroup();
    startRename(group.querySelector(".page-group-title"));
});

// Delete folder/group
const deleteGroupButton = groupMenu.querySelector('[data-action="delete-group"]');

deleteGroupButton.addEventListener("click", async () => {
    if (document.querySelectorAll(".page-group").length === 1) return;
    groupMenu.hidePopover();
    const group = activeGroup;
    const pages = group.querySelectorAll(".page-item");

    if (pages.length > 0) {
        const confirmed = await confirmDialog({
            title: "Delete this folder?",
            message: "This will permanently delete the folder and all of its contents. This action cannot be undone!",
            cancelLabel: "Keep folder",
            confirmLabel: "Delete folder",
        });
        if (!confirmed) return;
    }

    if (group.contains(selectedPage)) clearSelection();
    pages.forEach(removePageContent);
    group.remove();
    renderPinned();
});

// Delete page
const deletePageButton = pageMenu.querySelector('[data-action="delete-page"]');

deletePageButton.addEventListener("click", async () => {
    pageMenu.hidePopover();
    const page = activePage;

    const confirmed = await confirmDialog({
        title: "Delete this page?",
        message: "This will permanently delete the page and all of its contents. This action cannot be undone!",
        cancelLabel: "Keep page",
        confirmLabel: "Delete page",
    });
    if (!confirmed) return;

    if (page === selectedPage) clearSelection();
    removePageContent(page);
    page.remove();
    renderPinned();
});

// Move page to group
const movePageButton = pageMenu.querySelector('[data-action="move-page"]');

movePageButton.addEventListener("click", () => {
    const itemRect = movePageButton.getBoundingClientRect();
    const menuRect = pageMenu.getBoundingClientRect();
    if (menuRect.right + 4 + menuRect.width <= window.innerWidth) {
        placeMenu(moveMenu, itemRect.top, menuRect.right + 4);
    } else {
        placeMenu(moveMenu, itemRect.top, menuRect.left - 4, "end");
    }

    moveMenu.replaceChildren();
    const currentGroup = activePage.closest(".page-group");

    document.querySelectorAll(".page-group").forEach((group) => {
        if (group === currentGroup) return;
        const item = moveItemTemplate.content.cloneNode(true);
        item.querySelector(".menu-item-label").textContent = group.querySelector(".page-group-title").textContent;
        item.querySelector(".menu-item").addEventListener("click", () => {
            group.querySelector(".page-list").append(activePage);
            pageMenu.hidePopover();
        });
        moveMenu.append(item);
    });
});

// Search
searchInput.addEventListener("input", () => {
    const keyword = searchInput.value.trim().toLowerCase();
    document.querySelectorAll(".page-item").forEach((page) => {
        const title = page.querySelector(".page-item-title").textContent.toLowerCase();
        page.hidden = !title.includes(keyword);
    });
});

// Export as .jot: tick groups and pages, then save them as one file
const exportMenu = document.querySelector("#export-menu");
const exportButton = document.querySelector(".export-button");
const exportCancelButton = document.querySelector(".export-cancel");

function pageBoxes(group) {
    return [...group.querySelectorAll(".page-item .select-box")];
}

// A folder box is ticked when all its pages are ticked, and half-ticked when only some are
function updateGroupBox(group) {
    const boxes = pageBoxes(group);
    const ticked = boxes.filter((box) => box.checked).length;
    const groupBox = group.querySelector(".page-group-header .select-box");
    groupBox.checked = boxes.length > 0 && ticked === boxes.length;
    groupBox.indeterminate = ticked > 0 && ticked < boxes.length;
}

function updateExportButton() {
    exportButton.hidden = !document.querySelector(".page-group .page-item .select-box:checked");
}

sidebarPages.addEventListener("change", (event) => {
    const box = event.target.closest(".select-box");
    if (!box) return;
    const group = box.closest(".page-group");
    if (box.closest(".page-group-header")) pageBoxes(group).forEach((pageBox) => (pageBox.checked = box.checked));
    updateGroupBox(group);
    updateExportButton();
});

// item is a page (ticks that page) or a folder (ticks all of its pages)
function startExport(item) {
    document.querySelectorAll(".select-box").forEach((box) => {
        box.checked = false;
        box.indeterminate = false;
    });
    const group = item.closest(".page-group");
    if (item.matches(".page-group")) pageBoxes(group).forEach((box) => (box.checked = true));
    else item.querySelector(".select-box").checked = true;
    updateGroupBox(group);
    updateExportButton();
    app.classList.remove("sidebar-collapsed");
    app.classList.add("export-mode");
}

function cancelExport() {
    app.classList.remove("export-mode");
}

async function exportSelection() {
    const groups = [];
    for (const group of document.querySelectorAll(".page-group")) {
        const pages = [];
        for (const page of group.querySelectorAll(".page-item")) {
            if (!page.querySelector(".select-box").checked) continue;
            pages.push({
                title: page.querySelector(".page-item-title").textContent,
                date: page.querySelector(".page-item-date").textContent,
                pinned: Boolean(page.dataset.pinnedAt),
                // The open page may have changes that are not saved yet
                content: page === selectedPage ? editor.getHTML() : await loadPage(page.dataset.id),
            });
        }
        if (pages.length > 0) {
            groups.push({
                name: group.querySelector(".page-group-title").textContent,
                collapsed: group.classList.contains("page-group-collapsed"),
                pages,
            });
        }
    }
    if (groups.length === 0) return;

    let fileName = "Jotter export";
    if (groups.length === 1) fileName = groups[0].pages.length === 1 ? groups[0].pages[0].title : groups[0].name;

    try {
        if (await saveJotFile(groups, fileName)) cancelExport();
    } catch (error) {
        console.error(error);
        alert(`The file could not be saved.\n\n${error}`);
    }
}

const exportPageButton = pageMenu.querySelector('[data-action="export-page"]');

exportPageButton.addEventListener("click", () => {
    const itemRect = exportPageButton.getBoundingClientRect();
    const menuRect = pageMenu.getBoundingClientRect();
    if (menuRect.right + 4 + menuRect.width <= window.innerWidth) {
        placeMenu(exportMenu, itemRect.top, menuRect.right + 4);
    } else {
        placeMenu(exportMenu, itemRect.top, menuRect.left - 4, "end");
    }
});

exportMenu.addEventListener("click", (event) => {
    const item = event.target.closest("[data-export]");
    if (!item || item.disabled) return;
    pageMenu.hidePopover();
    if (item.dataset.export === "jot") startExport(activePage);
});

const exportGroupButton = groupMenu.querySelector('[data-action="export-group"]');

exportGroupButton.addEventListener("click", () => {
    groupMenu.hidePopover();
    startExport(activeGroup);
});

exportButton.addEventListener("click", exportSelection);
exportCancelButton.addEventListener("click", cancelExport);

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") cancelExport();
});

// Keyboard shortcuts
document.addEventListener("mouseover", (event) => {
    hoveredItem = event.target.closest(".page-item, .page-group-header");
});

document.addEventListener("keydown", (event) => {
    if (!event.ctrlKey) return;
    const key = event.key.toLowerCase();

    // Ctrl+R would reload the app window, so always block it
    if (key === "r") event.preventDefault();

    // Ctrl+N: new page, Ctrl+Shift+N: new group (these work while typing too)
    if (key === "n") {
        event.preventDefault();
        if (event.shiftKey) addGroupButton.click();
        else addPage(selectedPage?.closest(".page-group") || document.querySelector(".page-group"));
        return;
    }

    // Ctrl+Shift+P: pin or unpin (works while typing too)
    if (key === "p" && event.shiftKey) {
        event.preventDefault();
        const hovered = hoveredItem?.matches(".page-item") ? hoveredItem : null;
        togglePin(originalOf(event.target.isContentEditable ? selectedPage : hovered || selectedPage));
        return;
    }

    if (event.target.isContentEditable || event.target.matches("input")) return;

    const target = hoveredItem || selectedPage;
    if (!target || (key !== "r" && key !== "d")) return;
    event.preventDefault();

    if (target.matches(".page-item")) {
        activePage = originalOf(target);
        if (key === "r") renamePageButton.click();
        if (key === "d") deletePageButton.click();
    } else {
        activeGroup = target.closest(".page-group");
        if (key === "r") renameGroupButton.click();
        if (key === "d") deleteGroupButton.click();
    }
});

// Save and load the sidebar
function updateEmptyState() {
    app.classList.toggle("no-pages", !document.querySelector(".page-item"));
}

function saveData() {
    updateEmptyState();
    const data = [];
    document.querySelectorAll(".page-group").forEach((group) => {
        const pages = [];
        group.querySelectorAll(".page-item").forEach((page) => {
            pages.push({
                id: page.dataset.id,
                title: page.querySelector(".page-item-title").textContent,
                date: page.querySelector(".page-item-date").textContent,
                pinnedAt: Number(page.dataset.pinnedAt) || 0,
            });
        });
        data.push({
            name: group.querySelector(".page-group-title").textContent,
            collapsed: group.classList.contains("page-group-collapsed"),
            pages: pages,
        });
    });
    saveIndex(data);
}

async function loadData() {
    const saved = await loadIndex();
    if (saved) {
        saved.forEach((groupData) => {
            const group = createGroup(groupData.name);
            if (groupData.collapsed) {
                group.classList.add("page-group-collapsed");
                group.querySelector(".page-group-toggle").setAttribute("aria-expanded", "false");
            }
            groupData.pages.forEach((pageData) => {
                const page = createPage(group.querySelector(".page-list"), pageData.title, pageData.date, pageData.id);
                if (pageData.pinnedAt) page.dataset.pinnedAt = pageData.pinnedAt;
            });
        });
    }
    if (!document.querySelector(".page-group")) createGroup();
}

await loadData();
renderPinned();
updateEmptyState();

// Reopen the last page, or the first one
const lastPageId = localStorage.getItem("jotter-last-page");
const startPage = document.querySelector(`.page-group .page-item[data-id="${lastPageId}"]`) || document.querySelector(".page-group .page-item");
if (startPage) selectPage(startPage);

new MutationObserver(saveData).observe(sidebarPages, { childList: true, subtree: true, characterData: true, attributes: true });

// Save page content, half a second after typing stops
const saveTimers = {};

editor.on("update", () => {
    if (!selectedPage) return;
    const id = selectedPage.dataset.id;
    const html = editor.getHTML();
    clearTimeout(saveTimers[id]);
    saveTimers[id] = setTimeout(() => savePage(id, html), 500);
});

// Drag and drop: reorder groups (mouse, pen and touch use the same code)
const dropLine = document.createElement("div");
dropLine.className = "drop-line";
dropLine.hidden = true;
document.body.append(dropLine);

const dropBox = document.createElement("div");
dropBox.className = "drop-box";
dropBox.hidden = true;
document.body.append(dropBox);

let pending = null; // pointer is down on a group header or a page, drag has not started yet
let drag = null;    // something is being dragged

function allGroups() {
    return [...sidebarPages.querySelectorAll(":scope > .page-group")];
}

function otherGroups(group) {
    return allGroups().filter((item) => item !== group);
}

sidebarPages.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (app.classList.contains("export-mode")) return;
    if (event.target.closest("button, [contenteditable='true']")) return;

    const page = event.target.closest(".page-item");
    const header = event.target.closest(".page-group-header");
    let item = null;
    if (page) {
        if (!page.closest(".pinned-list")) item = page; // pinned copies cannot be dragged
    } else if (header) {
        item = header.closest(".page-group");
    }
    if (!item || allGroups().length < 2) return;

    pending = {
        item,
        kind: item.matches(".page-item") ? "page" : "group",
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        touch: event.pointerType === "touch",
        timer: null,
    };
    // Touch: hold for 300 ms to start dragging, so normal scrolling still works
    if (pending.touch) pending.timer = setTimeout(() => pending && beginDrag(), 300);
});

function beginDrag() {
    const { item, kind, id, x, y, timer } = pending;
    clearTimeout(timer);
    pending = null;

    const rect = item.getBoundingClientRect();
    const ghost = item.cloneNode(true);
    ghost.classList.add("drag-ghost");
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.width = rect.width + "px";
    app.append(ghost);

    item.classList.add("is-dragging");
    document.body.classList.add("is-dragging-group");
    document.getSelection().removeAllRanges();
    try { sidebarPages.setPointerCapture(id); } catch {}

    drag = { item, kind, ghost, offsetX: x - rect.left, offsetY: y - rect.top, before: null, target: null };
}

function moveDrag(x, y) {
    const { item, kind, ghost, offsetX, offsetY } = drag;
    ghost.style.left = x - offsetX + "px";
    ghost.style.top = y - offsetY + "px";

    // Scroll the sidebar when the pointer is near its top or bottom edge
    const area = sidebarPages.getBoundingClientRect();
    if (y < area.top + 40) sidebarPages.scrollTop -= 12;
    if (y > area.bottom - 40) sidebarPages.scrollTop += 12;

    if (kind === "group") {
        // Above the middle of a group's header = drop before it, otherwise after it
        const others = otherGroups(item);
        drag.before = others.find((group) => {
            const header = group.querySelector(".page-group-header").getBoundingClientRect();
            return y < header.top + header.height / 2;
        }) || null;

        const lineY = drag.before
            ? drag.before.getBoundingClientRect().top - 8
            : others.at(-1).getBoundingClientRect().bottom + 8;
        dropLine.style.top = lineY - 1 + "px";
        dropLine.style.left = area.left + 8 + "px";
        dropLine.style.width = area.width - 16 + "px";
        dropLine.hidden = false;
    } else {
        // The group under the pointer (the 8px margin covers the gap between groups)
        const current = item.closest(".page-group");
        drag.target = allGroups().find((group) => {
            const rect = group.getBoundingClientRect();
            return y > rect.top - 8 && y < rect.bottom + 8;
        }) || null;
        if (drag.target === current) drag.target = null;

        if (drag.target) {
            const rect = drag.target.getBoundingClientRect();
            dropBox.style.top = rect.top - 4 + "px";
            dropBox.style.left = rect.left - 4 + "px";
            dropBox.style.width = rect.width + 8 + "px";
            dropBox.style.height = rect.height + 8 + "px";
        }
        dropBox.hidden = !drag.target;
    }
}

function endDrag(drop) {
    if (pending) {
        clearTimeout(pending.timer);
        pending = null;
    }
    if (!drag) return;

    const { item, kind, ghost, before, target } = drag;
    if (drop && kind === "group") {
        if (before) before.before(item);
        else otherGroups(item).at(-1).after(item);
    }
    if (drop && kind === "page" && target) {
        // Open a collapsed group so the moved page is visible
        if (target.classList.contains("page-group-collapsed")) target.querySelector(".page-group-toggle").click();
        target.querySelector(".page-list").append(item);
    }
    ghost.remove();
    item.classList.remove("is-dragging");
    dropLine.hidden = true;
    dropBox.hidden = true;
    document.body.classList.remove("is-dragging-group");
    drag = null;
}

document.addEventListener("pointermove", (event) => {
    if (pending) {
        pending.x = event.clientX;
        pending.y = event.clientY;
        const moved = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY);
        if (pending.touch && moved > 10) {
            clearTimeout(pending.timer); // the finger is scrolling, not dragging
            pending = null;
        } else if (!pending.touch && moved > 5) {
            beginDrag();
        }
    }
    if (drag) moveDrag(event.clientX, event.clientY);
});

document.addEventListener("pointerup", () => endDrag(true));
document.addEventListener("pointercancel", () => endDrag(false));
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") endDrag(false);
});

// While dragging: no page scrolling by touch, no long-press menu
document.addEventListener("touchmove", (event) => {
    if (drag) event.preventDefault();
}, { passive: false });

document.addEventListener("contextmenu", (event) => {
    if (pending || drag) event.preventDefault();
});

// While dragging: no page scrolling by touch, no long-press menu
document.addEventListener("touchmove", (event) => {
    if (drag) event.preventDefault();
}, { passive: false });

document.addEventListener("contextmenu", (event) => {
    if (pending || drag) event.preventDefault();
});