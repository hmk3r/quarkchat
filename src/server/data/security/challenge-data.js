module.exports = function(models, params) {
  const {
    Challenge,
  } = models;

  /**
   *
   *
   * @param {string} username
   * @param {string} value
   * @param {Number} expires
   * @return {ChallengeModel}
   */
  async function createChallenge(username, value, expires) {
    return Challenge.create({
      username,
      value,
      expires,
    });
  }

  /**
   *
   *
   * @param {string} username
   * @param {string} value
   * @return {ChallengeModel}
   */
  async function getChallenge(username, value) {
    return Challenge.findOne({username, value});
  }

  /**
   *
   *
   * @param {string} username
   * @param {string} value
   * @return {MongooseDeletedObject}
   */
  async function deleteChallengeByUsernameAndValue(username, value) {
    return Challenge.deleteOne({username, value});
  }

  /**
   *
   *
   * @param {ChallengeModel} challenge
   * @return {MongooseDeletedObject}
   */
  async function deleteChallenge(challenge) {
    return Challenge.deleteOne({_id: challenge._id});
  }

  /**
   *
   *
   * @param {Number} timestamp
   */
  async function removeChallengesOlderThan(timestamp) {
    return Challenge.deleteMany({expires: {$lt: timestamp}});
  }

  return {
    createChallenge,
    getChallenge,
    deleteChallengeByUsernameAndValue,
    deleteChallenge,
    removeChallengesOlderThan,
  };
};
