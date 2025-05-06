var _JUPYTERLAB = _JUPYTERLAB || {};

_JUPYTERLAB["jl-galaxy"] = {
    init: async (incoming) => {
        console.log("jl-galaxy init()", incoming);
    },
    get: async (request) => {
        console.log("jl-galaxy get() request:", request);
        if (request === "./extension") {
            return () => ({
                __esModule: true,
                default: [
                    {
                        id: "jl-galaxy:plugin",
                        autoStart: true,
                        activate: (app) => {
                            console.log("Activated jl-galaxy!", app);
                        },
                    },
                ],
            });
        }
        throw new Error("Unknown request: " + request);
    },
};
