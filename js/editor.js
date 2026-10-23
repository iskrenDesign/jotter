import { Editor } from "https://esm.sh/@tiptap/core@3";
import StarterKit from "https://esm.sh/@tiptap/starter-kit@3";
import TextAlign from "https://esm.sh/@tiptap/extension-text-align@3";
import { TaskList, TaskItem } from "https://esm.sh/@tiptap/extension-list@3";
import { TextStyle, FontSize } from "https://esm.sh/@tiptap/extension-text-style@3";

// Editor
export const editor = new Editor({
    element: document.querySelector(".page-editor"),
    extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        TaskList,
        TaskItem.configure({ nested: true }),
        TextStyle,
        FontSize,
    ],
    editable: false,
});

const toolbar = document.querySelector(".toolbar");

// Font size helpers
const MIN_SIZE = 8;
const MAX_SIZE = 96;

function currentFontSize() {
    const fontSize = editor.getAttributes("textStyle").fontSize;
    if (fontSize) return parseInt(fontSize);
    const { node } = editor.view.domAtPos(editor.state.selection.from);
    const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    return Math.round(parseFloat(getComputedStyle(element).fontSize));
}

function setFontSize(size) {
    const clamped = Math.min(MAX_SIZE, Math.max(MIN_SIZE, size));
    editor.chain().focus().setFontSize(`${clamped}px`).run();
}

// Toolbar buttons
const formats = {
    "bold":         { run: () => editor.chain().focus().toggleBold().run(),            active: () => editor.isActive("bold") },
    "italic":       { run: () => editor.chain().focus().toggleItalic().run(),          active: () => editor.isActive("italic") },
    "underline":    { run: () => editor.chain().focus().toggleUnderline().run(),       active: () => editor.isActive("underline") },
    "strike":       { run: () => editor.chain().focus().toggleStrike().run(),          active: () => editor.isActive("strike") },
    "align-start":  { run: () => editor.chain().focus().setTextAlign("left").run(),    active: () => editor.isActive({ textAlign: "left" }) },
    "align-center": { run: () => editor.chain().focus().setTextAlign("center").run(),  active: () => editor.isActive({ textAlign: "center" }) },
    "align-end":    { run: () => editor.chain().focus().setTextAlign("right").run(),   active: () => editor.isActive({ textAlign: "right" }) },
    "ordered-list": { run: () => editor.chain().focus().toggleOrderedList().run(),     active: () => editor.isActive("orderedList") },
    "bullet-list":  { run: () => editor.chain().focus().toggleBulletList().run(),      active: () => editor.isActive("bulletList") },
    "task-list":    { run: () => editor.chain().focus().toggleTaskList().run(),        active: () => editor.isActive("taskList") },
};

toolbar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-command]");
    if (!button || !editor.isEditable) return;
    const format = formats[button.dataset.command];
    if (format) format.run();
});

// Text style menu
const textStyleMenu = document.querySelector("#text-style-menu");
const textStyleButton = document.querySelector('[data-command="text-style"]');

const textStyles = {
    h1:     { label: "Header",      run: () => editor.chain().focus().setHeading({ level: 1 }).run(), active: () => editor.isActive("heading", { level: 1 }) },
    h2:     { label: "Title",       run: () => editor.chain().focus().setHeading({ level: 2 }).run(), active: () => editor.isActive("heading", { level: 2 }) },
    h3:     { label: "Subtitle",    run: () => editor.chain().focus().setHeading({ level: 3 }).run(), active: () => editor.isActive("heading", { level: 3 }) },
    normal: { label: "Normal text", run: () => editor.chain().focus().setParagraph().run(),           active: () => editor.isActive("paragraph") },
};

textStyleButton.addEventListener("click", () => {
    const rect = toolbar.getBoundingClientRect();
    textStyleMenu.style.top = `${rect.bottom + 8}px`;
    textStyleMenu.style.left = `${rect.left}px`;
});

textStyleMenu.addEventListener("click", (event) => {
    const item = event.target.closest("[data-style]");
    if (!item || !editor.isEditable) return;
    textStyles[item.dataset.style].run();
    textStyleMenu.hidePopover();
});

// Font size menu
const fontSizeMenu = document.querySelector("#font-size-menu");
const fontSizeButton = document.querySelector('[data-command="font-size"]');

for (let size = MIN_SIZE; size <= MAX_SIZE; size += 2) {
    const item = document.createElement("button");
    item.className = "menu-item";
    item.setAttribute("role", "menuitemradio");
    item.dataset.size = size;
    item.textContent = size;
    fontSizeMenu.append(item);
}

fontSizeButton.addEventListener("click", () => {
    fontSizeMenu.style.top = `${toolbar.getBoundingClientRect().bottom + 8}px`;
    fontSizeMenu.style.left = `${fontSizeButton.getBoundingClientRect().left}px`;
});

fontSizeMenu.addEventListener("click", (event) => {
    const item = event.target.closest("[data-size]");
    if (!item || !editor.isEditable) return;
    setFontSize(Number(item.dataset.size));
    fontSizeMenu.hidePopover();
});

fontSizeMenu.addEventListener("toggle", (event) => {
    if (event.newState !== "open") return;
    const current = fontSizeMenu.querySelector('[aria-checked="true"]');
    if (current) current.scrollIntoView({ block: "center" });
});

// Keep the toolbar in sync with the cursor
function updateToolbar() {
    document.querySelectorAll(".toolbar [data-command]").forEach((button) => {
        const format = formats[button.dataset.command];
        if (format) button.setAttribute("aria-pressed", format.active());
    });

    const current = Object.keys(textStyles).find((key) => textStyles[key].active());
    textStyleButton.querySelector("span").textContent = current ? textStyles[current].label : "Normal text";
    textStyleMenu.querySelectorAll("[data-style]").forEach((item) => {
        item.setAttribute("aria-checked", item.dataset.style === current);
    });

    const size = currentFontSize();
    fontSizeButton.textContent = size;
    fontSizeMenu.querySelectorAll("[data-size]").forEach((item) => {
        item.setAttribute("aria-checked", Number(item.dataset.size) === size);
    });
}

editor.on("transaction", updateToolbar);