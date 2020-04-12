const config = require('./server/config');
const validator = require('./server/utils/validator');

// Application bootstrap
const data = require('./server/data')(config.connectionString, {validator});
const app = require('./server/config/app')({data});
const controllers = require('./server/controllers')({data});
require('./server/routes')(app, controllers, {});

const server = app.listen(config.port, () => {
  console.log(`App running on localhost:${server.address().port}`);
});
