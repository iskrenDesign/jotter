// Places a popover menu and keeps it inside the window.
// align "start": the menu's left edge goes at x.
// align "end": the menu's right edge goes at x.
export function placeMenu(menu, top, x, align = "start") {
    const width = parseFloat(getComputedStyle(menu).width);
    const left = align === "end" ? x - width : x;
    const maxLeft = window.innerWidth - width - 16;
    menu.style.top = `${top}px`;
    menu.style.left = `${Math.max(16, Math.min(left, maxLeft))}px`;
}