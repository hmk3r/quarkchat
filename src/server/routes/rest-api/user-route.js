const router = require('express').Router;

module.exports = function(app, controllers, params) {
  const {
    user: userController,
    challenge: challengeController,
  } = controllers;

  const accountRouter = router();

  accountRouter.use(challengeController.validateChallengedRequest);
  accountRouter.post('/spk', userController.submitSpk);
  accountRouter.post('/otpks', userController.submitOtpks);
  app.use('/account', accountRouter);
  app.get('/username-check/:username', userController.isUsernameFree);
  app.post('/register', userController.registerUser);
};
