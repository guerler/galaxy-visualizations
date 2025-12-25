import { loadPyodide, PyodideInterface } from "pyodide";

//@ts-ignore
import PYODIDE_REQUIREMENTS from "../../pyodide.requirements.txt?raw";

export interface PyodideManagerOptions {
    indexURL: string;
}

export class PyodideManager {
    private indexURL: string;
    private pyodide: PyodideInterface | null;
    private loading: boolean;
    private ready: boolean;
    private running: boolean;

    constructor(options: PyodideManagerOptions) {
        this.indexURL = options.indexURL;
        this.pyodide = null;
        this.loading = false;
        this.ready = false;
        this.running = false;
    }

    async waitFor(reference: Function) {
        while (!reference()) {
            await new Promise<void>((r) => setTimeout(r, 10));
        }
    }

    async initialize(): Promise<PyodideInterface> {
        if (this.ready) {
            return this.pyodide as PyodideInterface;
        }
        if (this.loading) {
            await this.waitFor(() => this.ready);
            return this.pyodide as PyodideInterface;
        }
        const packages = PYODIDE_REQUIREMENTS.split("\n")
            .map((v: string) => v.trim())
            .filter((v: string) => v !== "");
        this.loading = true;
        this.pyodide = await loadPyodide({ indexURL: this.indexURL });
        await this.pyodide.loadPackage(packages);
        this.ready = true;
        this.loading = false;
        return this.pyodide;
    }

    isReady(): boolean {
        return this.ready;
    }

    async fsFetch(url: string, dest: string, maxRows: number = 10000) {
        if (!this.ready) {
            await this.initialize();
        }
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Failed to fetch ${url}`);
        }
        const content = await res.text();
        await this.fsWrite(content, dest);
        const rows = content.split("\n").filter((row) => row.trim());
        return rows.slice(0, maxRows).join("\n");
    }

    async fsWrite(content: string, dest: string) {
        if (!this.ready) {
            await this.initialize();
        }
        const fs = (this.pyodide as PyodideInterface).FS;
        fs.mkdirTree(dest.substring(0, dest.lastIndexOf("/")));
        fs.writeFile(dest, content);
        return content;
    }

    reset(): void {
        this.pyodide = null;
        this.ready = false;
        this.loading = false;
        this.running = false;
    }

    async runPythonAsync(code: string): Promise<any> {
        if (!this.ready) {
            await this.initialize();
        }
        if (this.running) {
            throw new Error("Pyodide execution already in progress");
        }
        this.running = true;
        try {
            return await (this.pyodide as PyodideInterface).runPythonAsync(code);
        } finally {
            this.running = false;
        }
    }

    async setGlobals(values: Record<string, unknown>): Promise<void> {
        if (!this.ready) {
            await this.initialize();
        }
        const globals = (this.pyodide as PyodideInterface).globals;
        for (const key in values) {
            globals.set(key, values[key]);
        }
    }
}
