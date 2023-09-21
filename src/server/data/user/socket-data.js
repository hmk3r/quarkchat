const usernameSocketIdMap = new Map();


module.exports = function(models, params) {
  /**
   *
   *
   * @param {string} username
   * @param {string} socketId
   */
  function assignSocketIdToUsername(username, socketId) {
    usernameSocketIdMap.set(username.toLowerCase(), socketId);
  }

  /**
   *
   *
   * @param {string} username
   * @return {string}
   */
  function getSocketIdForUsername(username) {
    return usernameSocketIdMap.get(username.toLowerCase());
  }

  return {
    assignSocketIdToUsername,
    getSocketIdForUsername,
  };
};
