// Word export: builds a .docx file from the HTML of a page. No libraries needed.
// A .docx is a ZIP file with XML files inside, so this file has two parts:
// 1) turn the page HTML into Word XML, 2) pack the XML files into a ZIP.
import { cleanFileName } from "./jot.js";
 
const dialog = window.__TAURI__?.dialog;
const fs = window.__TAURI__?.fs;
 
// A4 page with 2.54 cm margins. Word measures in twentieths of a point (1440 = 1 inch)
const PAGE_WIDTH = 11906;
const PAGE_HEIGHT = 16838;
const PAGE_MARGIN = 1440;
const TEXT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const MAX_IMAGE_PX = 600;
const EMU_PER_PX = 9525;
 
const BLOCK_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "BLOCKQUOTE", "PRE", "HR", "TABLE", "DIV", "SECTION", "ARTICLE", "FIGURE"]);
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "LABEL", "INPUT", "NOSCRIPT", "TEMPLATE"]);
const ALIGN = { left: "left", right: "right", center: "center", justify: "both" };
 
// ---------------------------------------------------------------- helpers
 
function escapeXml(text) {
    return String(text)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
 
function toHex(color) {
    if (!color) return null;
    const rgb = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgb) return [rgb[1], rgb[2], rgb[3]].map((part) => Number(part).toString(16).padStart(2, "0")).join("").toUpperCase();
    const hex = color.match(/^#([0-9a-f]{6})$/i) || color.match(/^#([0-9a-f]{3})$/i);
    if (!hex) return null;
    const value = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join("") : hex[1];
    return value.toUpperCase();
}
 
// Font size from a style such as "18px" or "12pt", in half-points (what Word uses)
function toHalfPoints(size) {
    const match = /^([\d.]+)(px|pt)$/.exec(size || "");
    if (!match) return null;
    const points = match[2] === "px" ? Number(match[1]) * 0.75 : Number(match[1]);
    return Math.max(2, Math.round(points * 2));
}
 
function alignOf(node) {
    return ALIGN[node.style?.textAlign] || null;
}
 
// ---------------------------------------------------------------- text and formatting
 
function runProps(format) {
    let props = "";
    if (format.mono) props += '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>';
    if (format.bold) props += "<w:b/><w:bCs/>";
    if (format.italic) props += "<w:i/><w:iCs/>";
    if (format.strike) props += "<w:strike/>";
    const color = format.color || (format.link ? "0563C1" : null);
    if (color) props += `<w:color w:val="${color}"/>`;
    const size = format.size || (format.mono ? 20 : null);
    if (size) props += `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`;
    if (format.highlight) props += `<w:highlight w:val="${format.highlight}"/>`;
    if (format.underline || format.link) props += '<w:u w:val="single"/>';
    if (format.vertAlign) props += `<w:vertAlign w:val="${format.vertAlign}"/>`;
    return props ? `<w:rPr>${props}</w:rPr>` : "";
}
 
function textRun(text, format) {
    const clean = text.replace(/\s*\n\s*/g, " ");
    if (!clean) return "";
    const parts = clean.split("\t").map((part) => `<w:t xml:space="preserve">${escapeXml(part)}</w:t>`);
    return `<w:r>${runProps(format)}${parts.join("<w:tab/>")}</w:r>`;
}
 
// Formatting that comes from a style="..." attribute (text color, size, bold, italic, underline)
function applyStyle(node, format) {
    const style = node.style;
    if (!style) return;
    const color = toHex(style.color);
    if (color) format.color = color;
    const size = toHalfPoints(style.fontSize);
    if (size) format.size = size;
    if (style.fontWeight === "bold" || Number(style.fontWeight) >= 600) format.bold = true;
    if (style.fontStyle === "italic") format.italic = true;
    const decoration = style.textDecorationLine || style.textDecoration || "";
    if (decoration.includes("underline")) format.underline = true;
    if (decoration.includes("line-through")) format.strike = true;
}
 
function imageRun(node, ctx) {
    const image = ctx.imageMap.get(node);
    if (!image) {
        const alt = node.getAttribute("alt");
        return alt ? textRun(`[${alt}]`, {}) : "";
    }
    const cx = Math.round(image.width * EMU_PER_PX);
    const cy = Math.round(image.height * EMU_PER_PX);
    const description = escapeXml(node.getAttribute("alt") || "");
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${image.number}" name="Image ${image.number}" descr="${description}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${image.number}" name="${image.fileName}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${image.rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}
 
// Turns inline content (text, bold, links, images...) into Word runs
function inlineRuns(nodes, ctx, format) {
    let xml = "";
    for (const node of nodes) {
        if (node.nodeType === 3) {
            xml += textRun(node.nodeValue, format);
            continue;
        }
        if (node.nodeType !== 1 || SKIP_TAGS.has(node.tagName)) continue;
 
        const tag = node.tagName;
        if (tag === "BR") {
            if (node.parentNode.childNodes.length > 1) xml += "<w:r><w:br/></w:r>";
            continue;
        }
        if (tag === "IMG") {
            xml += imageRun(node, ctx);
            continue;
        }
 
        const next = { ...format };
        if (tag === "STRONG" || tag === "B") next.bold = true;
        if (tag === "EM" || tag === "I") next.italic = true;
        if (tag === "U") next.underline = true;
        if (tag === "S" || tag === "STRIKE" || tag === "DEL") next.strike = true;
        if (tag === "CODE") next.mono = true;
        if (tag === "MARK") next.highlight = "yellow";
        if (tag === "SUP") next.vertAlign = "superscript";
        if (tag === "SUB") next.vertAlign = "subscript";
        applyStyle(node, next);
 
        const href = tag === "A" ? node.getAttribute("href") : null;
        if (href && /^(https?:|mailto:)/i.test(href)) {
            ctx.links.push(href);
            const rId = `rIdL${ctx.links.length}`;
            xml += `<w:hyperlink r:id="${rId}" w:history="1">${inlineRuns(node.childNodes, ctx, { ...next, link: true })}</w:hyperlink>`;
        } else {
            xml += inlineRuns(node.childNodes, ctx, next);
        }
    }
    return xml;
}
 
// ---------------------------------------------------------------- paragraphs, lists, tables
 
// opts carries where we are: level (list depth), marker (bullet for the first paragraph),
// quote (inside a quote), shade/tight (code lines) and format (base text formatting)
function makeParagraph(content, opts, { style, jc, border } = {}) {
    const marker = opts.marker;
    opts.marker = null;
 
    let pPr = "";
    if (style) pPr += `<w:pStyle w:val="${style}"/>`;
    if (marker?.numId) pPr += `<w:numPr><w:ilvl w:val="${marker.level}"/><w:numId w:val="${marker.numId}"/></w:numPr>`;
 
    let borders = "";
    if (opts.quote) borders += '<w:left w:val="single" w:sz="12" w:space="10" w:color="BFBFBF"/>';
    if (border === "hr") borders += '<w:bottom w:val="single" w:sz="6" w:space="1" w:color="BFBFBF"/>';
    if (borders) pPr += `<w:pBdr>${borders}</w:pBdr>`;
 
    if (opts.shade) pPr += '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>';
    if (opts.tight) pPr += '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>';
    else if (opts.level !== undefined) pPr += '<w:spacing w:after="60"/>';
 
    let left = 0;
    let hanging = 0;
    if (!marker?.numId) {
        if (marker?.task) {
            left = (opts.level + 1) * 720;
            hanging = 360;
        } else if (opts.level !== undefined) {
            left = (opts.level + 1) * 720;
        } else if (opts.quote) {
            left = 720;
        }
    }
    if (left) pPr += `<w:ind w:left="${left}"${hanging ? ` w:hanging="${hanging}"` : ""}/>`;
    if (jc) pPr += `<w:jc w:val="${jc}"/>`;
 
    const box = marker?.task
        ? `<w:r><w:rPr><w:rFonts w:ascii="Segoe UI Symbol" w:hAnsi="Segoe UI Symbol" w:cs="Segoe UI Symbol"/></w:rPr><w:t>${marker.task}</w:t></w:r><w:r><w:tab/></w:r>`
        : "";
    return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ""}${box}${content}</w:p>`;
}
 
function hasBlockChildren(node) {
    return [...node.childNodes].some((child) => child.nodeType === 1 && BLOCK_TAGS.has(child.tagName));
}
 
function convertList(list, ctx, opts) {
    const level = opts.level === undefined ? 0 : Math.min(opts.level + 1, 8);
    const task = list.getAttribute("data-type") === "taskList";
    const ordered = list.tagName === "OL";
    let numId = null;
    if (!task) numId = ordered ? ctx.newNumber(level, parseInt(list.getAttribute("start"), 10) || 1) : 1;
 
    const out = [];
    for (const item of list.children) {
        if (item.tagName !== "LI") continue;
        // A task item keeps its text in a <div> next to the checkbox
        const nodes = [];
        for (const child of item.childNodes) {
            if (child.nodeType === 1 && child.tagName === "DIV") nodes.push(...child.childNodes);
            else nodes.push(child);
        }
        const checked = item.getAttribute("data-checked") === "true";
        const itemOpts = { ...opts, level, marker: { numId, level, task: task ? (checked ? "\u2611" : "\u2610") : null } };
        const blocks = convertNodes(nodes, ctx, itemOpts);
        out.push(...(blocks.length > 0 ? blocks : [makeParagraph("", itemOpts)]));
    }
    return out;
}
 
function convertTable(table, ctx) {
    const rows = [...table.querySelectorAll("tr")];
    const cellsOf = (row) => [...row.children].filter((cell) => cell.tagName === "TD" || cell.tagName === "TH");
    const spanOf = (cell) => Math.max(1, parseInt(cell.getAttribute("colspan"), 10) || 1);
    const columns = Math.max(1, ...rows.map((row) => cellsOf(row).reduce((sum, cell) => sum + spanOf(cell), 0)));
    const columnWidth = Math.floor(TEXT_WIDTH / columns);
 
    const border = (side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>`;
    let xml = `<w:tbl><w:tblPr><w:tblW w:w="${columnWidth * columns}" w:type="dxa"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(border).join("")}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>`;
    xml += `<w:tblGrid>${`<w:gridCol w:w="${columnWidth}"/>`.repeat(columns)}</w:tblGrid>`;
 
    for (const row of rows) {
        xml += "<w:tr>";
        for (const cell of cellsOf(row)) {
            const span = spanOf(cell);
            const blocks = convertNodes(cell.childNodes, ctx, { format: cell.tagName === "TH" ? { bold: true } : {} });
            xml += `<w:tc><w:tcPr><w:tcW w:w="${columnWidth * span}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ""}</w:tcPr>${blocks.join("") || "<w:p/>"}</w:tc>`;
        }
        xml += "</w:tr>";
    }
    // Word needs a paragraph after a table
    return [xml + "</w:tbl>", "<w:p/>"];
}
 
function convertBlock(node, ctx, opts) {
    const tag = node.tagName;
    const format = opts.format || {};
 
    if (tag === "P") return [makeParagraph(inlineRuns(node.childNodes, ctx, format), opts, { jc: alignOf(node) })];
    if (/^H[1-6]$/.test(tag)) {
        return [makeParagraph(inlineRuns(node.childNodes, ctx, format), opts, { style: `Heading${tag[1]}`, jc: alignOf(node) })];
    }
    if (tag === "UL" || tag === "OL") return convertList(node, ctx, opts);
    if (tag === "BLOCKQUOTE") return convertNodes(node.childNodes, ctx, { ...opts, quote: true });
    if (tag === "HR") return [makeParagraph("", opts, { border: "hr" })];
    if (tag === "TABLE") return convertTable(node, ctx);
    if (tag === "PRE") {
        const lines = node.textContent.replace(/\n$/, "").split("\n");
        return lines.map((line) => makeParagraph(textRun(line, { mono: true }), { ...opts, shade: true, tight: true }));
    }
 
    // Anything else (div, section, custom blocks such as video cards)
    if (hasBlockChildren(node)) return convertNodes(node.childNodes, ctx, opts);
    const url = node.getAttribute("data-url") || node.getAttribute("data-href") || node.getAttribute("href");
    let content;
    if (url && /^(https?:|mailto:)/i.test(url)) {
        ctx.links.push(url);
        const rId = `rIdL${ctx.links.length}`;
        const linkFormat = { ...format, link: true };
        const runs = node.textContent.trim() ? inlineRuns(node.childNodes, ctx, linkFormat) : textRun(url, linkFormat);
        content = `<w:hyperlink r:id="${rId}" w:history="1">${runs}</w:hyperlink>`;
    } else {
        content = inlineRuns(node.childNodes, ctx, format);
    }
    return [makeParagraph(content, opts, { jc: alignOf(node) })];
}
 
// Goes through a list of nodes: block elements become their own blocks,
// and loose text and inline elements are gathered into paragraphs
function convertNodes(nodes, ctx, opts) {
    const out = [];
    let group = [];
    const flush = () => {
        if (group.some((node) => node.nodeType !== 3 || node.nodeValue.trim())) {
            out.push(makeParagraph(inlineRuns(group, ctx, opts.format || {}), opts));
        }
        group = [];
    };
 
    for (const node of nodes) {
        if (node.nodeType === 1 && SKIP_TAGS.has(node.tagName)) continue;
        if (node.nodeType === 3 || (node.nodeType === 1 && !BLOCK_TAGS.has(node.tagName))) {
            group.push(node);
        } else if (node.nodeType === 1) {
            flush();
            out.push(...convertBlock(node, ctx, opts));
        }
    }
    flush();
    return out;
}
 
// ---------------------------------------------------------------- images
 
function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}
 
