const mongoose = require('mongoose');
const MongooseSchema = mongoose.Schema;
const fileWalker = require('../utils/file-system-utils').walkDirectorySync;
const models = require('../models')();

/**
 *
 *
 * @export
 * @param {string} connectionString connection string for DB
 * @param {Object} params
 * @return {DataLayerModule}
 */
module.exports = function(connectionString, params) {
  mongoose.Promise = global.Promise;
  mongoose.connect(connectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true,
  });

  const mongooseModels = {};

  for (const modelName in models) {
    // skip over prototype properties
    if (!models.hasOwnProperty(modelName)) continue;

    const schema = new MongooseSchema(models[modelName], {
      timestamps: true,
    });

    mongooseModels[modelName] = mongoose.model(modelName, schema);
  }

  const data = {};

  fileWalker(__dirname, (module) => {
    let dataModule = {};
    if (module.includes('-data')) {
      dataModule = require(module)(mongooseModels, validator);
    }
    Object.keys(dataModule)
        .forEach((key) => {
          data[key] = dataModule[key];
        });
  });

  return data;
};
