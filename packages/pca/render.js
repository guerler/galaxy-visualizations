import Plotly from "plotly.js-dist";
import { PCA } from "ml-pca";

const MAX_SIZE = 1024 * 256;

export async function render() {
    const appElement = document.querySelector("#app");
    const incoming = JSON.parse(appElement.dataset.incoming);

    let data = [];
    let header = [];
    let pcaResult = [];
    let colours = [];
    let annotations = [];
    let colourColumn = 1;
    let dataStart = 2;

    const HDA_ID = incoming.visualization_config.dataset_id;
    const API_URL = `${incoming.root}api/datasets/${HDA_ID}/display`;

    try {
        const response = await fetch(API_URL);
        const text = await response.text();
        const parsed = parseCSV(text);
        header = parsed.header;
        data = parsed.data;

        injectControls();
        updateVisualization();
    } catch (err) {
        showError(err.message || "Failed to render PCA visualization.");
    }

    function parseCSV(text) {
        const size = new Blob([text]).size;
        if (size > MAX_SIZE) {
            throw new Error("Dataset too large to render (max 100 KB).");
        }

        const lines = text.trim().split("\n").filter(Boolean);
        const rows = lines.map((line) =>
            line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((v) => v.replace(/^"|"$/g, "")),
        );

        if (rows.length < 2) throw new Error("Not enough data rows.");
        return {
            header: rows[0],
            data: rows.slice(1),
        };
    }

    function injectControls() {
        const wrapper = document.createElement("div");
        wrapper.id = "wrapper";

        const controls = document.createElement("div");
        controls.id = "controls";

        const label1 = document.createElement("label");
        label1.textContent = "Color by:";

        const selectColour = document.createElement("select");
        selectColour.id = "colour_column";
        for (let i = 0; i < dataStart; i++) {
            const option = document.createElement("option");
            option.value = i;
            option.textContent = header[i];
            if (i === colourColumn) option.selected = true;
            selectColour.appendChild(option);
        }
        selectColour.onchange = () => {
            colourColumn = parseInt(selectColour.value);
            updateVisualization();
        };

        const label2 = document.createElement("label");
        label2.textContent = "Start PCA at column:";

        const selectStart = document.createElement("select");
        selectStart.id = "data_start";

        for (let i = 0; i < header.length; i++) {
            const isNumeric = data.every((row) => !isNaN(parseFloat(row[i])));
            if (isNumeric) {
                const remainingCols = header.slice(i);
                const numericCols = remainingCols.filter((_, offset) =>
                    data.every((row) => !isNaN(parseFloat(row[i + offset]))),
                );

                if (numericCols.length >= 3) {
                    const option = document.createElement("option");
                    option.value = i;
                    option.textContent = `${i} (${header[i]})`;
                    if (i === dataStart) option.selected = true;
                    selectStart.appendChild(option);
                }
            }
        }

        selectStart.onchange = () => {
            dataStart = parseInt(selectStart.value);
            updateVisualization();
        };

        controls.appendChild(label1);
        controls.appendChild(selectColour);
        controls.appendChild(label2);
        controls.appendChild(selectStart);

        const visDiv = document.createElement("div");
        visDiv.id = "visualisation";

        wrapper.appendChild(controls);
        wrapper.appendChild(visDiv);
        document.body.appendChild(wrapper);
    }

    function updateVisualization() {
        if (colourColumn >= dataStart) {
            colourColumn = dataStart - 1;
        }

        const numerical = [];
        const filteredAnnotations = [];
        const filteredColours = [];

        for (const row of data) {
            const nums = row.slice(dataStart).map(parseFloat);
            if (nums.every((n) => !isNaN(n))) {
                numerical.push(nums);
                filteredAnnotations.push(
                    header
                        .slice(0, dataStart)
                        .map((key, i) => `<b>${key}</b>: ${row[i]}`)
                        .join("<br>"),
                );
                filteredColours.push(row[colourColumn]);
            }
        }

        const cleaned = removeConstantColumns(numerical);
        if (cleaned[0].length < 3) {
            showError("Too few variable features remain for PCA.");
            return;
        }

        try {
            const pca = new PCA(cleaned, { center: true, scale: true });
            const result = pca.predict(cleaned, { nComponents: 3 }).to2DArray();
            pcaResult = result;
            colours = filteredColours;
            annotations = filteredAnnotations;
            renderPlot();
        } catch (e) {
            showError("PCA failed: " + e.message);
        }
    }

    function removeConstantColumns(matrix) {
        const numCols = matrix[0].length;
        const transposed = Array.from({ length: numCols }, (_, colIdx) => matrix.map((row) => row[colIdx]));

        const filteredCols = transposed.filter((col) => {
            const first = col[0];
            return col.some((v) => v !== first);
        });

        return matrix.map((_, rowIdx) => filteredCols.map((col) => col[rowIdx]));
    }

    function renderPlot() {
        const uniqueGroups = [...new Set(colours)];
        const layout = {
            hoverlabel: { bgcolor: "#FFF" },
            scene: {
                xaxis: { title: "PC 1", zerolinecolor: "#ccc" },
                yaxis: { title: "PC 2", zerolinecolor: "#ccc" },
                zaxis: { title: "PC 3", zerolinecolor: "#ccc" },
            },
            margin: { l: 0, r: 0, b: 0, t: 20 },
        };

        const traces = uniqueGroups.map((group, i) => {
            const indices = colours.map((val, idx) => (val === group ? idx : -1)).filter((idx) => idx !== -1);
            const points = indices.map((idx) => pcaResult[idx]);
            const texts = indices.map((idx) => annotations[idx]);

            return {
                x: points.map((p) => p[0]),
                y: points.map((p) => p[1]),
                z: points.map((p) => p[2]),
                text: texts,
                name: group,
                type: "scatter3d",
                mode: "markers",
                marker: {
                    size: 6,
                    color: i,
                    opacity: 0.8,
                    colorscale: "Jet",
                },
                hovertemplate: "%{text}<br>PC 1: %{x:.5f}<br>PC 2: %{y:.5f}<br>PC 3: %{z:.5f}<extra></extra>",
            };
        });

        Plotly.newPlot("visualisation", traces, layout);
        window.onresize = () => Plotly.Plots.resize(container);
    }

    function showError(message) {
        const vis = document.getElementById("visualisation") || document.body;
        vis.innerHTML = "";
        const errorBox = document.createElement("div");
        errorBox.style.color = "red";
        errorBox.style.padding = "1em";
        errorBox.textContent = message;
        vis.appendChild(errorBox);
    }
}
