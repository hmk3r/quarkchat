const router = require('express').Router;

module.exports = function(app, controllers, params) {
  const {
    challenge: challengeController,
    messaging: messagingController,
  } = controllers;

  const messagingRouter = router();

  messagingRouter.use(challengeController.validateChallengedRequest);
  messagingRouter.post('/key-bundle', messagingController.fetchKeyBundle);
  messagingRouter.post('/bind-socket', messagingController.bindSocket);
  app.use('/messaging', messagingRouter);
};
