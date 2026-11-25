import { Editor, StarterKit, TextAlign, TaskList, TaskItem, TextStyle, FontSize, Color, Image, TableKit } from "./vendor/tiptap.js";
import { placeMenu } from "./menus.js";
import { VideoCard, videoProvider, getVideoInfo, blockAlign } from "./video-card.js";
import { createTableActions, setupTableHandles } from "./table-handles.js";

// In the app, open links in the user's browser; in the browser, a new tab
const openLink = window.__TAURI__?.opener?.openUrl ?? ((url) => window.open(url, "_blank"));

// Editor
// Pictures you can resize by dragging their corners.
// TipTap's resizable picture needs two small fixes:
// 1. It does not redraw its size after Undo/Redo or when another page is opened,
//    so the width and height are set again every time the picture changes.
// 2. It does not know about the page zoom, so the mouse movement is divided by the zoom.
const ResizableImage = Image.extend({
    // Left, center or right on the page (set with the alignment button)
    addAttributes() {
        return { ...this.parent?.(), ...blockAlign };
    },
    addNodeView() {
        const createView = this.parent?.();
        if (!createView) return null;
        return (props) => {
            const view = createView(props);
            const resize = view.handleResize.bind(view);
            view.handleResize = (dx, dy) => {
                const zoom = view.element.currentCSSZoom || 1;
                resize(dx / zoom, dy / zoom);
            };
            const update = view.update.bind(view);
            view.update = (node, ...rest) => {
                if (!update(node, ...rest)) return false;
                view.element.style.width = node.attrs.width ? `${node.attrs.width}px` : "";
                view.element.style.height = node.attrs.height ? `${node.attrs.height}px` : "";
                return true;
            };
            return view;
        };
    },
});
// Text color that follows the theme.
// The color is saved as before (style="color: ..."), and is also given to the CSS as --text-color.
// style.css uses --text-color to make the color darker in light mode or lighter in dark mode
// when it would be hard to read. Notes that already have colors keep working.
const ThemeColor = Color.extend({
    addGlobalAttributes() {
        return [{
            types: this.options.types,
            attributes: {
                color: {
                    default: null,
                    parseHTML: (element) => {
                        const style = element.getAttribute("style") || "";
                        const match = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
                        return match ? match[1].trim().replace(/['"]+/g, "") : null;
                    },
                    renderHTML: (attributes) => attributes.color
                        ? { style: `color: ${attributes.color}; --text-color: ${attributes.color}` }
                        : {},
                },
            },
        }];
    },
});

export const editor = new Editor({
    element: document.querySelector(".page-editor"),
    extensions: [
        StarterKit.configure({
            heading: { levels: [1, 2, 3] },
            link: { openOnClick: false, autolink: true },
        }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        TaskList,
        TaskItem.configure({ nested: true }),
        TextStyle,
        FontSize,
        ThemeColor,
        ResizableImage.configure({
            allowBase64: true,
            // Drag the corners of a picture to make it bigger or smaller
            resize: {
                enabled: true,
                directions: ["top-left", "top-right", "bottom-left", "bottom-right"],
                minWidth: 48,
                minHeight: 48,
                alwaysPreserveAspectRatio: true,
            },
        }),
        TableKit.configure({ table: { resizable: true, handleWidth: 6, cellMinWidth: 60 } }),
        VideoCard,
    ],
    // Created editable on purpose: TipTap only adds table column resizing to an editor that starts
    // editable. It is switched to read-only again right after it is created (see below).
    editable: true,
    editorProps: {
        handlePaste: (view, event) => {
            const text = event.clipboardData.getData("text/plain").trim();
            const provider = videoProvider(text);
            if (!provider) return false;
            insertVideoCard(text, provider);
            return true;
        },
        handleClickOn: (view, pos, node, nodePos) => {
            if (node.type.name !== "videoCard") return false;
            // While editing, the first click selects the card (so it can be aligned), the second opens it
            const { selection } = view.state;
            const selected = selection.node === node && selection.from === nodePos;
            if (editor.isEditable && !selected) return false;
                openLink(node.attrs.url);
            return true;
            
        },
    },
});

editor.setEditable(false, false);

// Toolbar
const toolbar = document.querySelector(".toolbar");

function placeBelowToolbar(menu, x) {
    placeMenu(menu, toolbar.getBoundingClientRect().bottom + 8, x);
}

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
    "task-list":    { run: () => editor.chain().focus().toggleTaskList().run(),        active: () => editor.isActive("taskList") },
    "quote":        { run: () => editor.chain().focus().toggleBlockquote().run(),      active: () => editor.isActive("blockquote") },
    "link":         { run: () => {},                                                   active: () => editor.isActive("link") },
};

toolbar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-command]");
    if (!button || !editor.isEditable) return;
    const format = formats[button.dataset.command];
    if (format) format.run();
});

