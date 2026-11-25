import { Color } from "./vendor/tiptap.js";

// Quote line color, like Notion: a small button next to a quote opens a list of colors.
// The color is saved on the quote as a name (data-color="blue"), not as a fixed color,
// so style.css can show a matching shade in light and in dark mode.
export const QUOTE_COLORS = ["default", "grey", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"];

// TipTap has no separate "add an attribute" helper in our bundle, so a copy of the Color
// extension is reused, with its own name, to add a "color" attribute to quotes
export const QuoteColor = Color.extend({
    name: "quoteColor",
    addGlobalAttributes() {
        return [{
            types: ["blockquote"],
            attributes: {
                color: {
                    default: null,
                    parseHTML: (element) => element.getAttribute("data-color"),
                    renderHTML: (attributes) => (attributes.color ? { "data-color": attributes.color } : {}),
                },
            },
        }];
    },
    addCommands() {
        return {};
    },
});

export function setupQuoteColor(editor, placeMenu) {
    const handle = document.querySelector(".quote-color-handle");
    const menu = document.querySelector("#quote-color-menu");
    let hovered = null; // the quote under the mouse

    // The quote the cursor is in: its position in the document and its element on screen
    function quoteAtCursor() {
        const { $from } = editor.state.selection;
        for (let depth = $from.depth; depth > 0; depth--) {
            if ($from.node(depth).type.name === "blockquote") {
                const pos = $from.before(depth);
                return { pos, element: editor.view.nodeDOM(pos) };
            }
        }
        return null;
    }

    // The quote the handle belongs to: the one under the mouse, otherwise the one with the cursor
    function currentQuote() {
        if (hovered && hovered.isConnected) return hovered;
        return quoteAtCursor()?.element || null;
    }

    function place() {
        const quote = editor.isEditable ? currentQuote() : null;
        if (!quote) {
            if (!menu.matches(":popover-open")) handle.hidden = true;
            return;
        }
        const box = quote.getBoundingClientRect();
        handle.style.left = `${Math.round(box.left - 28)}px`;
        handle.style.top = `${Math.round(box.top + 2)}px`;
        handle.hidden = false;
        handle.quote = quote;
    }

    const root = editor.view.dom;
    root.addEventListener("mouseover", (event) => {
        const quote = event.target.closest("blockquote");
        if (quote && root.contains(quote)) hovered = quote;
        place();
    });
    root.addEventListener("mouseleave", (event) => {
        if (event.relatedTarget === handle) return;
        hovered = null;
        place();
    });
    handle.addEventListener("mouseleave", (event) => {
        if (root.contains(event.relatedTarget)) return;
        hovered = null;
        place();
    });
    handle.addEventListener("mousedown", (event) => event.preventDefault()); // keep the cursor in the page

    handle.addEventListener("click", () => {
        const box = handle.getBoundingClientRect();
        placeMenu(menu, box.bottom + 4, box.left);
        const pos = editor.view.posAtDOM(handle.quote, 0) - 1;
        const current = editor.state.doc.nodeAt(pos)?.attrs.color || "default";
        menu.querySelectorAll("[data-color]").forEach((item) => {
            item.setAttribute("aria-checked", item.dataset.color === current);
        });
        menu.showPopover();
    });

    menu.addEventListener("click", (event) => {
        const item = event.target.closest("[data-color]");
        if (!item || !editor.isEditable || !handle.quote) return;
        const pos = editor.view.posAtDOM(handle.quote, 0) - 1;
        const node = editor.state.doc.nodeAt(pos);
        if (node?.type.name === "blockquote") {
            const color = item.dataset.color === "default" ? null : item.dataset.color;
            editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, null, { ...node.attrs, color }));
        }
        menu.hidePopover();
        editor.commands.focus();
    });

    menu.addEventListener("toggle", (event) => {
        if (event.newState === "closed") place();
    });

    editor.on("transaction", place);
    document.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
}
