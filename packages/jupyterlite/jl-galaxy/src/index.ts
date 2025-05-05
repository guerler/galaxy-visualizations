import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

/**
 * Initialization data for the jl_galaxy extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jl_galaxy:plugin',
  description: 'Connect to Galaxy',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension jl_galaxy is activated!');
  }
};

export default plugin;
