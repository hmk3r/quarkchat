module.exports = function(params) {
  const {
    data,
    validator,
  } = params;

  /**
   *
   *
   * @param {Express.Request} req
   * @param {Express.Response} res
   * @param {Express.next} next
   */
  async function isUsernameFree(req, res, next) {
    const username = req.params.username;
    if (!validator.validateString(username, 3, 30)) {
      const error = new Error('Invalid username');
      error.public = true;
      return next(error);
    }

    const exists = await data.usernameExists(username);

    return res.json({isFree: !exists});
  }
  return {
    isUsernameFree,
  };
};
