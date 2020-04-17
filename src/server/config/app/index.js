const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const favicon = require('serve-favicon');
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
  app.use(express.static('./src/public'));
  app.use('/libs', express.static('./libs'));
  app.use(favicon(path.join(__dirname, '../../../public/images/favicon.ico')));
  app.use(cookieParser());
  app.use(bodyParser.urlencoded({extended: true}));
  app.use(bodyParser.json());
  app.use(session({
    secret: 'PQChat',
    saveUninitialized: true,
    resave: true,
    cookie: {
      httpOnly: true,
      // maxAge: 2 * 60 * 1000, // 2 minutes
    },
  })); // change secret for production

  return app;
};
