import { loadPyodide, PyodideInterface } from "pyodide";

import PYODIDE_REQUIREMENTS from "../../pyodide.requirements.txt?raw";

export interface PyodideManagerOptions {
    indexURL: string;
}

export class PyodideManager {
    private indexURL: string;
    private pyodide: PyodideInterface | null;
    private running: boolean;

    constructor(options: PyodideManagerOptions) {
        this.indexURL = options.indexURL;
        this.pyodide = null;
        this.running = false;
    }

    async initialize(): Promise<PyodideInterface> {
        const packages = PYODIDE_REQUIREMENTS.split("\n")
            .map((v: string) => v.trim())
            .filter((v: string) => v !== "");
        this.pyodide = await loadPyodide({ indexURL: this.indexURL });
        await this.pyodide.loadPackage(packages);
        return this.pyodide;
    }

    async fsFetch(url: string, dest: string, maxRows: number = 10000) {
        const res = await fetch(url);
        if (res.ok) {
            const content = await res.text();
            await this.fsWrite(content, dest);
            const rows = content.split("\n").filter((row) => row.trim());
            return rows.slice(0, maxRows).join("\n");
        } else {
            throw new Error(`Failed to fetch ${url}`);
        }
    }

    async fsWrite(content: string, dest: string) {
        const fs = this.pyodide?.FS;
        if (fs) {
            fs.mkdirTree(dest.substring(0, dest.lastIndexOf("/")));
            fs.writeFile(dest, content);
        } else {
            throw new Error("[pyodide] File system not available.");
        }
        return content;
    }

    reset(): void {
        this.pyodide = null;
        this.running = false;
    }

    async runPythonAsync(code: string): Promise<any> {
        if (this.pyodide && !this.running) {
            this.running = true;
            try {
                return await this.pyodide.runPythonAsync(code);
            } finally {
                this.running = false;
            }
        } else {
            throw new Error("[pyodide] Execution not available or already in progress.");
        }
    }
}
