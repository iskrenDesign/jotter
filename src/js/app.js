import { editor } from "./editor.js";
import { placeMenu } from "./menus.js";
import { confirmDialog } from "./dialog.js";

// Elements
const app = document.querySelector(".app");
const sidebarPages = document.querySelector(".sidebar-pages");
const pageTemplate = document.querySelector("#page-item-template");
const groupTemplate = document.querySelector("#page-group-template");
const moveItemTemplate = document.querySelector("#move-item-template");
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

function createPage(pageList, title = "Untitled", date = formatToday(), id = crypto.randomUUID()) {
    const newPage = pageTemplate.content.cloneNode(true);
    const page = newPage.querySelector(".page-item");
    page.dataset.id = id;
    page.querySelector(".page-item-title").textContent = title;
    page.querySelector(".page-item-date").textContent = date;
    pageList.append(newPage);
    return page;
}

function createGroup(name = "New group") {
    const newGroup = groupTemplate.content.cloneNode(true);
    const group = newGroup.querySelector(".page-group");
    group.querySelector(".page-group-title").textContent = name;
    sidebarPages.append(newGroup);
    return group;
}

function removePageContent(page) {
    localStorage.removeItem(`jotter-page-${page.dataset.id}`);
}

// Select page
function selectPage(page) {
    if (selectedPage) selectedPage.removeAttribute("aria-current");
    selectedPage = page;
    page.setAttribute("aria-current", "page");
    pageTitle.textContent = page.querySelector(".page-item-title").textContent;
    headerPageMenu.hidden = false;
    editor.commands.setContent(localStorage.getItem(`jotter-page-${page.dataset.id}`) || "", { emitUpdate: false });
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

// Page menu
function preparePageMenu(page) {
    activePage = page;
    pageMenu.querySelector(".menu-item-move").hidden = document.querySelectorAll(".page-group").length < 2;
}

headerPageMenu.addEventListener("click", () => {
    const rect = headerPageMenu.getBoundingClientRect();
    placeMenu(pageMenu, rect.bottom + 4, rect.right, "end");
    preparePageMenu(selectedPage);
});

// Sidebar clicks: + new page, chevron, group ⋮, page ⋮, select page
document.addEventListener("click", (event) => {
    const addPageButton = event.target.closest(".add-page-button");
        if (addPageButton) {
        const pageList = addPageButton.closest(".page-group").querySelector(".page-list");
        const page = createPage(pageList);
        pageList.prepend(page);
        selectPage(page);
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
        preparePageMenu(pageMenuButton.closest(".page-item"));
        return;
    }

    const page = event.target.closest(".page-item");
    if (page) {
        selectPage(page);
        if (narrowScreen.matches) app.classList.add("sidebar-collapsed");
    }
});

// Rename
function startRename(title) {
    title.contentEditable = "true";
    title.focus();
    document.getSelection().selectAllChildren(title);
}

const renamePageButton = pageMenu.querySelector('[data-action="rename-page"]');

renamePageButton.addEventListener("click", () => {
    pageMenu.hidePopover();
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
        if (selectedPage && selectedPage.contains(event.target)) pageTitle.textContent = event.target.textContent;
    }
});

// Add new group
const addGroupButton = groupMenu.querySelector('[data-action="add-group"]');

addGroupButton.addEventListener("click", () => {
    groupMenu.hidePopover();
    const group = createGroup();
    startRename(group.querySelector(".page-group-title"));
});

// Delete group
const deleteGroupButton = groupMenu.querySelector('[data-action="delete-group"]');

deleteGroupButton.addEventListener("click", async () => {
    if (document.querySelectorAll(".page-group").length === 1) return;
    groupMenu.hidePopover();
    const group = activeGroup;
    const pages = group.querySelectorAll(".page-item");

    if (pages.length > 0) {
        const confirmed = await confirmDialog({
            title: "Delete this group?",
            message: "This will permanently delete the group and all its contents. This action cannot be undone.",
            cancelLabel: "Keep group",
            confirmLabel: "Delete group",
        });
        if (!confirmed) return;
    }

    if (group.contains(selectedPage)) clearSelection();
    pages.forEach(removePageContent);
    group.remove();
});

// Delete page
const deletePageButton = pageMenu.querySelector('[data-action="delete-page"]');

deletePageButton.addEventListener("click", async () => {
    pageMenu.hidePopover();
    const page = activePage;

    const confirmed = await confirmDialog({
        title: "Delete this page?",
        message: "This will permanently delete the page and its content. This action cannot be undone.",
        cancelLabel: "Keep page",
        confirmLabel: "Delete page",
    });
    if (!confirmed) return;

    if (page === selectedPage) clearSelection();
    removePageContent(page);
    page.remove();
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

// Keyboard shortcuts
document.addEventListener("mouseover", (event) => {
    hoveredItem = event.target.closest(".page-item, .page-group-header");
});

document.addEventListener("keydown", (event) => {
    if (!event.ctrlKey || event.target.isContentEditable || event.target.matches("input")) return;
    const key = event.key.toLowerCase();

    if (key === "n" && event.shiftKey) {
        event.preventDefault();
        addGroupButton.click();
        return;
    }

    const target = hoveredItem || selectedPage;
    if (!target || (key !== "r" && key !== "d")) return;
    event.preventDefault();

    if (target.matches(".page-item")) {
        activePage = target;
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
            });
        });
        data.push({
            name: group.querySelector(".page-group-title").textContent,
            collapsed: group.classList.contains("page-group-collapsed"),
            pages: pages,
        });
    });
    localStorage.setItem("jotter-data", JSON.stringify(data));
}

function loadData() {
    const saved = localStorage.getItem("jotter-data");
    if (saved) {
        JSON.parse(saved).forEach((groupData) => {
            const group = createGroup(groupData.name);
            if (groupData.collapsed) {
                group.classList.add("page-group-collapsed");
                group.querySelector(".page-group-toggle").setAttribute("aria-expanded", "false");
            }
            groupData.pages.forEach((pageData) => {
                createPage(group.querySelector(".page-list"), pageData.title, pageData.date, pageData.id);
            });
        });
    }
    if (!document.querySelector(".page-group")) createGroup();
}

loadData();
updateEmptyState();

// Reopen the last page, or the first one
const lastPageId = localStorage.getItem("jotter-last-page");
const startPage = document.querySelector(`.page-item[data-id="${lastPageId}"]`) || document.querySelector(".page-item");
if (startPage) selectPage(startPage);

new MutationObserver(saveData).observe(sidebarPages, { childList: true, subtree: true, characterData: true, attributes: true });

// Save page content
editor.on("update", () => {
    if (!selectedPage) return;
    try {
        localStorage.setItem(`jotter-page-${selectedPage.dataset.id}`, editor.getHTML());
    } catch {
        alert("Storage is full. Remove some images to keep saving this page.");
    }
});