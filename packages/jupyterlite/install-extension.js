import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXT_NAME = "jl-galaxy";
const SOURCE_FILE = path.join(__dirname, "extension.js");
const DEST_DIR = path.join(__dirname, "_output", "extensions", EXT_NAME);
const DEST_FILE = path.join(DEST_DIR, "index.js");
const CONFIG_PATH = path.join(__dirname, "_output", "jupyter-lite.json");

const EXT_ENTRY = {
  name: EXT_NAME,
  load: "index.js",
  extension: "./extension",
  liteExtension: true
};

// ---- Copy extension file ----
fs.mkdirSync(DEST_DIR, { recursive: true });
fs.copyFileSync(SOURCE_FILE, DEST_FILE);
console.log(`✅ Copied ${SOURCE_FILE} → ${DEST_FILE}`);

// ---- Patch correct federated_extensions ----
if (!fs.existsSync(CONFIG_PATH)) {
  console.error(`❌ jupyter-lite.json not found at ${CONFIG_PATH}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));

if (!config["jupyter-config-data"]) {
  config["jupyter-config-data"] = {};
}
const federated = config["jupyter-config-data"].federated_extensions ||= [];

const exists = federated.some((e) =>
  e.name === EXT_ENTRY.name &&
  e.load === EXT_ENTRY.load &&
  e.extension === EXT_ENTRY.extension &&
  e.liteExtension === EXT_ENTRY.liteExtension
);

if (!exists) {
  federated.push(EXT_ENTRY);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log(`✅ Registered '${EXT_NAME}' inside jupyter-config-data.federated_extensions`);
} else {
  console.log(`ℹ️ '${EXT_NAME}' is already registered (exact match)`);
}