// Dropdowns on the toolbar: text alignment and lists
// A selected picture or video card is moved as a whole block; anything else aligns its text
function selectedBlock() {
    const { node } = editor.state.selection;
    return node && ["image", "videoCard"].includes(node.type.name) ? node : null;
}

function align(value) {
    const block = selectedBlock();
    if (block) return editor.chain().focus().updateAttributes(block.type.name, { align: value }).run();
    return editor.chain().focus().setTextAlign(value).run();
}

function isAligned(value) {
    const block = selectedBlock();
    if (block) return block.attrs.align === value;
    return editor.isActive({ textAlign: value });
}

const alignments = {
    left:   { run: () => align("left"),   active: () => isAligned("left") },
    center: { run: () => align("center"), active: () => isAligned("center") },
    right:  { run: () => align("right"),  active: () => isAligned("right") },
};

const lists = {
    bullet:  { run: () => editor.chain().focus().toggleBulletList().run(),  active: () => editor.isActive("bulletList") },
    ordered: { run: () => editor.chain().focus().toggleOrderedList().run(), active: () => editor.isActive("orderedList") },
};

// A toolbar button that opens a menu of choices and shows the icon of the current choice.
// Returns a function that refreshes the button and the menu, and gives back the current choice.
function choiceMenu({ command, menuId, key, choices, fallback }) {
    const button = document.querySelector(`[data-command="${command}"]`);
    const menu = document.querySelector(`#${menuId}`);

    button.addEventListener("click", () => {
        placeBelowToolbar(menu, button.getBoundingClientRect().left);
    });

    menu.addEventListener("click", (event) => {
        const item = event.target.closest(`[data-${key}]`);
        if (!item || !editor.isEditable) return;
        choices[item.dataset[key]].run();
        menu.hidePopover();
    });

    return () => {
        const current = Object.keys(choices).find((name) => choices[name].active());
        menu.querySelectorAll(`[data-${key}]`).forEach((item) => {
            item.setAttribute("aria-checked", item.dataset[key] === current);
        });
        const shown = current || fallback;
        if (button.dataset.shown !== shown) {
            button.dataset.shown = shown;
            button.querySelector(".toolbar-current-icon").innerHTML = menu.querySelector(`[data-${key}="${shown}"] .menu-item-icon`).innerHTML;
        }
        return current;
    };
}

const updateAlignment = choiceMenu({ command: "align", menuId: "align-menu", key: "align", choices: alignments, fallback: "left" });
const updateLists = choiceMenu({ command: "list", menuId: "list-menu", key: "list", choices: lists, fallback: "bullet" });
const listButton = document.querySelector('[data-command="list"]');

// Table: the button inserts a table. Rows, columns and the table itself are edited with the grips next to them
const tableButton = document.querySelector('[data-command="table"]');

// A new table is narrower than the page. "Fit to width" in the table menu stretches it.
const DEFAULT_COLUMN_WIDTH = 160;
const tableActions = createTableActions(editor);

tableButton.addEventListener("click", () => {
    if (!editor.isEditable) return;
    tableActions.run.insertTable({ rows: 3, cols: 3, columnWidth: DEFAULT_COLUMN_WIDTH });
});

setupTableHandles(editor, placeMenu, tableActions);

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
    placeBelowToolbar(textStyleMenu, toolbar.getBoundingClientRect().left);
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
    placeBelowToolbar(fontSizeMenu, fontSizeButton.getBoundingClientRect().left);
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

// Text color
const colorInput = document.querySelector(".toolbar-color-input");
const colorSwatch = document.querySelector(".toolbar-color-swatch");

colorInput.addEventListener("input", () => {
    if (!editor.isEditable) return;
    editor.chain().setColor(colorInput.value).run();
});

colorInput.addEventListener("change", () => {
    editor.commands.focus();
});

// Reset text color: remove the custom color, so the text follows the theme again
const colorResetButton = document.querySelector(".toolbar-color-reset");

colorResetButton.addEventListener("click", () => {
    if (!editor.isEditable) return;
    editor.chain().focus().unsetColor().run();
});

// True when any selected text (or the text at the cursor) has its own color
function selectionHasColor() {
    const { from, to, empty } = editor.state.selection;
    if (empty) return Boolean(editor.getAttributes("textStyle").color);
    let found = false;
    editor.state.doc.nodesBetween(from, to, (node) => {
        if (node.marks.some((mark) => mark.type.name === "textStyle" && mark.attrs.color)) found = true;
        return !found;
    });
    return found;
}

