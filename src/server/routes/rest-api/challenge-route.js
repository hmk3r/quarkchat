module.exports = function(app, controllers, params) {
  const challengeController = controllers.challenge;

  app.post('/challenge', challengeController.serveChallenge);
};
