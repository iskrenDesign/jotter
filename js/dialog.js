const dialog = document.querySelector(".confirm-dialog");

// Click on the dark area outside the box = cancel
dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close("cancel");
});

// Shows the dialog and waits. Resolves to true for confirm, false for cancel.
export function confirmDialog({ title, message, cancelLabel, confirmLabel }) {
    dialog.querySelector(".confirm-dialog-title").textContent = title;
    dialog.querySelector(".confirm-dialog-message").textContent = message;
    dialog.querySelector(".confirm-dialog-cancel").textContent = cancelLabel;
    dialog.querySelector(".confirm-dialog-confirm").textContent = confirmLabel;
    dialog.returnValue = "";
    dialog.showModal();

    return new Promise((resolve) => {
        dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true });
    });
}