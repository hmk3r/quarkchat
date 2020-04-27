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

  return {
    createDM,
    getMessages,
    deleteMessage,
    getDMs,
    // upsertMessage,
    deleteMessages,
  };
};