async function loadImage(src) {
    const image = new Image();
    image.src = src;
    await image.decode();
    return image;
}
 
// Finds every picture in the page, reads its size and gets its bytes ready (PNG or JPEG)
async function prepareImages(root, ctx) {
    for (const node of root.querySelectorAll("img")) {
        const match = /^data:(image\/[a-z0-9.+-]+)(;base64)?,/i.exec(node.getAttribute("src") || "");
        if (!match) continue; // only pictures stored inside the page can be exported
 
        try {
            const src = node.getAttribute("src");
            const type = match[1].toLowerCase();
            const picture = await loadImage(src);
            let width = picture.naturalWidth || 300;
            let height = picture.naturalHeight || 150;
 
            let bytes;
            let extension;
            if (match[2] && (type === "image/png" || type === "image/jpeg" || type === "image/jpg")) {
                bytes = base64ToBytes(src.slice(match[0].length));
                extension = type === "image/png" ? "png" : "jpeg";
            } else {
                // Other formats (webp, gif, svg) are converted to PNG
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                canvas.getContext("2d").drawImage(picture, 0, 0, width, height);
                const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
                bytes = new Uint8Array(await blob.arrayBuffer());
                extension = "png";
            }
 
            const wanted = parseFloat(node.getAttribute("width")) || width;
            const scale = Math.min(1, MAX_IMAGE_PX / wanted);
            height = height * (wanted / width);
            width = wanted;
 
            const number = ctx.images.length + 1;
            const image = {
                number,
                rId: `rIdI${number}`,
                fileName: `image${number}.${extension}`,
                extension,
                bytes,
                width: Math.round(width * scale),
                height: Math.round(height * scale),
            };
            ctx.images.push(image);
            ctx.imageMap.set(node, image);
        } catch (error) {
            console.warn("Skipped a picture that could not be read", error);
        }
    }
}
 
