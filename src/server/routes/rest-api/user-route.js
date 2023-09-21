module.exports = function(app, controllers, params) {
  const userController = controllers.user;

  app.get('/username-check/:username', userController.isUsernameFree);
};
