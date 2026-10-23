import { editor } from "./editor.js";

// Sidebar collapse
const app = document.querySelector(".app");
const toggleButtons = document.querySelectorAll(".sidebar-toggle");

toggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
        app.classList.toggle("sidebar-collapsed");
    });
});

// Create pages
const pageTemplate = document.querySelector("#page-item-template");

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

// Create groups
const groupTemplate = document.querySelector("#page-group-template");
const sidebarPages = document.querySelector(".sidebar-pages");

function createGroup(name = "New group") {
    const newGroup = groupTemplate.content.cloneNode(true);
    const group = newGroup.querySelector(".page-group");
    group.querySelector(".page-group-title").textContent = name;
    sidebarPages.append(newGroup);
    return group;
}

// Menus
const groupMenu = document.querySelector("#group-menu");
const pageMenu = document.querySelector("#page-menu");
let activeGroup = null;
let activePage = null;

// Group buttons: + new page, chevron, ⋮ menu
document.addEventListener("click", (event) => {
    const addPageButton = event.target.closest(".add-page-button");
    if (addPageButton) {
        const pageList = addPageButton.closest(".page-group").querySelector(".page-list");
        const page = createPage(pageList);
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
        groupMenu.style.top = `${rect.bottom + 4}px`;
        groupMenu.style.left = `${rect.left}px`;
        activeGroup = groupMenuButton.closest(".page-group");
    }
});

// Page ⋮ menu in the sidebar
document.addEventListener("click", (event) => {
    const button = event.target.closest(".page-item-menu");
    if (!button) return;
    const rect = button.getBoundingClientRect();
    pageMenu.style.top = `${rect.bottom + 4}px`;
    pageMenu.style.left = `${rect.left}px`;
    pageMenu.style.right = "auto";
    activePage = button.closest(".page-item");
    pageMenu.querySelector(".menu-item-move").hidden = document.querySelectorAll(".page-group").length < 2;
});

// Page ⋮ menu in the main header
const headerPageMenu = document.querySelector(".header-page-menu");

headerPageMenu.addEventListener("click", () => {
    const rect = headerPageMenu.getBoundingClientRect();
    pageMenu.style.top = `${rect.bottom + 4}px`;
    pageMenu.style.left = "auto";
    pageMenu.style.right = `${window.innerWidth - rect.right}px`;
    activePage = selectedPage;
    pageMenu.querySelector(".menu-item-move").hidden = document.querySelectorAll(".page-group").length < 2;
});

// Select page
const pageTitle = document.querySelector(".page-title");
let selectedPage = null;

function selectPage(page) {
    if (selectedPage) selectedPage.removeAttribute("aria-current");
    selectedPage = page;
    page.setAttribute("aria-current", "page");
    pageTitle.textContent = page.querySelector(".page-item-title").textContent;
    headerPageMenu.hidden = false;
    editor.commands.setContent(localStorage.getItem(`jotter-page-${page.dataset.id}`) || "", { emitUpdate: false });
    editor.setEditable(true);
}

function clearSelection() {
    selectedPage = null;
    pageTitle.textContent = "";
    headerPageMenu.hidden = true;
    editor.commands.clearContent();
    editor.setEditable(false);
}

document.addEventListener("click", (event) => {
    const page = event.target.closest(".page-item");
    if (!page || event.target.closest(".page-item-menu")) return;
    selectPage(page);
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

// Finish editing: Enter or click elsewhere
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

deleteGroupButton.addEventListener("click", () => {
    if (document.querySelectorAll(".page-group").length === 1) return;
    groupMenu.hidePopover();
    const pageCount = activeGroup.querySelectorAll(".page-item").length;
    if (pageCount > 0 && !confirm(`Delete this group and its ${pageCount} pages?`)) return;
    if (activeGroup.contains(selectedPage)) clearSelection();
    activeGroup.querySelectorAll(".page-item").forEach((page) => localStorage.removeItem(`jotter-page-${page.dataset.id}`));
    activeGroup.remove();
});

// Delete page
const deletePageButton = pageMenu.querySelector('[data-action="delete-page"]');

deletePageButton.addEventListener("click", () => {
    pageMenu.hidePopover();
    if (activePage === selectedPage) clearSelection();
    localStorage.removeItem(`jotter-page-${activePage.dataset.id}`);
    activePage.remove();
});

// Move page to group
const moveMenu = document.querySelector("#move-menu");
const moveItemTemplate = document.querySelector("#move-item-template");
const movePageButton = pageMenu.querySelector('[data-action="move-page"]');

movePageButton.addEventListener("click", () => {
    const rect = movePageButton.getBoundingClientRect();
    moveMenu.style.top = `${rect.top}px`;
    const menuRect = pageMenu.getBoundingClientRect();
    if (menuRect.right + 4 + menuRect.width <= window.innerWidth) {
        moveMenu.style.left = `${menuRect.right + 4}px`;
    } else {
        moveMenu.style.left = `${menuRect.left - menuRect.width - 4}px`;
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
const searchInput = document.querySelector(".search-input");

searchInput.addEventListener("input", () => {
    const keyword = searchInput.value.trim().toLowerCase();
    document.querySelectorAll(".page-item").forEach((page) => {
        const title = page.querySelector(".page-item-title").textContent.toLowerCase();
        page.hidden = !title.includes(keyword);
    });
});

// Keyboard shortcuts
let hoveredItem = null;

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

// Save and load
function saveData() {
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