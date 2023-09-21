module.exports = function(app, controllers, params) {
  const challengeController = controllers.challenge;

  app.get('/get-timestamp', challengeController.serveTimestamp);
  app.get('/challenge', challengeController.serveChallenge);
};
