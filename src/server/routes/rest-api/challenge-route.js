module.exports = function(app, controllers, params) {
  const challengeResponseController = controllers.challenge;

  app.get('/get-timestamp', challengeResponseController.serveTimestamp);
  app.get('/challenge', challengeResponseController.serveChallenge);
};
