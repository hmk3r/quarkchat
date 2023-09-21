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
  messagingRouter.post('/send-message', messagingController.sendMessage);
  messagingRouter.post('/messages', messagingController.getAllMessages);
  app.use('/messaging', messagingRouter);
};
