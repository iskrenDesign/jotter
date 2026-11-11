// Creates latest.json for the updater, from the installer that "npx tauri build" just made.
// Usage:  npm run release:json -- "Short description of what is new"
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const config = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const version = config.version;
const installerName = `${config.productName}_${version}_x64-setup.exe`;
const folder = join("src-tauri", "target", "release", "bundle", "nsis");
const installer = join(folder, installerName);
const signature = `${installer}.sig`;

if (!existsSync(installer) || !existsSync(signature)) {
    console.error(`Could not find ${installerName} and its .sig file in ${folder}.`);
    console.error('Run "npx tauri build" first, with the signing key set (see the updater notes).');
    process.exit(1);
}

const latest = {
    version,
    notes: process.argv[2] || `Jotter ${version}`,
    pub_date: new Date().toISOString(),
    platforms: {
        "windows-x86_64": {
            signature: readFileSync(signature, "utf8").trim(),
            url: `https://github.com/iskrenDesign/jotter/releases/download/v${version}/${installerName}`,
        },
    },
};

const output = join(folder, "latest.json");
writeFileSync(output, JSON.stringify(latest, null, 2) + "\n");
console.log(`Created ${output}`);
console.log(`Upload these two files to the GitHub release v${version}:`);
console.log(`  1. ${installer}`);
console.log(`  2. ${output}`);
