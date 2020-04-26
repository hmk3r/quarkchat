module.exports = function(app, controllers, params) {
  const {
    user: userController,
    // challenge: challengeController
  } = controllers;
  app.get('/username-check/:username', userController.isUsernameFree);
  app.post('/register', userController.registerUser);
};
