
const MAX_SKIP = 150;

function _constructHeader(dhKey, previousChainLength, messageNumber) {
  return `${cryptoHelper.uint8ArrayToBase64(dhKey)}:${previousChainLength}:${messageNumber}`
}

function _parseHeader(headerString) {
  const [
    dhKeyBase64,
    previousChainLengthString,
    messageNumberString
  ] = headerString.split(':');
  return {
    dhKey: cryptoHelper.base64ToUint8Array(dhKeyBase64),
    previousChainLength: parseInt(previousChainLengthString),
    messageNumber: parseInt(messageNumberString)
  }
}

async function _tickDHRatchet(state, header) {
  state.received = true;
  state.previousChainLength = state.messageNumberSend;
  state.messageNumberSend = 0;
  state.messageNumberReceive = 0;
  state.dhReceive = header.dhKey;

  const dhSecretReceive = await cryptoHelper.deriveDHSecret(state.dhSendPrivateKey, state.dhReceive)
  const derivedBytesReceive = await cryptoHelper.deriveBytesHKDF(
    dhSecretReceive,
    state.rootKey,
    `tickDHRatchet:${state.initiator}:${state.recipient}`
  )
  
  state.rootKey = derivedBytesReceive.slice(0, 32);
  state.chainKeyReceive = derivedBytesReceive.slice(32, 64);
  const dhSendKeypair = await cryptoHelper.generateDHKeys();
  state.dhSendPrivateKey = dhSendKeypair.privateKey;
  state.dhSendPublicKey = dhSendKeypair.publicKey;
  const dhSecretSend = await cryptoHelper.deriveDHSecret(state.dhSendPrivateKey, state.dhReceive)
  const derivedBytesSend = await cryptoHelper.deriveBytesHKDF(
    dhSecretSend,
    state.rootKey,
    `tickDHRatchet:${state.initiator}:${state.recipient}`
  )

  state.rootKey = derivedBytesSend.slice(0, 32);
  state.chainKeySend = derivedBytesSend.slice(32, 64);
}

async function _skipMessageKeys(state, until, dhReceiveHash) {
  if (state.messageNumberReceive + MAX_SKIP < until) {
    throw new Error('Exceeded message skip limit')
  }

  if (!state.chainKeyReceive) return;

  while (state.messageNumberReceive < until) {
    const messageKey = await cryptoHelper.hmacSign(
      state.chainKeyReceive,
      new Uint8Array([0x01])
    )

    const nextChainKeyReceive = await cryptoHelper.hmacSign(
      state.chainKeyReceive,
      new Uint8Array([0x02])
    )

    state.chainKeyReceive = nextChainKeyReceive;

    state.skippedMessageKeys[`${dhReceiveHash}:${state.messageNumberReceive}`] = messageKey;

    state.messageNumberReceive++;
  }
}

async function ratchetSetupInitiator(ownUsername, remoteUsername, sharedKey, dhReceive, initialisationParams) {
  const dhSendKeyPair = await cryptoHelper.generateDHKeys();
  const dhInit = await cryptoHelper.deriveDHSecret(dhSendKeyPair.privateKey, dhReceive)
  const derivedBytes = await cryptoHelper.deriveBytesHKDF(
    dhInit,
    sharedKey,
    `tickDHRatchet:${ownUsername}:${remoteUsername}`
  )
  const rootKey = derivedBytes.slice(0, 32);
  const chainKeySend = derivedBytes.slice(32, 64);
  const chainKeyReceive = null;
  const messageNumberSend = 0;
  const messageNumberReceive = 0;
  const previousChainLength = 0;

  return {
    initiator: ownUsername,
    recipient: remoteUsername,
    dhSendPrivateKey: dhSendKeyPair.privateKey,
    dhSendPublicKey: dhSendKeyPair.publicKey,
    dhReceive,
    rootKey,
    chainKeySend,
    chainKeyReceive,
    messageNumberSend,
    messageNumberReceive,
    previousChainLength,
    skippedMessageKeys: {},
    initialisationParams,
    received: false,
  }
}

async function ratchetSetupRecipient(ownUsername, remoteUsername, sharedKey, dhSendKeyPair) {
  return {
    initiator: remoteUsername,
    recipient: ownUsername,
    dhSendPrivateKey: dhSendKeyPair.privateKey,
    dhSendPublicKey: dhSendKeyPair.publicKey,
    dhReceive: null,
    rootKey: sharedKey,
    chainKeySend: null,
    chainKeyReceive: null,
    messageNumberSend: 0,
    messageNumberReceive: 0,
    previousChainLength: 0,
    skippedMessageKeys: {},
    initialisationParams: {},
    received: true,
  }
}

async function ratchetEncrypt(state, plaintext, additionalData) {
  const messageKey = await cryptoHelper.hmacSign(
    state.chainKeySend,
    new Uint8Array([0x01])
  )

  const nextChainKeySend = await cryptoHelper.hmacSign(
    state.chainKeySend,
    new Uint8Array([0x02])
  )

  const header = _constructHeader(
    state.dhSendPublicKey,
    state.previousChainLength,
    state.messageNumberSend
  )

  state.chainKeySend = nextChainKeySend;
  state.messageNumberSend += 1;

  const ciphertext = await cryptoHelper.encryptAES_CBC_HMAC_SHA512(
    messageKey,
    plaintext,
    `encryption:${state.initiator}:${state.recipient}`,
    additionalData + header
  )

  return {
    header,
    ciphertext: cryptoHelper.bufToBase64(ciphertext)
  }
}

async function ratchetDecrypt(state, headerAndCiphertext, additionalData) {
  const {
    header: headerString,
    ciphertext: ciphertextBase64
  } = headerAndCiphertext;

  const header = _parseHeader(headerString);

  const dhReceiveHashHeader = await cryptoHelper.sha512(header.dhKey);
  const dhReceiveHashState = state.dhReceive ? await cryptoHelper.sha512(state.dhReceive) : null;
  let messageKey;

  const receivedMessageStateHash = `${dhReceiveHashHeader}:${header.messageNumber}`
  if (state.skippedMessageKeys.hasOwnProperty(receivedMessageStateHash)) {
    messageKey = state.skippedMessageKeys[receivedMessageStateHash]
    delete state.skippedMessageKeys[receivedMessageStateHash]
  } else {
    if (!dhReceiveHashState) {
      await _tickDHRatchet(state, header);
    } else if (dhReceiveHashHeader !== dhReceiveHashState) {
      await _skipMessageKeys(state, header.previousChainLength, dhReceiveHashState);
      await _tickDHRatchet(state, header);
    }
    await _skipMessageKeys(state, header.messageNumber, dhReceiveHashHeader);
    messageKey = await cryptoHelper.hmacSign(
      state.chainKeyReceive,
      new Uint8Array([0x01])
    )

    const nextChainKeyReceive = await cryptoHelper.hmacSign(
      state.chainKeyReceive,
      new Uint8Array([0x02])
    )

    state.chainKeyReceive = nextChainKeyReceive;
    state.messageNumberReceive++;
  }

  return cryptoHelper.decryptAES_CBC_HMAC_SHA512(
    messageKey,
    cryptoHelper.base64ToBuf(ciphertextBase64),
    `encryption:${state.initiator}:${state.recipient}`,
    additionalData + headerString
  );
}

const ratcheting = {
  ratchetEncrypt,
  ratchetSetupInitiator,
  ratchetSetupRecipient,
  ratchetDecrypt
}
