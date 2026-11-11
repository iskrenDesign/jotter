# jotter

A lightweight, local note-taking app for Windows. Your notes stay on your computer, in plain files you own. No account, no cloud, no internet connection needed.

<!-- Add a screenshot here: ![Jotter screenshot](docs/screenshot.png) -->

> **Status:** early pre-release. Jotter is usable, but it is still changing quickly. Back up your `Documents\Jotter` folder if your notes are important.

## Features

- **Folders and pages.** Organize notes into folders, and add as many pages as you need to each one.
- **Pinned pages.** Pin the pages you use most. They stay in their folder and also appear in a Pinned section at the top.
- **Drag and drop.** Reorder folders, and move pages from one folder to another by dragging them.
- **Rich text editor.** Headings, bold, italic, underline, strikethrough, text color, alignment, bullet, numbered and task lists, links and images, powered by [TipTap](https://tiptap.dev).
- **Video cards.** Paste a YouTube or Vimeo link and get a card with the video title. It opens in your default browser.
- **Export and import.**
  - Save pages or whole folders as a single `.jot` file, and import it into another Jotter installation. Nothing is lost: titles, dates, formatting, images and pinned pages all come along.
  - Export any page as a **PDF** or a **Word document** (`.docx`).
- **Search.** Filter pages by title as you type.
- **Light and dark theme.** Follows your system by default and can be switched at any time.
- **Zoom.** Make the page bigger or smaller to suit your eyes.
- **Autosave.** Your page is saved half a second after you stop typing.
- **Works offline.** Everything, including the editor, is bundled with the app.
- **Keyboard shortcuts** for the things you do most (see below).

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl` + `N` | New page |
| `Ctrl` + `Shift` + `N` | New folder |
| `Ctrl` + `Shift` + `P` | Pin or unpin the page |
| `Ctrl` + `R` | Rename the page or folder |
| `Ctrl` + `D` | Delete the page or folder |
| `Ctrl` + `+` / `Ctrl` + `-` / `Ctrl` + `0` | Zoom in / zoom out / reset zoom |
| `Ctrl` + mouse wheel | Zoom |

## Exporting and importing

- **As a `.jot` file:** open the ⋮ menu of a page or a folder and choose **Export**. Checkboxes appear, so you can add or remove folders and pages, then click **Export selection**. To bring a file in, open the ⋮ menu next to the theme buttons and choose **Import a .jot file**. Imported folders are added at the top.
- **As a PDF:** choose **Export → As PDF** on a page, then pick **Save as PDF** in the print window.
- **As a Word document:** choose **Export → As Word Doc** on a page.

A `.jot` file is plain text (JSON), so your notes can always be recovered, even without Jotter.

## Where your notes are stored

Jotter keeps everything in your Documents folder:

```
Documents\Jotter\
├── jotter.json      folders, page titles, dates and pins
└── pages\
    └── <id>.html    the content of each page
```

Theme, zoom level and the last opened page are remembered by the app itself.

## Download

Get the latest Windows installer from the [Releases page](https://github.com/iskrenDesign/jotter/releases).

> Windows may show a "Windows protected your PC" (SmartScreen) message, because the installer is not code-signed yet. Click **More info**, then **Run anyway**.

## Roadmap

- [ ] Automatic updates
- [ ] Feedback prompt
- [ ] Fit-to-window zoom
- [ ] Page titles as file names, folders as real folders, and images saved as separate files
- [ ] Branded installer images
- [ ] Android version

## Built with

- Plain HTML, CSS and JavaScript (ES modules), with no framework
- [Tauri v2](https://tauri.app) for the Windows app
- [TipTap](https://tiptap.dev) for the editor

## Development

You need [Node.js](https://nodejs.org), [Rust](https://www.rust-lang.org/tools/install) and the [Tauri prerequisites for Windows](https://v2.tauri.app/start/prerequisites/).

```bash
git clone https://github.com/iskrenDesign/jotter.git
cd jotter
npm install
npm run build:tiptap   # bundles the editor into src/js/vendor/tiptap.js
npx tauri dev          # run the app in development
npx tauri build        # build the Windows installer
```

The web app lives in `src/`. You can also open `src/index.html` with a local server such as VS Code Live Server. In the browser, notes are stored in `localStorage` instead of your Documents folder.

The source code is visible for information only. Please read the license before reusing any of it.

## License

Jotter is free to use, but it is not open source. Copyright © 2026 [YOUR FULL NAME]. All rights reserved.

You may install and use the official installer. Copying, modifying or distributing Jotter, or reusing any part of it, requires written permission. See [LICENSE](LICENSE) for the full terms.

Versions 0.1.0 and 0.1.1 were released under the MIT License, and that license still applies to those versions.