module.exports = function(params) {
  const {
    data,
    io,
    dateUtils,
    cryptoUtils,
    config,
  } = params;


  /**
   *
   *
   *
   * @param {Express.Request} req
   * @param {Express.Response} res
   * @param {Express.next} next
   */
  async function bindSocket(req, res, next) {
    const {
      username,
      socketId,
    } = req.body.messageParsed;

    try {
      await data.assignSocketIdToUsername(username, socketId);
      return res.json({});
    } catch (e) {
      return next(e);
    }
  }

  /**
   *
   *
   *
   * @param {Express.Request} req
   * @param {Express.Response} res
   * @param {Express.next} next
   */
  async function fetchKeyBundle(req, res, next) {
    const {
      username,
      forUsername,
    } = req.body.messageParsed;

    try {
      const requester = await data.getUserByUsername(username);
      const recipient = await data.getUserByUsername(forUsername);

      if (!requester || !recipient) {
        const error = new Error('Invalid sender/recipient');
        error.public = true;
        return next(error);
      }

      if (requester.contacts.includes(recipient.username) ||
        recipient.contacts.includes(requester.username)) {
        return res.json({
          username: recipient.username,
          publicKey: recipient.public_key,
        });
      }
      const otpk = await data.getOtpk(recipient.username);
      if (!otpk) {
        const error = new Error('Cannot connect to this user at this time');
        error.public = true;
        return next(error);
      }

      await data.addContactToUser(requester, recipient.username);
      await data.addContactToUser(recipient, requester.username);

      // Add check for remaining OTPKS, add message to user if < some constant
      res.json({
        username: recipient.username,
        publicKey: recipient.public_key,
        spk: recipient.spk,
        otpk: {
          id: otpk.id,
          envelope: otpk.envelope,
        },
      });
    } catch (e) {
      return next(e);
    }
  }

  /**
   *
   *
   *
   * @param {Express.Request} req
   * @param {Express.Response} res
   * @param {Express.next} next
   */
  async function getAllMessages(req, res, next) {
    const {
      username,
    } = req.body.messageParsed;
    console.log(username);
    try {
      const dms = await data.getDMs(username);
      await data.deleteMessages(dms);
      return res.json(dms || []);
    } catch (e) {
      return next(e);
    }
  }

  /**
   *
   *
   *
   * @param {Express.Request} req
   * @param {Express.Response} res
   * @param {Express.next} next
   */
  async function sendMessage(req, res, next) {
    const {
      forUsername,
    } = req.body.messageParsed;

    const {
      signature,
      message,
    } = req.body;

    try {
      await data.createDM(forUsername, signature, message);
      const recipientSocketId = data.getSocketIdForUsername(forUsername);
      const challenge = await cryptoUtils.randomString();
      await data.createChallenge(
          forUsername,
          challenge,
          dateUtils.getMsTimestamp() + config.challengeTimeout,
      );
      io.to(recipientSocketId).emit('new_message', challenge);
      return res.json({});
    } catch (e) {
      return next(e);
    }
  }


  return {
    bindSocket,
    fetchKeyBundle,
    sendMessage,
    getAllMessages,
  };
};
