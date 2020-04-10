const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const path = require('path');

/**
 *
 *
 * @export
 * @param {Object} params
 * @return {express.Application}
 */
module.exports = function(params) {
  const app = express();
  app.set('view engine', 'pug');
  app.set('views', path.join(__dirname, '/../../views'));
  app.use('/static', express.static('./src/public'));
  app.use(cookieParser());
  app.use(bodyParser.urlencoded({extended: true}));
  app.use(bodyParser.json());
  app.use(session({
    secret: 'PQChat',
    saveUninitialized: true,
    resave: false,
  })); // change for production

  return app;
};
