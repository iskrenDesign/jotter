// Table handles: small grips next to the row, column and table you point at.
// Clicking a grip opens a menu with the actions for that row, column or table.

const GRIP_VERTICAL = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>';
const GRIP_HORIZONTAL = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="9" r="1"/><circle cx="12" cy="9" r="1"/><circle cx="19" cy="9" r="1"/><circle cx="5" cy="15" r="1"/><circle cx="12" cy="15" r="1"/><circle cx="19" cy="15" r="1"/></svg>';

const MIN_COLUMN_WIDTH = 60; // the same as cellMinWidth in editor.js

// ---------------------------------------------------------------- actions on the document

export function createTableActions(editor) {
    const chain = () => editor.chain().focus();
    const nodes = () => editor.state.schema.nodes;

    // Where the cursor is: which table, row and column (null when not in a table)
    function context() {
        const { $from } = editor.state.selection;
        let rowDepth = -1;
        let tableDepth = -1;
        for (let depth = $from.depth; depth > 0; depth--) {
            const name = $from.node(depth).type.name;
            if (name === "tableRow" && rowDepth < 0) rowDepth = depth;
            if (name === "table") {
                tableDepth = depth;
                break;
            }
        }
        if (tableDepth < 0 || rowDepth < 0) return null;
        return {
            table: $from.node(tableDepth),
            tablePos: $from.before(tableDepth),
            tableStart: $from.start(tableDepth),
            rowStart: $from.start(rowDepth),
            rowEnd: $from.after(rowDepth),
            rowIndex: $from.index(tableDepth),
            colIndex: $from.index(rowDepth),
        };
    }

    const isHeaderRow = (table) => {
        let all = table.childCount > 0;
        table.firstChild.forEach((cell) => {
            if (cell.type.name !== "tableHeader") all = false;
        });
        return all;
    };

    const isHeaderColumn = (table) => {
        let all = table.childCount > 0;
        table.forEach((row) => {
            if (!row.firstChild || row.firstChild.type.name !== "tableHeader") all = false;
        });
        return all;
    };

    // The cells of the current row, with the position before and after each one
    function rowCells(ctx) {
        const cells = [];
        ctx.table.child(ctx.rowIndex).forEach((cell, offset) => {
            const start = ctx.rowStart + offset;
            cells.push({ cell, start, end: start + cell.nodeSize });
        });
        return cells;
    }

    // The cells of the current column, one from every row
    function columnCells(ctx) {
        const cells = [];
        ctx.table.forEach((row, rowOffset) => {
            if (ctx.colIndex >= row.childCount) return;
            let offset = 0;
            for (let i = 0; i < ctx.colIndex; i++) offset += row.child(i).nodeSize;
            const cell = row.child(ctx.colIndex);
            const start = ctx.tableStart + rowOffset + 1 + offset;
            cells.push({ cell, start, end: start + cell.nodeSize });
        });
        return cells;
    }

    // Empty cells: from the last to the first, so the positions stay right
    function clear(cells) {
        chain().command(({ tr }) => {
            [...cells].sort((a, b) => b.start - a.start).forEach(({ start, end }) => {
                tr.replaceWith(start + 1, end - 1, nodes().paragraph.create());
            });
            return true;
        }).run();
    }

    function duplicateRow(ctx) {
        const row = ctx.table.child(ctx.rowIndex);
        const cells = [];
        row.forEach((cell) => {
            // A copy of the header row is a normal row
            cells.push(cell.type.name === "tableHeader" ? nodes().tableCell.create(cell.attrs, cell.content) : cell);
        });
        const copy = row.type.create(row.attrs, cells);
        chain().command(({ tr }) => {
            tr.insert(ctx.rowEnd, copy);
            return true;
        }).run();
    }

    function duplicateColumn(ctx) {
        const cells = columnCells(ctx);
        chain().command(({ tr }) => {
            [...cells].sort((a, b) => b.end - a.end).forEach(({ cell, end }) => tr.insert(end, cell));
            return true;
        }).run();
    }

    function duplicateTable(ctx) {
        chain().command(({ tr }) => {
            tr.insert(ctx.tablePos + ctx.table.nodeSize, [nodes().paragraph.create(), ctx.table]);
            return true;
        }).run();
    }

    // Give every column a width (in pixels). A cell that spans several columns gets several widths.
    function setColumnWidths(ctx, widths) {
        chain().command(({ tr }) => {
            ctx.table.forEach((row, rowOffset) => {
                let column = 0;
                row.forEach((cell, cellOffset) => {
                    const span = cell.attrs.colspan || 1;
                    const colwidth = widths.slice(column, column + span);
                    column += span;
                    if (colwidth.length === span) {
                        tr.setNodeMarkup(ctx.tableStart + rowOffset + 1 + cellOffset, null, { ...cell.attrs, colwidth });
                    }
                });
            });
            return true;
        }).run();
    }

    return {
        context,
        isHeaderRow,
        isHeaderColumn,
        run: {
            toggleHeaderRow: () => chain().toggleHeaderRow().run(),
            toggleHeaderColumn: () => chain().toggleHeaderColumn().run(),
            addRowBefore: () => chain().addRowBefore().run(),
            addRowAfter: () => chain().addRowAfter().run(),
            addColumnBefore: () => chain().addColumnBefore().run(),
            addColumnAfter: () => chain().addColumnAfter().run(),
            deleteRow: () => chain().deleteRow().run(),
            deleteColumn: () => chain().deleteColumn().run(),
            deleteTable: () => chain().deleteTable().run(),
            duplicateRow,
            duplicateColumn,
            duplicateTable,
            clearRow: (ctx) => clear(rowCells(ctx)),
            clearColumn: (ctx) => clear(columnCells(ctx)),
            fitToWidth: (ctx, widths) => setColumnWidths(ctx, widths),
            // Insert a table that starts narrower than the page ("Fit to width" stretches it)
            insertTable: ({ rows, cols, columnWidth }) => {
                chain().insertTable({ rows, cols, withHeaderRow: true }).run();
                const ctx = context();
                if (ctx) setColumnWidths(ctx, Array(cols).fill(columnWidth));
            },
        },
    };
}