// ---------------------------------------------------------------- the other files in the .docx
 
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
 
function stylesXml() {
    const headings = [
        [1, 40, 360],
        [2, 32, 300],
        [3, 28, 240],
        [4, 26, 240],
        [5, 24, 200],
        [6, 22, 200],
    ].map(([level, size, before]) => `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="${before}" w:after="120"/><w:outlineLvl w:val="${level - 1}"/></w:pPr><w:rPr><w:b/><w:bCs/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr></w:style>`);
 
    return `${XML_HEADER}<w:styles ${W_NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${headings.join("")}</w:styles>`;
}
 
function numberingXml(numbers) {
    const level = (i, format, text, font) => `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${format}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${(i + 1) * 720}" w:hanging="360"/></w:pPr>${font ? `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}" w:hint="default"/></w:rPr>` : ""}</w:lvl>`;
    const levels = [...Array(9).keys()];
    const bullets = levels.map((i) => level(i, "bullet", ["\u2022", "\u25E6", "\u25AA"][i % 3], "Arial")).join("");
    const decimals = levels.map((i) => level(i, ["decimal", "lowerLetter", "lowerRoman"][i % 3], `%${i + 1}.`)).join("");
 
    const nums = numbers.map(({ level: ilvl, start }, index) => `<w:num w:numId="${index + 2}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="${ilvl}"><w:startOverride w:val="${start}"/></w:lvlOverride></w:num>`);
 
    return `${XML_HEADER}<w:numbering ${W_NS}><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${bullets}</w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${decimals}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>${nums.join("")}</w:numbering>`;
}
 
