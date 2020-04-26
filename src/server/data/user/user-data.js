module.exports = function(models, params) {
  const {
    User,
    Otpk,
  } = models;

  // const User = require('mongoose').model();

  /**
   * Checks whether a user with the username provided as parameter exists
   *
   * @param {string} username
   * @return {boolean}
   */
  async function usernameExists(username) {
    return User.exists({username: username.toLowerCase()});
  }


  /**
   * Find a user stored in the database with the username provided
   * as parameter
   *
   * @param {string} username
   * @return {UserModel}
   */
  async function getUserByUsername(username) {
    return User.findOne({username: username.toLowerCase()});
  }

  /**
   * Stores a user to the database with username, public signature key,
   * a signed pre-key and an array of one-time pre-keys, conforming to
   * the schema specified in models/user/user-model.js
   *
   * @param {string} username
   * @param {string} publicKey
   * @param {Object} spk
   * @param {Array<Object>} otpks
   * @return {UserModel}
   */
  async function createUser(username, publicKey, spk, otpks) {
    for (const otpk of otpks) {
      otpk.username = username;
    }
    await Otpk.insertMany(otpks);
    return User.create({
      username: username.toLowerCase(),
      public_key: publicKey,
      spk,
      contacts: [],
    });
  }

  /**
   *
   *
   * @param {string} username
   * @return {OtpkModel} key bundle
   */
  async function getOtpk(username) {
    return await Otpk.findOneAndDelete({username});
  }

  /**
   *
   *
   * @param {string} username
   * @param {Array<Otpk>} otpks
   * @return {MongooseInsertMany}
   */
  async function addOtpksToUser(username, otpks) {
    for (const otpk of otpks) {
      otpk.username = username;
    }
    return Otpk.insertMany(otpks);
  }

  /**
   * Updates a User stored in the database
   *
   * @param {UserModel} userModel
   * @return {void}
   */
  async function updateUser(userModel) {
    return userModel.save();
  }

  return {
    usernameExists,
    getUserByUsername,
    createUser,
    updateUser,
    getOtpk,
    addOtpksToUser,
  };
};
