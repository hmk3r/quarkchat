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
      usernameSignature,
      publicKey,
      spk,
      otpks,
    } = req.body;

    const invalidUsernameError = new Error('Invalid username');
    invalidUsernameError.public = true;

    if (
      !validator.validateString(username, 3, 30) ||
      !validator.validateStringAlphaNum()
    ) {
      return next(invalidUsernameError);
    }

    // Prevent a replay attack in which the keys are replayed
    // but with a different username
    try {
      const usernameSignatureValid = await cryptoUtils.isSignatureValid(
          usernameSignature,
          cryptoUtils.base64Encode(username),
          publicKey,
      );

      if (!usernameSignatureValid) {
        const error = new Error('Invalid username signature');
        error.public = true;
        throw error;
      }
    } catch (e) {
      if (e.public) {
        return next(e);
      }
      return next(invalidUsernameError);
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

    try {
      await data.createUser(username, publicKey, spk, otpks);
    } catch (e) {
      return next(e);
    }

    return res.status(200).json({});
  }

  return {
    isUsernameFree,
    registerUser,
  };
};
