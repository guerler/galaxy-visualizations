window.addEventListener("load", async () => {
    const app = window.jupyterapp;
    if (!app) {
        console.error("JupyterLite not available");
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const notebookUrl = params.get("notebook_url");

    // 1. Fetch and mount notebook
    if (notebookUrl) {
        try {
            const res = await fetch(notebookUrl);
            const notebookJson = await res.text();
            const pyodide = await window.loadPyodide();
            pyodide.FS.writeFile("/home/auto.ipynb", new TextEncoder().encode(notebookJson));
            console.log("Notebook written to /home/auto.ipynb");
        } catch (err) {
            console.error("Failed to load notebook:", err);
        }
    }

    // 2. Open notebook in the UI once JupyterLite is fully started
    app.started.then(() => {
        if (notebookUrl) {
            app.commands.execute("docmanager:open", {
                path: "auto.ipynb",
                factory: "Notebook"
            });
        }
    });

    // 3. Add Save to Galaxy command
    app.commands.addCommand("galaxy:save", {
        label: "Save Notebook to Galaxy",
        execute: async () => {
            const widget = app.shell.currentWidget;
            const context = app.docManager.contextForWidget(widget);
            const content = context?.model.toJSON();

            if (!content) {
                alert("No notebook content available");
                return;
            }

            const apiKey = params.get("key");
            const root = params.get("root");
            const historyId = params.get("history_id");

            if (!apiKey || !root || !historyId) {
                alert("Missing Galaxy API parameters");
                return;
            }

            const uploadUrl = `${root}api/histories/${historyId}/contents?key=${apiKey}`;
            const body = {
                history_id: historyId,
                name: "autosaved_notebook.ipynb",
                file_type: "ipynb",
                type: "file",
                dbkey: "?",
                content: JSON.stringify(content)
            };

            try {
                const res = await fetch(uploadUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body)
                });

                const result = await res.json();
                alert("Notebook saved to Galaxy history");
                console.log(result);
            } catch (err) {
                console.error("Upload failed:", err);
                alert("Failed to save notebook to Galaxy");
            }
        }
    });

    // 4. Add to command palette (if active)
    const palette = app.serviceManager.commands?.palette;
    if (palette) {
        palette.addItem({
            command: "galaxy:save",
            category: "Galaxy"
        });
    }
});
