const fileWalker = require('../utils/file-system-utils').walkDirectorySync;

/**
 * Loads the routes defined in ./routers into the Express application
 *
 * @export
 * @param {Express.Application} app
 * @param {ControllersModule} controllers
 * @param {Object} params
 */
module.exports = function(app, controllers, params) {
  fileWalker(__dirname, (file) => {
    if (file.includes('-route')) {
      const modulePath = file;
      require(modulePath)(app, controllers, params);
    }
  });
};
