module.exports = function(params) {
  const {
    data,
    validator,
    cryptoUtils,
  } = params;

  /**
   * Checks handles the request of checking whether a username is free
   * Username is supplied as a path parameter
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

  /**
   * Registers a new user
   *
   * @param {Express.Request} req
   * @param {Express.Response} res
   * @param {Express.next} next
   */
  async function registerUser(req, res, next) {
    const {
      username,
      publicKey,
      spk,
      otpks,
    } = req.body;

    if (!validator.validateString(username, 3, 30)) {
      const error = new Error('Invalid username');
      error.public = true;
      return next(error);
    }

    try {
      await cryptoUtils.openSignedEnvelope(
          spk.envelope,
          publicKey,
      );
    } catch (e) {
      const error = new Error('Invalid signed pre-key signature!');
      error.public = true;
      return next(error);
    }

    let invalidOtpkId;
    try {
      for (const otpk of otpks) {
        invalidOtpkId = otpk.id;
        await cryptoUtils.openSignedEnvelope(
            otpk.envelope,
            publicKey,
        );
      };
    } catch (e) {
      const error =
        new Error(`Invalid one-time pre-key with ID ${invalidOtpkId}!`);
      error.public = true;
      return next(error);
    }

    await data.createUser(username, publicKey, spk, otpks);

    res.sendStatus(200);
  }
  return {
    isUsernameFree,
    registerUser,
  };
};
