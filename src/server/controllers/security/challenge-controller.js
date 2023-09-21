module.exports = function(params) {
  const {
    data,
    config,
    dateUtils,
    cryptoUtils,
  } = params;

  /**
   * Gets the server time as milliseconds since epoch time
   *
   * @param {Express.Request} req
   * @param {Express.Response} res
   * @param {Express.next} next
   */
  async function serveTimestamp(req, res, next) {
    const timestamp = dateUtils.getMsTimestamp();
    return res.json({
      timestamp: cryptoUtils.base64Encode(timestamp.toString()),
    });
  }

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
      timestamp,
      signature,
    } = req.body;

    const timestampAsNumber = parseInt(cryptoUtils.base64Decode(timestamp));
    const now = dateUtils.getMsTimestamp();

    if (now - timestampAsNumber > config.timestampTimeout) {
      const error = new Error('Invalid timestamp!');
      error.public = true;
      return next(error);
    }

    const user = await data.getUserByUsername(username);

    try {
      await cryptoUtils.isSignatureValid(
          signature,
          timestamp,
          user.public_key,
      );
    } catch (e) {
      const error = new Error('Invalid timestamp signature!');
      error.public = true;
      return next(error);
    }

    const challenge = cryptoUtils.randomString();
    user.challenges.set(challenge, null);
    await data.updateUser(user);
    return res.json({challenge});
  }

  return {
    serveTimestamp,
    serveChallenge,
  };
};
