# Jotter — Project Brief

A small, lightweight note-taking app I'm building for myself and sharing for free on GitHub.
Repository: https://github.com/iskrenDesign/jotter

## About me
- Beginner at coding (some basic knowledge).
- I'm on a Claude Pro plan and want to save usage.

## How to help me
- Small, step-by-step instructions. One step at a time.
- Always say whether something is an **app to download**, a **VS Code extension**, or a **website**, and include the link.
- For small changes, show only the lines that change, not the whole file.
- Keep answers short.

## Decisions so far
- **Platforms:** Desktop first (Windows/Mac), then Android. iPhone maybe later (needs a $99/year Apple account).
- **Tech:** Plain HTML, CSS and JavaScript. No frameworks, no build tools.
- **Desktop app:** Wrapped with **Tauri** (small installer, ~5–10 MB). Not Electron (too heavy).
- **Storage:** Notes saved as real files on the device (e.g. `Documents/Jotter/`), not browser storage, so they survive cache clearing and last for years. Users can sync the folder with Google Drive/Dropbox themselves.
- **Features (v1):** Note list, editor, basic formatting: font selection, alignment, bold/italic, headings, lists.
- **Fonts:** Inter for the interface. Note fonts to offer: Inter, Noto Sans, Roboto, a serif (Noto Serif or PT Serif), JetBrains Mono. All support Cyrillic. Font files are bundled in the app (works offline), only 2–3 weights.
- **Design (Figma):** Desktop frame 1440 × 960, mobile frame 360 × 800.
  - Desktop: note list and editor side by side.
  - Mobile: note list first, editor opens full screen, toolbar at the bottom / above the keyboard. Tap targets at least 48 × 48.
- **License:** MIT.
- **Money:** "Buy Me a Coffee" button on GitHub (via `FUNDING.yml`).
- **Future (free) features, maybe:** search, tags, dark mode, export/import.

## Tools I use
- **VS Code** (app), signed out of Copilot.
- **Live Server** (VS Code extension) to preview pages.
- **GitHub Desktop** (app, desktop.github.com) to save and upload code. Signed in as iskrenDesign.

## Roadmap
1. ✅ Install tools, create the GitHub repository
2. ⬜ Clone the repo, test a first `index.html` with Live Server, commit and push
3. ⬜ Figma: sketch the main screen (desktop + mobile)
4. ⬜ Build the layout: note list + editor
5. ⬜ Saving and loading notes
6. ⬜ Formatting toolbar
7. ⬜ Wrap in Tauri, save notes as files, build the installer
8. ⬜ README, Buy Me a Coffee, first release on GitHub
9. ⬜ Android version

## Where I am now
(Update this line before starting each new chat.)
