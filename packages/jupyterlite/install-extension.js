import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Allow usage of `__dirname` in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- Config ----
const EXT_NAME = "jl-galaxy";
const SOURCE_FILE = path.join(__dirname, "index.js");
const DEST_DIR = path.join(__dirname, "_output", "extensions", EXT_NAME);
const DEST_FILE = path.join(DEST_DIR, "index.js");
const CONFIG_PATH = path.join(__dirname, "_output", "jupyter-lite.json");

// ---- Copy extension ----
fs.mkdirSync(DEST_DIR, { recursive: true });
fs.copyFileSync(SOURCE_FILE, DEST_FILE);
console.log(`✅ Copied ${SOURCE_FILE} → ${DEST_FILE}`);

// ---- Patch jupyter-lite.json ----
if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`❌ jupyter-lite.json not found at ${CONFIG_PATH}`);
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));

config.federated_extensions = config.federated_extensions || [];

const alreadyExists = config.federated_extensions.some((entry) => entry.name === EXT_NAME);

if (!alreadyExists) {
    config.federated_extensions.push({
        name: EXT_NAME,
        load: `extensions/${EXT_NAME}/index.js`,
        extension: "./extension",
        liteExtension: true,
    });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log(`✅ Registered '${EXT_NAME}' in jupyter-lite.json`);
} else {
    console.log(`ℹ️ '${EXT_NAME}' is already registered in jupyter-lite.json`);
}