// What each menu contains
function menuItems(kind, ctx, actions, fit) {
    const { run } = actions;
    if (kind === "row") {
        return [
            ...(ctx.rowIndex === 0 ? [{ label: "Header row", on: actions.isHeaderRow(ctx.table), run: () => run.toggleHeaderRow() }] : []),
            { label: "Insert above", run: () => run.addRowBefore() },
            { label: "Insert below", run: () => run.addRowAfter() },
            { label: "Duplicate", run: () => run.duplicateRow(ctx) },
            { label: "Clear contents", run: () => run.clearRow(ctx) },
            ...(ctx.table.childCount > 1 ? [{ label: "Delete", danger: true, run: () => run.deleteRow() }] : []),
        ];
    }
    if (kind === "column") {
        return [
            ...(ctx.colIndex === 0 ? [{ label: "Header column", on: actions.isHeaderColumn(ctx.table), run: () => run.toggleHeaderColumn() }] : []),
            { label: "Insert left", run: () => run.addColumnBefore() },
            { label: "Insert right", run: () => run.addColumnAfter() },
            { label: "Duplicate", run: () => run.duplicateColumn(ctx) },
            { label: "Clear contents", run: () => run.clearColumn(ctx) },
            ...(ctx.table.firstChild.childCount > 1 ? [{ label: "Delete", danger: true, run: () => run.deleteColumn() }] : []),
        ];
    }
    return [
        { label: "Fit to width", run: () => { const widths = fit(); if (widths) run.fitToWidth(ctx, widths); } },
        { label: "Header row", on: actions.isHeaderRow(ctx.table), run: () => run.toggleHeaderRow() },
        { label: "Header column", on: actions.isHeaderColumn(ctx.table), run: () => run.toggleHeaderColumn() },
        { label: "Duplicate table", run: () => run.duplicateTable(ctx) },
        { label: "Delete table", danger: true, run: () => run.deleteTable() },
    ];
}

// ---------------------------------------------------------------- the grips and menus on the page

