import { createJSONEditor } from "vanilla-jsoneditor";
import * as yaml from "js-yaml";
import * as jsonld from "jsonld";
import "./main.css";

const TEST_DATASET_ID = "__test__";
const TEST_DATA_FILE = "test-data/test.json";
const TEST_DATA_EXTENSION = "json";

const appElement = document.querySelector("#app");

if (import.meta.env.DEV) {
    const pageUrl = new URL(window.location.href);
    const dataIncoming = {
        root: "/",
        visualization_config: {
            dataset_id: pageUrl.searchParams.get("dataset_id") || process.env.dataset_id || TEST_DATASET_ID,
            settings: {},
        },
    };
    appElement.setAttribute("data-incoming", JSON.stringify(dataIncoming));
}

const incoming = JSON.parse(appElement?.getAttribute("data-incoming") || "{}");
const datasetId = incoming?.visualization_config?.dataset_id || "";
const root = incoming?.root || "";
const settings = incoming?.visualization_config?.settings || {};
const mode = settings.mode || "tree";
const shouldExpandJsonld = settings.expand_jsonld === true || settings.expand_jsonld === "true";

const messageElement = document.createElement("div");
messageElement.id = "message";
appElement.appendChild(messageElement);

const editorElement = document.createElement("div");
editorElement.id = "jsoneditor";
appElement.appendChild(editorElement);

function isDarkTheme() {
    if (document.documentElement.getAttribute("data-theme") === "dark") return true;
    if (document.body.classList.contains("theme-dark")) return true;
    const style = getComputedStyle(document.documentElement);
    return style.getPropertyValue("--galaxy-theme")?.trim() === "dark";
}

function extensionToFormat(ext) {
    if (ext === "yaml" || ext === "yml") return "yaml";
    if (ext === "jsonld") return "jsonld";
    if (ext === "json") return "json";
    return null;
}

function detectFormatFromUrl(url) {
    if (url.endsWith(".yaml") || url.endsWith(".yml")) return "yaml";
    if (url.endsWith(".jsonld")) return "jsonld";
    if (url.endsWith(".json")) return "json";
    return null;
}

function detectFormatFromContent(content) {
    try {
        JSON.parse(content);
        return "json";
    } catch {
        try {
            yaml.load(content);
            return "yaml";
        } catch {
            return "text";
        }
    }
}

async function expandJsonLd(data) {
    try {
        return await jsonld.expand(data);
    } catch (e) {
        showError("Failed to expand JSON-LD", e);
        return data;
    }
}

function getEditorMode(modeSetting) {
    if (modeSetting === "text") return "text";
    if (modeSetting === "table") return "table";
    return "tree";
}

function renderEditor(jsonData, parserConfig) {
    if (isDarkTheme()) {
        editorElement.classList.add("jse-theme-dark");
    }

    createJSONEditor({
        target: editorElement,
        props: {
            content: { json: jsonData },
            mode: getEditorMode(mode),
            mainMenuBar: true,
            readOnly: true,
            ...parserConfig,
        },
    });

    hideMessage();
}

async function buildEditorData(content, format) {
    if (!format) {
        format = detectFormatFromContent(content);
    }

    if (format === "yaml") {
        return {
            jsonData: yaml.load(content),
            parserConfig: {
                parser: {
                    parse: (text) => yaml.load(text),
                    stringify: (value) => yaml.dump(value, { lineWidth: -1 }),
                },
            },
        };
    }

    if (format === "jsonld") {
        let jsonData = JSON.parse(content);
        if (shouldExpandJsonld) {
            jsonData = await expandJsonLd(jsonData);
        }
        return { jsonData, parserConfig: {} };
    }

    if (format === "json") {
        return { jsonData: JSON.parse(content), parserConfig: {} };
    }

    return { jsonData: { text: content }, parserConfig: {} };
}

async function fetchUrl(url, format = "text") {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
    return response[format]();
}

async function fetchContent() {
    if (datasetId && datasetId !== TEST_DATASET_ID) {
        showMessage("Loading...");
        if (datasetId.startsWith("http")) {
            const content = await fetchUrl(datasetId);
            return { content, format: detectFormatFromUrl(datasetId) };
        }
        const metadata = await fetchUrl(`${root}api/datasets/${datasetId}`, "json");
        const content = await fetchUrl(`${root}api/datasets/${datasetId}/display`);
        return { content, format: extensionToFormat(metadata.extension) };
    }

    showMessage(`Loading test data from ${TEST_DATA_FILE}...`);
    const content = await fetchUrl(TEST_DATA_FILE);
    return { content, format: TEST_DATA_EXTENSION };
}

function showMessage(title, detail) {
    const strong = document.createElement("strong");
    strong.textContent = title;
    messageElement.replaceChildren(strong);
    if (detail !== undefined) {
        messageElement.append(`: ${detail}`);
    }
    messageElement.style.display = "inline";
}

function showError(title, err) {
    showMessage(title, err);
    console.error(`${title}: ${err}`);
}

function hideMessage() {
    messageElement.style.display = "none";
}

async function initialize() {
    try {
        const { content, format } = await fetchContent();
        const { jsonData, parserConfig } = await buildEditorData(content, format);
        renderEditor(jsonData, parserConfig);
    } catch (e) {
        showError("Failed to load dataset", e);
    }
}

initialize();
