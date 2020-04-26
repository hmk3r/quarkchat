module.exports = function(params) {
  const {
    data,
    config,
    dateUtils,
    cryptoUtils,
  } = params;

  /**
   * Assigns a challenge to a user.
   * Username and signed timestamp must be present in the request body
   *
   * @param {Express.Request} req
   * @param {Express.Response} res
   * @param {Express.next} next
   */
  async function serveChallenge(req, res, next) {
    const {
      username,
    } = req.body;

    try {
      const challenge = await cryptoUtils.randomString();
      const dbChallenge = await data.createChallenge(
          username,
          challenge,
          dateUtils.getMsTimestamp(),
      );

      return res.json({challenge: dbChallenge.value});
    } catch (e) {
      return next(e);
    }
  }

  /**
   * Serves as a guard, verifying that all requests have a signed challenge,
   * and the challenge is not old
   * The format of all request guarded by this should be
   * {
   *  signature: Base64 String,
   *  message: JSON String with properties(these are mandatory and any other
   *           are allowed)
   *    {
   *      username: String,
   *      challenge: String
   *    }
   * }
   *
   * @param {Express.Request} req
   * @param {Express.Response} res
   * @param {Express.next} next
   */
  async function validateChallengedRequest(req, res, next) {
    const {
      signature,
      message,
    } = req.body;
    const now = dateUtils.getMsTimestamp();

    try {
      const messageParsed = JSON.parse(message);
      const {
        username,
        challenge,
      } = messageParsed;

      if (!username || !challenge) {
        const error = new Error('Username and/or challenge were not provided');
        error.public = true;
        return next(error);
      }

      const dbChallenge = await data.getChallenge(username, challenge);
      if (dbChallenge.expires + config.challengeTimeout < now) {
        await data.deleteChallenge(dbChallenge);
        const error = new Error('Expired challenge');
        error.public = true;
        return next(error);
      }

      const user = await data.getUserByUsername(username);
      const isSignatureValid = await cryptoUtils.isSignatureValid(
          signature,
          cryptoUtils.base64Encode(message),
          user.public_key,
      );

      if (!isSignatureValid) {
        const error = new Error('Invalid signature');
        error.public = true;
        return next(error);
      }

      await data.deleteChallenge(dbChallenge);
      req.body.messageParsed = messageParsed;
      next();
    } catch (e) {
      return next(e);
    }
  }

  return {
    serveChallenge,
    validateChallengedRequest,
  };
};
