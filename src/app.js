const config = require('./server/config');
const validator = require('./server/utils/validator');
const cryptoUtils = require('./server/utils/crypto-utils');
const dateUtils = require('./server/utils/date-utils');


const HttpServer = require('http').Server;

// Application bootstrap

// Data layer and express app
const data = require('./server/data')(config.connectionString, {validator});
const app = require('./server/config/app')({data});

// Socket setup
const server = new HttpServer(app);
const io = require('./server/config/socket')(server);

// Controllers and routes
const controllers = require('./server/controllers')({
  data,
  io,
  validator,
  cryptoUtils,
  dateUtils,
  config,
});
require('./server/routes')(app, controllers, {});
require('./server/config/app/post-routes-config')(app, {config});

// Start server
server.listen(config.port, () => {
  console.log(`App running on localhost:${server.address().port}`);
});
