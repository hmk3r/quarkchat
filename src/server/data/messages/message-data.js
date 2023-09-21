const constants = require('../../config/constants');

module.exports = function(models, params) {
  const {
    Message,
  } = models;

  /**
   *
   *
   * @param {string} forUsername
   * @param {string} signature
   * @param {Object} message
   * @return {ChallengeModel}
   */
  async function createDM(forUsername, signature, message) {
    return Message.create({
      type: constants.MESSAGE_TYPE.DIRECT_MESSAGE,
      for_username: forUsername.toLowerCase(),
      content: {
        signature,
        message,
      },
    });
  }

  /**
   *
   *
   * @param {string} username
   * @param {string} type
   * @return {Array<MessageModel>}
   */
  async function getMessages(username, type) {
    return Message.find({
      for_username: username.toLowerCase(),
      type,
    }).sort({createdAt: 1});
  }

  /**
   *
   *
   * @param {*} username
   * @return {Array<MessageModel>}
   */
  async function getDMs(username) {
    return getMessages(username, constants.MESSAGE_TYPE.DIRECT_MESSAGE);
  }

  /**
   *
   *
   * @param {Array<MessageModel>} messages
   * @return {MongooseDeletedObject}
   */
  async function deleteMessages(messages) {
    const idsToDelete = [];
    for (const m of messages) {
      idsToDelete.push(m._id);
    }
    return Message.deleteMany({_id: {$in: idsToDelete}});
  }

  /**
   *
   *
   * @param {MessageModel} message
   * @return {MongooseDeletedObject}
   */
  async function deleteMessage(message) {
    return Message.deleteOne({_id: message._id});
  }

  /**
   *
   *
   * @param {string} username
   * @param {Date} date
   * @return {MessageModel}
   */
  async function createSPKRenewalMessage(username, date) {
    return Message.updateOne(
        {for_username: username, type: constants.MESSAGE_TYPE.SPK_CHANGE},
        {content: date},
        {upsert: true},
    );
  }

  /**
   *
   *
   * @param {string} username
   * @return {MessageModel}
   */
  async function createOTPKSLowMessage(username) {
    return Message.updateOne(
        {for_username: username, type: constants.MESSAGE_TYPE.OTPKS_LOW},
        {content: {}},
        {upsert: true},
    );
  }

  /**
   *
   *
   * @param {string} username
   * @return {MongooseDeletedObject}
   */
  async function deleteOTPKSLowMessage(username) {
    return Message.findOneAndDelete({
      for_username: username,
      type: constants.MESSAGE_TYPE.OTPKS_LOW,
    });
  }


  /**
   *
   *
   * @param {string} username
   * @return {Array<MessageModel>}
   */
  async function getServiceMessages(username) {
    return getMessages(username, {
      $in: [
        constants.MESSAGE_TYPE.OTPKS_LOW,
        constants.MESSAGE_TYPE.SPK_CHANGE,
      ],
    },
    );
  }

  return {
    createDM,
    getMessages,
    deleteMessage,
    getDMs,
    createSPKRenewalMessage,
    createOTPKSLowMessage,
    deleteOTPKSLowMessage,
    getServiceMessages,
    deleteMessages,
  };
};
