import { Editor } from "https://esm.sh/@tiptap/core@3";
import StarterKit from "https://esm.sh/@tiptap/starter-kit@3";
import TextAlign from "https://esm.sh/@tiptap/extension-text-align@3";
import { TaskList, TaskItem } from "https://esm.sh/@tiptap/extension-list@3";
import { TextStyle, FontSize, Color } from "https://esm.sh/@tiptap/extension-text-style@3";
import Image from "https://esm.sh/@tiptap/extension-image@3";
import { PaginationPlus } from "https://esm.sh/tiptap-pagination-plus@3";
import { placeMenu } from "./menus.js";
import { VideoCard, videoProvider, getVideoInfo } from "./video-card.js";

// Editor
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
        Color,
        Image.configure({ allowBase64: true }),
        VideoCard,
        PaginationPlus.configure({
            pageWidth: 794,
            pageHeight: 1123,
            pageGap: 24,
            pageGapBorderSize: 0,
            pageBreakBackground: "#FAFAFA",
            marginTop: 76,
            marginBottom: 76,
            marginLeft: 76,
            marginRight: 76,
            contentMarginTop: 0,
            contentMarginBottom: 0,
            headerLeft: "",
            headerRight: "",
            footerLeft: "",
            footerRight: "{page}",
        }),
    ],
    editable: false,
    editorProps: {
        handlePaste: (view, event) => {
            const text = event.clipboardData.getData("text/plain").trim();
            const provider = videoProvider(text);
            if (!provider) return false;
            insertVideoCard(text, provider);
            return true;
        },
        handleClickOn: (view, pos, node) => {
            if (node.type.name !== "videoCard") return false;
            window.open(node.attrs.url, "_blank");
            return true;
        },
    },
});

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
    "align-start":  { run: () => editor.chain().focus().setTextAlign("left").run(),    active: () => editor.isActive({ textAlign: "left" }) },
    "align-center": { run: () => editor.chain().focus().setTextAlign("center").run(),  active: () => editor.isActive({ textAlign: "center" }) },
    "align-end":    { run: () => editor.chain().focus().setTextAlign("right").run(),   active: () => editor.isActive({ textAlign: "right" }) },
    "ordered-list": { run: () => editor.chain().focus().toggleOrderedList().run(),     active: () => editor.isActive("orderedList") },
    "bullet-list":  { run: () => editor.chain().focus().toggleBulletList().run(),      active: () => editor.isActive("bulletList") },
    "task-list":    { run: () => editor.chain().focus().toggleTaskList().run(),        active: () => editor.isActive("taskList") },
    "link":         { run: () => {},                                                   active: () => editor.isActive("link") },
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

// Options menu
const optionsButton = document.querySelector('[data-command="options"]');
const optionsMenu = document.querySelector("#options-menu");

const options = {
    copy: () => {
        editor.commands.focus();
        document.execCommand("copy");
    },
    cut: () => {
        editor.commands.focus();
        document.execCommand("cut");
    },
    paste: async () => {
        try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                if (item.types.includes("text/html")) {
                    const html = await (await item.getType("text/html")).text();
                    editor.chain().focus().insertContent(html).run();
                    return;
                }
                if (item.types.includes("text/plain")) {
                    const text = await (await item.getType("text/plain")).text();
                    if (text) editor.chain().focus().insertContent({ type: "text", text }).run();
                    return;
                }
            }
        } catch {
            alert("Jotter couldn't read the clipboard. Use Ctrl+V instead.");
        }
    },
    duplicate: () => {
        const { to } = editor.state.selection;
        const copy = editor.state.selection.content().content.toJSON();
        editor.chain().focus().insertContentAt(to, copy).run();
    },
    print: () => window.print(),
    delete: () => editor.chain().focus().deleteSelection().run(),
};

optionsButton.addEventListener("click", () => {
    placeBelowToolbar(optionsMenu, optionsButton.getBoundingClientRect().left);
    const nothingSelected = editor.state.selection.empty;
    optionsMenu.querySelectorAll('[data-option="copy"], [data-option="cut"], [data-option="duplicate"], [data-option="delete"]').forEach((item) => {
        item.disabled = nothingSelected;
    });
});

optionsMenu.addEventListener("click", async (event) => {
    const item = event.target.closest("[data-option]");
    if (!item || !editor.isEditable) return;
    optionsMenu.hidePopover();
    await options[item.dataset.option]();
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

    const color = editor.getAttributes("textStyle").color;
    colorSwatch.style.backgroundColor = color || "";
    colorInput.value = color && color.startsWith("#") ? color : "#1f1f1f";
}

editor.on("transaction", updateToolbar);

// Video cards
async function insertVideoCard(url, provider) {
    const info = await getVideoInfo(url, provider);
    editor.chain().focus().insertContent({ type: "videoCard", attrs: { url, ...info } }).run();
}