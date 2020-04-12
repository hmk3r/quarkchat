module.exports = function(app, controllers, params) {
  const homeController = controllers.home;

  app.get('/', homeController.home);
};
