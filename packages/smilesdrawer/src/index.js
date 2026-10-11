import SmilesDrawer from "smiles-drawer";
import { bestFitGrid, gridCapacity } from "./grid.js";
import "./index.css";

const DRAWING_SIZE = 250;
const MIN_VIEW_SIZE = 160;
const MIN_CELL_SIZE = 160;
const PAGE_WINDOW = 2;
const TEST_DATA_FILE = "test-data/test.smi";

const appElement = document.getElementById("app");

if (import.meta.env.DEV) {
    const pageUrl = new URL(window.location.href);
    appElement.dataset.incoming = JSON.stringify({
        root: "/",
        visualization_config: {
            dataset_id: pageUrl.searchParams.get("dataset_id") || process.env.dataset_id || "__test__",
        },
    });
}

const incoming = JSON.parse(appElement.dataset.incoming || "{}");
const root = incoming.root || "/";
const datasetId = incoming.visualization_config?.dataset_id;

const drawer = new SmilesDrawer.SvgDrawer({ width: DRAWING_SIZE, height: DRAWING_SIZE });
const themes = Object.fromEntries(Object.entries(drawer.opts.themes).filter(([name]) => name !== "custom"));

let molecules = [];
let filtered = [];
let currentPage = 1;
let pageSize = 1;
let currentTheme = "light";

appElement.innerHTML = `
  <div id="sd-error"></div>
  <div id="sd-toolbar">
    <label for="sd-search">Search</label>
    <input id="sd-search" type="search" placeholder="Filter by name or SMILES…" />
    <label for="sd-theme-select">Theme</label>
    <select id="sd-theme-select"></select>
    <span id="sd-count"></span>
    <div id="sd-pagination"></div>
  </div>
  <div id="sd-status">Loading dataset…</div>
  <div id="sd-grid"></div>
`;

const errorElement = document.getElementById("sd-error");
const statusElement = document.getElementById("sd-status");
const gridElement = document.getElementById("sd-grid");
const paginationElement = document.getElementById("sd-pagination");
const searchElement = document.getElementById("sd-search");
const themeElement = document.getElementById("sd-theme-select");
const countElement = document.getElementById("sd-count");

for (const name of Object.keys(themes)) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    themeElement.appendChild(option);
}
themeElement.value = currentTheme;

function showError(message) {
    errorElement.textContent = message;
    errorElement.style.display = "block";
    setStatus("");
}

function setStatus(message) {
    statusElement.textContent = message;
    statusElement.style.display = message ? "block" : "none";
}

function isDarkTheme(name) {
    const hex = themes[name]?.BACKGROUND?.replace("#", "") || "";
    if (hex.length !== 6) {
        return false;
    }
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}

function parseSmiles(text) {
    const result = [];
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }
        const [smiles, ...rest] = trimmed.split(/\s+/);
        result.push({ smiles, name: rest.join(" ") || smiles });
    }
    return result;
}

function fitViewBox(svg) {
    const [x, y, width, height] = svg.getAttribute("viewBox").split(/\s+/).map(Number);
    const size = Math.max(width, height, MIN_VIEW_SIZE);
    svg.setAttribute("viewBox", `${x - (size - width) / 2} ${y - (size - height) / 2} ${size} ${size}`);
}

function createCard({ smiles, name }) {
    const card = document.createElement("div");
    card.className = "sd-card";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    try {
        drawer.draw(SmilesDrawer.Parser.parse(smiles), svg, currentTheme);
        fitViewBox(svg);
        svg.removeAttribute("width");
        svg.removeAttribute("height");
        svg.removeAttribute("style");
        svg.classList.add("sd-drawing");
        card.appendChild(svg);
    } catch (err) {
        const failed = document.createElement("div");
        failed.className = "sd-drawing sd-parse-error";
        failed.textContent = "Parse error";
        failed.title = err?.message || String(err);
        card.appendChild(failed);
    }
    const label = document.createElement("div");
    label.className = "sd-card-label";
    label.title = name;
    label.textContent = name;
    card.appendChild(label);
    const code = document.createElement("div");
    code.className = "sd-card-smiles";
    code.title = smiles;
    code.textContent = smiles;
    card.appendChild(code);
    return card;
}

