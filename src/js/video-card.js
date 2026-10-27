import { Node } from "./vendor/tiptap.js";

// Which platform is this link from? (null = not a video link)
export function videoProvider(text) {
    try {
        const { hostname } = new URL(text);
        if (hostname.endsWith("youtube.com") || hostname === "youtu.be") return "youtube";
        if (hostname.endsWith("vimeo.com")) return "vimeo";
    } catch {
        // Not a valid link
    }
    return null;
}

// Ask the platform for the thumbnail and title
const oembedUrls = {
    youtube: (url) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
    vimeo: (url) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`,
};

export async function getVideoInfo(url, provider) {
    try {
        const response = await fetch(oembedUrls[provider](url));
        const data = await response.json();
        return { thumbnail: data.thumbnail_url, title: data.title };
    } catch {
        return { thumbnail: null, title: url };
    }
}

// The video card block
export const VideoCard = Node.create({
    name: "videoCard",
    group: "block",
    atom: true,

    addAttributes() {
        return {
            url: { default: null },
            thumbnail: { default: null },
            title: { default: "" },
        };
    },

    parseHTML() {
        return [{
            tag: "figure[data-video-card]",
            getAttrs: (element) => ({
                url: element.dataset.url,
                thumbnail: element.querySelector("img")?.getAttribute("src") || null,
                title: element.querySelector("figcaption")?.textContent || "",
            }),
        }];
    },

    renderHTML({ node }) {
        const { url, thumbnail, title } = node.attrs;
        const content = [];
        if (thumbnail) content.push(["img", { src: thumbnail, alt: "" }]);
        content.push(["figcaption", {}, title]);
        return ["figure", { "data-video-card": "", "data-url": url, class: "video-card" }, ...content];
    },
});