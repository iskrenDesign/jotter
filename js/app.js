const app = document.querySelector(".app");
const toggleButtons = document.querySelectorAll(".sidebar-toggle");

toggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
        app.classList.toggle("sidebar-collapsed");
    });
});
// Page item template
const pageTemplate = document.querySelector("#page-item-template");
const addPageButton = document.querySelectorAll(".add-page-button");

addPageButton.forEach((button) => {
    button.addEventListener("click", () => {
        const pageList = button.closest(".page-group").querySelector(".page-list");
        const newPage = pageTemplate.content.cloneNode(true);
        newPage.querySelector(".page-item-date").textContent = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric"});
        pageList.append(newPage);
    });
});
// Open toggle for page groups
const groupToggle = document.querySelectorAll(".page-group-toggle");

groupToggle.forEach((toggle) => {
    toggle.addEventListener("click", () => {
        const isexpanded = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", !isexpanded);
        toggle.closest(".page-group").classList.toggle("page-group-collapsed");
    });
});
// Group menu position
const groupMenu = document.querySelector("#group-menu");
const groupMenuButtons = document.querySelectorAll(".group-menu-button");
let activeGroup = null;

groupMenuButtons.forEach((button) => {
    button.addEventListener("click", () => {
        const rect = button.getBoundingClientRect();
        groupMenu.style.top = `${rect.bottom + 4}px`;
        groupMenu.style.left = `${rect.left}px`;
        activeGroup = button.closest(".page-group");
    });
});
// Page menu option
const pageMenu = document.querySelector("#page-menu");
let activePage = null;

document.addEventListener("click", (event) => {
    const button = event.target.closest(".page-item-menu");
    if (!button) return;
    const rect = button.getBoundingClientRect();
    pageMenu.style.top = `${rect.bottom + 4}px`;
    pageMenu.style.left = `${rect.left}px`;
    activePage = button.closest(".page-item");
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
    if (event.key === "Enter" && event.target.isContentEditable) {
        event.preventDefault();
        event.target.blur();
    }
});

document.addEventListener("focusout", (event) => {
    if (event.target.isContentEditable) {
        event.target.contentEditable = "false";
    }
});