// Link
const linkButton = document.querySelector('[data-command="link"]');
const linkMenu = document.querySelector("#link-menu");
const linkForm = document.querySelector(".link-form");
const linkInput = document.querySelector(".link-input");

linkButton.addEventListener("click", () => {
    placeBelowToolbar(linkMenu, linkButton.getBoundingClientRect().left);
    linkInput.value = editor.getAttributes("link").href || "";
});

linkMenu.addEventListener("toggle", (event) => {
    if (event.newState === "open") linkInput.focus();
});

linkForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!editor.isEditable) return;
    let url = linkInput.value.trim();

    if (url === "") {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
        if (!url.startsWith("http://") && !url.startsWith("https://")) url = `https://${url}`;
        if (editor.state.selection.empty && !editor.isActive("link")) {
            editor.chain().focus().insertContent({ type: "text", text: url, marks: [{ type: "link", attrs: { href: url } }] }).run();
        } else {
            editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }
    }
    linkMenu.hidePopover();
});

// Image
const imageButton = document.querySelector('[data-command="image"]');
const imageInput = document.querySelector(".image-input");

imageButton.addEventListener("click", () => {
    if (editor.isEditable) imageInput.click();
});

imageInput.addEventListener("change", async () => {
    const file = imageInput.files[0];
    if (!file) return;
    const src = await resizeImage(file, 1200);
    editor.chain().focus().setImage({ src, alt: file.name }).run();
    imageInput.value = "";
});

async function resizeImage(file, maxWidth) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxWidth / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width * scale;
    canvas.height = bitmap.height * scale;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.8);
}

// Print
document.querySelector(".toolbar-print").addEventListener("click", () => {
    if (editor.isEditable) window.print();
});

// Keep the toolbar in sync with the cursor
function updateToolbar() {
    document.querySelectorAll(".toolbar [data-command]").forEach((button) => {
        const format = formats[button.dataset.command];
        if (format) button.setAttribute("aria-pressed", format.active());
    });

    updateAlignment();
    listButton.setAttribute("aria-pressed", Boolean(updateLists()));

    tableButton.setAttribute("aria-pressed", editor.isActive("table"));

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

    const color = editor.getAttributes("textStyle").color;
    colorSwatch.style.backgroundColor = color || "";
    colorInput.value = color && color.startsWith("#") ? color : "#1f1f1f";
    colorResetButton.disabled = !editor.isEditable || !selectionHasColor();
}

editor.on("transaction", updateToolbar);

// Video cards
async function insertVideoCard(url, provider) {
    const info = await getVideoInfo(url, provider);
    editor.chain().focus().insertContent({ type: "videoCard", attrs: { url, ...info } }).run();
}

// Page zoom
const ZOOM_STEPS = [50, 60, 70, 80, 90, 100, 110, 120, 150, 175, 200];
const pageElement = document.querySelector(".page-body");
const zoomValue = document.querySelector(".page-zoom-value");
let zoom = Number(localStorage.getItem("jotter-zoom")) || 100;

function setZoom(value) {
    zoom = value;
    pageElement.style.zoom = zoom / 100;
    zoomValue.textContent = `${zoom}%`;
    localStorage.setItem("jotter-zoom", zoom);
}

// direction: 1 = zoom in, -1 = zoom out
function zoomBy(direction) {
    const index = ZOOM_STEPS.indexOf(zoom) + direction;
    setZoom(ZOOM_STEPS[Math.min(Math.max(index, 0), ZOOM_STEPS.length - 1)]);
}

document.querySelector(".page-zoom").addEventListener("click", (event) => {
    const button = event.target.closest("[data-zoom]");
    if (!button) return;
    const index = ZOOM_STEPS.indexOf(zoom);
    if (button.dataset.zoom === "in") zoomBy(1);
    if (button.dataset.zoom === "out") zoomBy(-1);
    if (button.dataset.zoom === "reset") setZoom(100);
});

setZoom(zoom);

// Ctrl + plus/minus/0 and Ctrl + mouse wheel zoom the page, not the whole app
document.addEventListener("keydown", (event) => {
    if (!event.ctrlKey) return;
    if (event.key === "=" || event.key === "+") zoomBy(1);
    else if (event.key === "-") zoomBy(-1);
    else if (event.key === "0") setZoom(100);
    else return;
    event.preventDefault();
});

document.addEventListener("wheel", (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1 : -1);
}, { passive: false });