export function setupTableHandles(editor, placeMenu, actions = createTableActions(editor)) {
    const root = editor.view.dom;

    function makeHandle(kind, label, icon) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `table-handle table-handle-${kind}`;
        button.setAttribute("aria-label", label);
        button.hidden = true;
        button.innerHTML = icon;
        return button;
        setupPrintFit(root);
    }

    const handles = {
        row: makeHandle("row", "Row options", GRIP_VERTICAL),
        column: makeHandle("column", "Column options", GRIP_HORIZONTAL),
        table: makeHandle("table", "Table options", GRIP_VERTICAL),
    };

    const menu = document.createElement("div");
    menu.className = "dropdown-menu toolbar-menu choice-menu table-handle-menu";
    menu.setAttribute("popover", "auto");
    menu.setAttribute("role", "menu");

    document.body.append(handles.row, handles.column, handles.table, menu);

    let current = null;   // the cell the grips belong to
    let hovering = false; // the pointer is over the table or a grip
    let hideTimer = null;
    let frame = 0;

    function cellAtCursor() {
        try {
            const { node } = editor.view.domAtPos(editor.state.selection.from);
            const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
            const cell = element && element.closest ? element.closest("td, th") : null;
            return cell && root.contains(cell) ? cell : null;
        } catch {
            return null;
        }
    }

    function hideAll() {
        Object.values(handles).forEach((handle) => (handle.hidden = true));
    }

    function show(handle, left, top, visible) {
        handle.hidden = !visible;
        if (!visible) return;
        handle.style.left = `${Math.round(left)}px`;
        handle.style.top = `${Math.round(top)}px`;
    }

    function place() {
        frame = 0;
        if (!editor.isEditable || !current || !current.isConnected) return hideAll();

        // The table's top-left corner is the top-left of its first cell. (The table element itself
        // can report an empty box in some editors, so it is not used for positions.)
        const table = current.closest("table");
        const first = table.querySelector("th, td") || current;
        const cell = current.getBoundingClientRect();
        const corner = first.getBoundingClientRect();
        const box = { left: corner.left, top: corner.top };
        // Do not draw grips over the header and toolbar when the table scrolls under them
        const bar = document.querySelector(".main-top");
        const barBottom = bar ? bar.getBoundingClientRect().bottom : 0;
        const rowMiddle = cell.top + cell.height / 2;

        const gripLeft = Math.max(4, box.left - 22);
        show(handles.row, gripLeft, rowMiddle - 12, rowMiddle > barBottom + 12 && rowMiddle < window.innerHeight - 12);
        show(handles.column, cell.left + cell.width / 2 - 12, box.top - 20, box.top - 20 > barBottom && box.top < window.innerHeight);
        show(handles.table, gripLeft, box.top - 20, box.top - 20 > barBottom && box.top < window.innerHeight);
    }

    function schedulePlace() {
        if (!frame) frame = requestAnimationFrame(place);
    }

    function setCurrent(cell) {
        current = cell;
        schedulePlace();
    }

    function leave() {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            if (menu.matches(":popover-open")) return;
            hovering = false;
            setCurrent(cellAtCursor());
        }, 250);
    }

    root.addEventListener("mouseover", (event) => {
        const cell = event.target.closest ? event.target.closest("td, th") : null;
        if (!cell || !root.contains(cell)) return;
        clearTimeout(hideTimer);
        hovering = true;
        if (cell !== current) setCurrent(cell);
    });
    root.addEventListener("mouseleave", leave);

    Object.values(handles).forEach((handle) => {
        handle.addEventListener("mouseenter", () => {
            clearTimeout(hideTimer);
            hovering = true;
        });
        handle.addEventListener("mouseleave", leave);
        // Keep the cursor in the page when a grip is clicked
        handle.addEventListener("mousedown", (event) => event.preventDefault());
    });

    // Column widths that fill the page width and keep the proportions the columns have now.
    // The widths are in the table's own pixels, which is what the editor stores (this stays
    // correct when the page is zoomed).
    function fitWidths() {
        if (!current) return null;
        const table = current.closest("table");
        const wrapper = table.closest(".tableWrapper");
        let available = wrapper ? wrapper.clientWidth : 0;
        if (!available) {
            const style = getComputedStyle(root);
            available = root.clientWidth - parseFloat(style.paddingLeft || 0) - parseFloat(style.paddingRight || 0);
        }
        const widths = [];
        [...table.rows[0].cells].forEach((cell) => {
            const span = cell.colSpan || 1;
            for (let i = 0; i < span; i++) widths.push(cell.getBoundingClientRect().width / span);
        });
        const total = widths.reduce((sum, width) => sum + width, 0);
        if (!available || !total) return null;
        return widths.map((width) => Math.max(MIN_COLUMN_WIDTH, Math.floor((width / total) * available)));
    }

    // Put the cursor in the cell, so the commands work on its row or column
    function selectCell(cell) {
        const target = cell.querySelector("p, h1, h2, h3") || cell;
        const position = editor.view.posAtDOM(target, 0);
        editor.chain().focus().setTextSelection(position).run();
    }

    function openMenu(kind) {
        if (!current || !editor.isEditable) return;
        selectCell(current);
        const ctx = actions.context();
        if (!ctx) return;

        menu.replaceChildren(
            ...menuItems(kind, ctx, actions, fitWidths).map((item) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "menu-item" + (item.danger ? " menu-item-danger" : "");
                button.setAttribute("role", "menuitem");
                const label = document.createElement("span");
                label.className = "menu-item-label";
                label.textContent = item.label;
                button.append(label);
                if (item.on !== undefined) {
                    const toggle = document.createElement("span");
                    toggle.className = "table-switch";
                    toggle.dataset.on = String(item.on);
                    button.append(toggle);
                }
                button.addEventListener("click", () => {
                    menu.hidePopover();
                    item.run();
                    // The row or column may be gone, so let the next hover find the grips again
                    hovering = false;
                    setCurrent(cellAtCursor());
                });
                return button;
            }),
        );

        const box = handles[kind].getBoundingClientRect();
        placeMenu(menu, box.bottom + 4, box.left);
        if (!menu.matches(":popover-open")) menu.showPopover();
    }

    Object.entries(handles).forEach(([kind, handle]) => {
        handle.addEventListener("click", () => openMenu(kind));
    });

    menu.addEventListener("toggle", (event) => {
        if (event.newState === "closed") leave();
    });

    editor.on("transaction", () => {
        if (!hovering) current = cellAtCursor();
        schedulePlace();
    });

    document.addEventListener("scroll", schedulePlace, true);
    window.addEventListener("resize", schedulePlace);
    const page = document.querySelector(".a4-page");
    if (page && window.ResizeObserver) new ResizeObserver(schedulePlace).observe(page);
}

