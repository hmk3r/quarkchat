module.exports = function(app, params) {
  const {
    config,
  } = params;

  // Handle page not found
  app.use(function(req, res) {
    res.status(404).json({name: '404', message: 'Page not found'});
  });

  // Handle internal server errors
  app.use(function(error, req, res, next) {
    let status = 500;
    let name = error.name;
    let message = error.message;

    if (error.hasOwnProperty('public') && error['public']) {
      status = 400;
    } else if (config.environment !== 'development' ) {
      name = 'Error';
      message = 'Internal server error';
    } else {
      message = error.message.slice(0, 100);
      console.log(message);
    }

    res.status(status).json({name, message});
  });
};