function contentTypesXml() {
    return `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`;
}
 
function rootRelsXml() {
    return `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL_TYPE}/officeDocument" Target="word/document.xml"/></Relationships>`;
}
 
function documentRelsXml(ctx) {
    const images = ctx.images.map((image) => `<Relationship Id="${image.rId}" Type="${REL_TYPE}/image" Target="media/${image.fileName}"/>`);
    const links = ctx.links.map((url, index) => `<Relationship Id="rIdL${index + 1}" Type="${REL_TYPE}/hyperlink" Target="${escapeXml(url)}" TargetMode="External"/>`);
    return `${XML_HEADER}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL_TYPE}/styles" Target="styles.xml"/><Relationship Id="rId2" Type="${REL_TYPE}/numbering" Target="numbering.xml"/>${images.join("")}${links.join("")}</Relationships>`;
}
 
function documentXml(body) {
    return `${XML_HEADER}<w:document ${W_NS} xmlns:r="${REL_TYPE}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}<w:sectPr><w:pgSz w:w="${PAGE_WIDTH}" w:h="${PAGE_HEIGHT}"/><w:pgMar w:top="${PAGE_MARGIN}" w:right="${PAGE_MARGIN}" w:bottom="${PAGE_MARGIN}" w:left="${PAGE_MARGIN}" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}
 
// ---------------------------------------------------------------- ZIP
 
const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    return table;
})();
 
function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}
 
// Packs files into a ZIP without compression (pictures are already compressed, text is small)
function makeZip(files) {
    const encoder = new TextEncoder();
    const now = new Date();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
 
    const parts = [];
    const directory = [];
    let offset = 0;
 
    for (const file of files) {
        const name = encoder.encode(file.name);
        const size = file.data.length;
        const crc = crc32(file.data);
 
        const local = new DataView(new ArrayBuffer(30));
        local.setUint32(0, 0x04034b50, true);
        local.setUint16(4, 20, true);
        local.setUint16(6, 0x0800, true);
        local.setUint16(10, time, true);
        local.setUint16(12, date, true);
        local.setUint32(14, crc, true);
        local.setUint32(18, size, true);
        local.setUint32(22, size, true);
        local.setUint16(26, name.length, true);
        parts.push(new Uint8Array(local.buffer), name, file.data);
 
        const entry = new DataView(new ArrayBuffer(46));
        entry.setUint32(0, 0x02014b50, true);
        entry.setUint16(4, 20, true);
        entry.setUint16(6, 20, true);
        entry.setUint16(8, 0x0800, true);
        entry.setUint16(12, time, true);
        entry.setUint16(14, date, true);
        entry.setUint32(16, crc, true);
        entry.setUint32(20, size, true);
        entry.setUint32(24, size, true);
        entry.setUint16(28, name.length, true);
        entry.setUint32(42, offset, true);
        directory.push(new Uint8Array(entry.buffer), name);
 
        offset += 30 + name.length + size;
    }
 
    const directorySize = directory.reduce((sum, part) => sum + part.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, directorySize, true);
    end.setUint32(16, offset, true);
 
    const all = [...parts, ...directory, new Uint8Array(end.buffer)];
    const zip = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
    let position = 0;
    for (const part of all) {
        zip.set(part, position);
        position += part.length;
    }
    return zip;
}
 
// ---------------------------------------------------------------- public functions
 
// Returns the bytes of a .docx file made from the HTML of a page
export async function buildDocx(html) {
    const parsed = new DOMParser().parseFromString(html || "", "text/html");
    const ctx = {
        images: [],
        links: [],
        numbers: [],
        imageMap: new Map(),
        // Every numbered list gets its own number, so each one starts again at 1
        newNumber(level, start) {
            this.numbers.push({ level, start });
            return this.numbers.length + 1;
        },
    };
 
    await prepareImages(parsed.body, ctx);
    const body = convertNodes(parsed.body.childNodes, ctx, {}).join("") || "<w:p/>";
 
    const encoder = new TextEncoder();
    const text = (xml) => encoder.encode(xml);
    return makeZip([
        { name: "[Content_Types].xml", data: text(contentTypesXml()) },
        { name: "_rels/.rels", data: text(rootRelsXml()) },
        { name: "word/document.xml", data: text(documentXml(body)) },
        { name: "word/_rels/document.xml.rels", data: text(documentRelsXml(ctx)) },
        { name: "word/styles.xml", data: text(stylesXml()) },
        { name: "word/numbering.xml", data: text(numberingXml(ctx.numbers)) },
        ...ctx.images.map((image) => ({ name: `word/media/${image.fileName}`, data: image.bytes })),
    ]);
}
 
// Asks where to save and writes the file. Returns true when saved, false when cancelled
export async function saveDocxFile(bytes, fileName) {
    const name = cleanFileName(fileName) + ".docx";
 
    // Desktop app: ask where to save, then write the file
    if (dialog && fs) {
        const path = await dialog.save({
            defaultPath: name,
            filters: [{ name: "Word document", extensions: ["docx"] }],
        });
        if (!path) return false;
        await fs.writeFile(path, bytes);
        return true;
    }
 
    // Browser (Live Server): download the file
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    return true;
}