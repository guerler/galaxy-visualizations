export interface PyodideManagerOptions {
    indexURL: string;
}

export class PyodideManager {
    private worker: Worker;
    private ready: Promise<void>;
    private pending: Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>;
    private destroyed: boolean;

    constructor(options: PyodideManagerOptions) {
        this.pending = new Map();
        this.destroyed = false;
        this.worker = new Worker(new URL("./pyodide-worker.ts", import.meta.url), {
            type: "module",
        });
        this.ready = new Promise((resolve, reject) => {
            this.worker.onmessage = (e) => {
                const { type, id, result, error } = e.data;
                if (type === "ready") {
                    resolve();
                    return;
                }
                if (id && this.pending.has(id)) {
                    const entry = this.pending.get(id)!;
                    this.pending.delete(id);
                    error ? entry.reject(error) : entry.resolve(result);
                }
            };
            this.worker.onerror = (e) => {
                reject(e);
            };
        });
        this.worker.postMessage({
            type: "initialize",
            payload: { indexURL: options.indexURL },
        });
    }

    private call(type: string, payload?: any): Promise<any> {
        if (this.destroyed) {
            return Promise.reject("Pyodide destroyed");
        } else {
            return new Promise((resolve, reject) => {
                const id = crypto.randomUUID();
                this.pending.set(id, { resolve, reject });
                this.worker.postMessage({ type, payload, id });
            });
        }
    }

    destroy(): void {
        if (!this.destroyed) {
            this.destroyed = true;
            this.worker.terminate();
            this.pending.clear();
        }
    }

    async fsFetch(url: string, dest: string, maxRows: number = 10000): Promise<string> {
        const res = await fetch(url);
        if (res.ok) {
            const content = await res.text();
            await this.fsWrite(content, dest);
            return content.split("\n").filter(Boolean).slice(0, maxRows).join("\n");
        } else {
            throw new Error(`Failed to fetch ${url}`);
        }
    }

    async fsWrite(content: string, dest: string): Promise<void> {
        await this.ready;
        await this.call("fsWrite", { content, dest });
    }

    async initialize(): Promise<void> {
        if (!this.destroyed) {
            await this.ready;
        } else {
            throw new Error("Pyodide destroyed");
        }
    }

    async runPythonAsync(code: string): Promise<any> {
        await this.ready;
        return await this.call("runPythonAsync", { code });
    }
}
