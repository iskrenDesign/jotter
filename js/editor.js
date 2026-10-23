import { Editor } from "https://esm.sh/@tiptap/core@3";
import StarterKit from "https://esm.sh/@tiptap/starter-kit@3";

export const editor = new Editor({
    element: document.querySelector(".page-editor"),
    extensions: [StarterKit],
    editable: false,
});