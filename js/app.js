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