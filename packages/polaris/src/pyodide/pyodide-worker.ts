import { loadPyodide } from "pyodide";
import PYODIDE_REQUIREMENTS from "../../pyodide.requirements.txt?raw";

let pyodide: any = null;
let running = false;

function parseCode(code: string | string[]): string {
    if (Array.isArray(code)) {
        return code.join("\n");
    } else {
        return code;
    }
}

function parsePackages(): string[] {
    return PYODIDE_REQUIREMENTS.split("\n")
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
}

self.onmessage = async (e) => {
    const { type, payload, id } = e.data;
    if (type === "initialize") {
        try {
            pyodide = await loadPyodide({ indexURL: payload.indexURL });
            const pyodidePackages = parsePackages();
            if (pyodidePackages) {
                await pyodide.loadPackage(pyodidePackages);
            }
            const customPackages = payload.packages || [];
            for (const whl of customPackages) {
                await pyodide.runPythonAsync(
                    parseCode([
                        "import micropip",
                        `await micropip.install("${payload.indexURL}/${whl}")`,
                        `print("Installed ${whl}.")`,
                    ]),
                );
            }
            self.postMessage({ type: "ready" });
        } catch (err) {
            self.postMessage({ type: "error", error: String(err) });
        }
        return;
    } else if (pyodide) {
        if (type === "fsWrite") {
            try {
                const fs = pyodide.FS;
                const dir = payload.dest.substring(0, payload.dest.lastIndexOf("/"));
                if (dir) {
                    fs.mkdirTree(dir);
                }
                fs.writeFile(payload.dest, payload.content);
                self.postMessage({ id, result: true });
            } catch (err) {
                self.postMessage({ id, error: String(err) });
            }
            return;
        }
        if (type === "runPythonAsync") {
            running = true;
            try {
                const result = await pyodide.runPythonAsync(parseCode(payload.code));
                self.postMessage({ id, result });
            } catch (err) {
                self.postMessage({ id, error: String(err) });
            } finally {
                running = false;
            }
        }
        self.postMessage({ id, error: `Unknown message type: ${type}` });
    } else {
        self.postMessage({ id, error: "Pyodide not initialized" });
    }
};