function createPageButton(label, page, disabled, active) {
    const button = document.createElement("button");
    button.textContent = label;
    button.disabled = disabled;
    button.classList.toggle("active", active);
    button.addEventListener("click", () => {
        currentPage = page;
        renderPage();
    });
    return button;
}

function renderPagination(totalPages) {
    paginationElement.innerHTML = "";
    if (totalPages < 2) {
        return;
    }
    paginationElement.appendChild(createPageButton("‹ Prev", currentPage - 1, currentPage === 1, false));
    for (let page = 1; page <= totalPages; page++) {
        const distance = Math.abs(page - currentPage);
        if (page === 1 || page === totalPages || distance <= PAGE_WINDOW) {
            paginationElement.appendChild(createPageButton(String(page), page, false, page === currentPage));
        } else if (distance === PAGE_WINDOW + 1) {
            const ellipsis = document.createElement("span");
            ellipsis.className = "sd-ellipsis";
            ellipsis.textContent = "…";
            paginationElement.appendChild(ellipsis);
        }
    }
    paginationElement.appendChild(createPageButton("Next ›", currentPage + 1, currentPage === totalPages, false));
}

function gridArea() {
    const style = getComputedStyle(gridElement);
    return {
        width: gridElement.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
        height: gridElement.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
        gap: parseFloat(style.rowGap) || 0,
    };
}

function fitPageSize() {
    const { width, height, gap } = gridArea();
    return gridCapacity(width, height, MIN_CELL_SIZE, gap);
}

function layoutGrid() {
    const { width, height, gap } = gridArea();
    const { columns, rows } = bestFitGrid(gridElement.childElementCount, width, height, gap);
    gridElement.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    gridElement.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
}

function renderPage() {
    gridElement.innerHTML = "";
    if (filtered.length === 0) {
        setStatus("No molecules match your filter.");
        renderPagination(0);
        return;
    }
    setStatus("");
    const start = (currentPage - 1) * pageSize;
    for (const molecule of filtered.slice(start, start + pageSize)) {
        gridElement.appendChild(createCard(molecule));
    }
    layoutGrid();
    renderPagination(Math.ceil(filtered.length / pageSize));
}

function applyFilter() {
    const query = searchElement.value.trim().toLowerCase();
    filtered = query
        ? molecules.filter((m) => m.smiles.toLowerCase().includes(query) || m.name.toLowerCase().includes(query))
        : molecules;
    currentPage = 1;
    countElement.textContent = query
        ? `${filtered.length} / ${molecules.length} molecules`
        : `${molecules.length} molecules`;
    renderPage();
}

function applyTheme() {
    document.body.classList.toggle("theme-dark", isDarkTheme(currentTheme));
    document.body.style.setProperty("--sd-drawing-background", themes[currentTheme].BACKGROUND);
}

themeElement.addEventListener("change", () => {
    currentTheme = themeElement.value;
    applyTheme();
    renderPage();
});

searchElement.addEventListener("input", applyFilter);

new ResizeObserver(() => {
    const size = fitPageSize();
    if (size !== pageSize) {
        const first = (currentPage - 1) * pageSize;
        pageSize = size;
        currentPage = Math.floor(first / pageSize) + 1;
        renderPage();
    } else {
        layoutGrid();
    }
}).observe(gridElement);

async function init() {
    if (!datasetId) {
        showError("No dataset_id provided by Galaxy.");
        return;
    }
    let text;
    try {
        const url = datasetId === "__test__" ? TEST_DATA_FILE : `${root}api/datasets/${datasetId}/display`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        text = await response.text();
    } catch (err) {
        showError(`Could not fetch dataset: ${err.message}`);
        return;
    }
    molecules = parseSmiles(text);
    if (molecules.length === 0) {
        showError("No SMILES strings found in the dataset.");
        return;
    }
    pageSize = fitPageSize();
    applyTheme();
    applyFilter();
}

init();
