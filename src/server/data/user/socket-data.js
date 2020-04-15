const usernameSocketIdMap = new Map();


module.exports = function(models, params) {
  /**
   *
   *
   * @param {string} username
   * @param {string} socketId
   */
  async function assignSocketIdToUsername(username, socketId) {
    usernameSocketIdMap.set(username, socketId);
  }

  /**
   *
   *
   * @param {string} username
   */
  async function getSocketIdForUsername(username) {
    return usernameSocketIdMap.get(username);
  }

  return {
    assignSocketIdToUsername,
    getSocketIdForUsername,
  };
};
