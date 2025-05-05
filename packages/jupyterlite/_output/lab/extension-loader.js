(function() {
    // 1. Wait for JupyterLite to be ready
    function waitForJupyter() {
      return new Promise(resolve => {
        if (window._JUPYTERLAB) return resolve();
        const observer = new MutationObserver(() => {
          if (window._JUPYTERLAB) {
            observer.disconnect();
            resolve();
          }
        });
        observer.observe(document, { childList: true, subtree: true });
      });
    }
  
    // 2. Main extension code
    async function initExtension() {
      await waitForJupyter();
      
      const app = window._JUPYTERLAB;
      console.log("✅ Galaxy extension activated");
      
      const params = new URLSearchParams(window.location.search);
      const datasetUrl = params.get("dataset_url");
      
      if (datasetUrl) {
        try {
          const res = await fetch(datasetUrl);
          const text = await res.text();
          
          // Pyodide loader with timeout
          const pyodide = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error("Pyodide loading timed out"));
            }, 30000);
            
            function check() {
              if (window.loadPyodide) {
                clearTimeout(timeout);
                window.loadPyodide().then(resolve).catch(reject);
              } else {
                setTimeout(check, 100);
              }
            }
            check();
          });
          
          pyodide.FS.writeFile("/home/galaxy_data.txt", text);
          console.log("📦 Loaded Galaxy dataset");
        } catch (err) {
          console.error("❌ Error:", err);
        }
      }
    }
  
    // 3. Self-registration
    if (typeof define === 'function' && define.amd) {
      // AMD format (standard JupyterLite)
      define(['@jupyterlab/application'], initExtension);
    } else {
      // Fallback for direct loading
      initExtension();
    }
  })();