// On paper a table cannot scroll sideways. A table wider than the page is scaled down to fit
// while printing, keeping its column proportions, and put back afterwards.
function setupPrintFit(root) {
    let saved = [];

    window.addEventListener("beforeprint", () => {
        root.querySelectorAll(".tableWrapper").forEach((wrapper) => {
            const table = wrapper.querySelector("table");
            const available = wrapper.clientWidth;
            if (!table || !available || table.offsetWidth <= available + 1) return;

            const scale = available / table.offsetWidth;
            const cols = [...table.querySelectorAll("col")];
            // Read every width first: changing one column moves the others
            const widths = table.rows[0] ? [...table.rows[0].cells].map((cell) => cell.offsetWidth) : [];
            saved.push({ table, style: table.getAttribute("style"), cols: cols.map((col) => [col, col.getAttribute("style")]) });
            widths.forEach((width, index) => {
                if (cols[index]) cols[index].style.width = `${Math.floor(width * scale)}px`;
            });
            table.style.width = `${available}px`;
        });
    });

    window.addEventListener("afterprint", () => {
        const put = (element, style) => (style === null ? element.removeAttribute("style") : element.setAttribute("style", style));
        saved.forEach(({ table, style, cols }) => {
            put(table, style);
            cols.forEach(([col, colStyle]) => put(col, colStyle));
        });
        saved = [];
    });
}