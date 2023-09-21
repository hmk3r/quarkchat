const fileWalker = require('../utils/file-system-utils').walkDirectorySync;

/**
 *
 *
 * @export
 * @param {Object} params
 * @return {ControllersModule}
 */
module.exports = function(params) {
  const controllers = {};

  fileWalker(__dirname, (file, fileName) => {
    if (file.includes('-controller')) {
      const modulePath = file;
      const theModule = require(modulePath)(params);
      const moduleName = theModule.name ||
        fileName.substring(0, fileName.lastIndexOf('-'));

      controllers[moduleName] = theModule;
    }
  });
  return controllers;
};
