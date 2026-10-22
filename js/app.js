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

// Open toggle for page groups

// Group menu position
const groupMenu = document.querySelector("#group-menu");

// Page menu option
const pageMenu = document.querySelector("#page-menu");
let activePage = null;
document.addEventListener("click", (event) => {
    const addPageButton = event.target.closest(".add-page-button");
    if (addPageButton) {
        const pageList = addPageButton.closest(".page-group").querySelector(".page-list");
        const newPage = pageTemplate.content.cloneNode(true);
        newPage.querySelector(".page-item-date").textContent = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
        pageList.append(newPage);
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
// delete Group
const deleteGroupButton = groupMenu.querySelector('[data-action="delete-group"]');
deleteGroupButton.addEventListener("click", () => {
    groupMenu.hidePopover();
    const pageCount = activeGroup.querySelectorAll(".page-item").length;
    if (pageCount > 0 && !confirm("Are you sure you want to delete this group and its ${pageCount}?")) return;
    activeGroup.remove();
})

// Delete page
const deletePageButton = pageMenu.querySelector('[data-action="delete-page"]');

deletePageButton.addEventListener("click", () => {
    pageMenu.hidePopover();
    activePage.remove();
});