# JupyterLite CDN Build

This repository contains a prebuilt, static version of [JupyterLite](https://jupyterlite.readthedocs.io/) that can be served via CDN (e.g., jsDelivr, unpkg) and embedded into platforms like [Galaxy](https://galaxyproject.org/) as a fully client-side notebook environment.

---

## 🔧 Prerequisites

- Python ≥ 3.7
- `pip`
- Recommended: virtual environment (`venv` or `conda`)

---

## 📦 Install JupyterLite

# 1. Create and activate a virtual environment
```bash
python3 -m venv .venv
source .venv/bin/activate
```

# 2. Upgrade pip
```bash
pip install --upgrade pip
```

# 3. Install JupyterLite
```bash
pip install jupyterlite
```

# 4. Initialize JupyterLite build configuration
```bash
jupyter lite init
```

# 5. Build the static output
```bash
jupyter lite build
```

This will generate a `_output/` folder containing:

```
_output/
├── index.html
├── jupyter-lite.json
├── config-utils.js
├── lab/
│   ├── index.html
│   └── extensions/...
└── ...
```

> The `lab/` folder is the full JupyterLite UI with Pyodide kernel and federated extensions.

---

## 📁 Project Layout (Post-Build)

You should move the `_output/` contents into your NPM package directory like this:

```
/
├── index.html              ← From _output
├── jupyter-lite.json       ← From _output
├── config-utils.js         ← From _output
├── loader.js               ← Optional: your dynamic Galaxy integration
├── lab/                    ← Entire lab folder from _output
├── package.json
└── README.md
```

> The `loader.js` file is optional and can be used to auto-load notebooks, datasets, or add custom Galaxy-related actions.

---

## 🚀 Publish to NPM

After verifying the contents:

```bash
npm publish --access public
```

You can then use your build via CDN:

```
https://cdn.jsdelivr.net/npm/@your-org/jupyterlite@1.0.0/lab/index.html
```

---

## ✅ Optional: Add Content

If you want default notebooks or files to appear in the file browser:

1. Place them in a `content/` directory:

```bash
mkdir content
echo "# Welcome to JupyterLite" > content/README.md
```

2. Rebuild:

```bash
jupyter lite build
```

This will generate `api/contents/all.json` used by the file browser.

---

## 🔐 Notes

- No backend: all code runs in the browser via Pyodide.
- No server required: safe to serve via static hosting or CDN.
- All files should be under 100MB compressed to meet NPM/CDN limits.

---

## 📚 Resources

- [JupyterLite Docs](https://jupyterlite.readthedocs.io/)
- [Galaxy Visualizations](https://galaxyproject.org/developer/visualizations/)
- [jsDelivr CDN](https://www.jsdelivr.com/)
