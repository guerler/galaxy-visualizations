import axios from "axios";
import "./main.css";
import * as OV from "online-3d-viewer";

// Number of rows per request
const DELAY = 100;
const LIMIT = 50;

// Access container element
const appElement = document.querySelector("#app");

// Attach mock data for development
if (import.meta.env.DEV) {
    // Build the incoming data object
    const dataIncoming = {
        root: "/",
        visualization_config: {
            dataset_id: process.env.dataset_id,
        },
    };

    // Attach config to the data-incoming attribute
    appElement.dataset.incoming = JSON.stringify(dataIncoming);
}

// Access attached data
const incoming = JSON.parse(appElement.dataset.incoming || "{}");

/** Now you can consume the incoming data in your application.
 * In this example, the data was attached in the development mode block.
 * In production, this data will be provided by Galaxy.
 */
const datasetId = incoming.visualization_config.dataset_id;
const root = incoming.root;

/* Build the data request url. Modify the API route if necessary. */
const datasetUrl = `${root}datasets/${datasetId}/display/model.glb`;
const metaUrl = `${root}api/datasets/${datasetId}`;

/* Build and attach message element */
const messageElement = document.createElement("div");
messageElement.id = "message";
messageElement.style.display = "none";
appElement.appendChild(messageElement);

/* Build and attach table element */
const targetElement = document.createElement("div");
targetElement.id = "table";
targetElement.style.height = "100vh";
appElement.appendChild(targetElement);

async function create() {
    showMessage("Loading...");
    const dataset = await getData(metaUrl);
    if (dataset.extension) {
        new OV.Init3DViewerFromUrlList(targetElement, [datasetUrl], {
            camera : new OV.Camera (
                new OV.Coord3D (-1.5, 2.0, 3.0),
                new OV.Coord3D (0.0, 0.0, 0.0),
                new OV.Coord3D (0.0, 1.0, 0.0),
                45.0
            ),
            backgroundColor : new OV.RGBAColor (255, 255, 255, 255),
        });
        console.log(datasetUrl);
        /*const viewer = new OV.EmbeddedViewer(targetElement, {
        });
        
        viewer.LoadModelFromUrlList ([
            'DamagedHelmet.glb'
        ]);*/
        hideMessage();
    } else {
        showMessage("No matching extension.");
    }
}

async function getData(url) {
    try {
        const { data } = await axios.get(url);
        return data;
    } catch (e) {
        showMessage("Failed to retrieve data.", e);
    }
}

function showMessage(title, details = null) {
    details = details ? `: ${details}` : "";
    messageElement.innerHTML = `${title}${details}`;
    messageElement.style.display = "inline";
    console.debug(`${title}${details}`);
}

function hideMessage() {
    messageElement.style.display = "none";
}

create();
