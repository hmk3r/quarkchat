module.exports = function(app, controllers, params) {
  const controller = controllers.benchmark;

  app.get('/benchmark', controller.benchmark);
};
