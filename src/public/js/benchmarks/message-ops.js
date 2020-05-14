async function generateAlice() {
  const signatureKeypair = await cryptoHelper.generateSignatureKeys();

  return {
    username: 'alice',
    privateKey: signatureKeypair.privateKey,
    publicKey: cryptoHelper.uint8ArrayToBase64(signatureKeypair.publicKey),
  }
}

async function generateBob() {
  const signatureKeypair = await cryptoHelper.generateSignatureKeys();
  const pkKeypair = await cryptoHelper.generateDHKeys();

  const spkEnvelope = await cryptoHelper.signInEnvelope(pkKeypair.publicKey, signatureKeypair.privateKey);

  const dhKeyPair = await cryptoHelper.generateDHKeys();
  const otpkEnvelope = await cryptoHelper.signInEnvelope(dhKeyPair.publicKey, signatureKeypair.privateKey);

  return {
    username: 'bob',
    privateKey: signatureKeypair.privateKey,
    publicKey: cryptoHelper.uint8ArrayToBase64(signatureKeypair.publicKey),
    spk: {
      id: '0',
      envelope: cryptoHelper.uint8ArrayToBase64(spkEnvelope),
      keypair: pkKeypair,
    },
    otpk: {
      id: '0',
      envelope: cryptoHelper.uint8ArrayToBase64(otpkEnvelope),
      privateKey: dhKeyPair.privateKey,
    },
  }
}

async function postJsonAuthenticated(url, data, username, privateKey) {
  if (!data) {
    data = {};
  }

  challenge = cryptoHelper.uint8ArrayToBase64(new Uint8Array(32));

  data.username = username;
  data.challenge = challenge;

  const message = JSON.stringify(data);
  const signature = await cryptoHelper.sign(
    cryptoHelper.base64ToUint8Array(btoa(message)),
    privateKey
  )

  if (url === '/messaging/key-bundle') {
    if (data.forUsername === 'bob') {
      return {
        username: 'bob',
        publicKey: window.bobAcc.publicKey,
        spk: {
          id: window.bobAcc.spk.id,
          envelope: window.bobAcc.spk.envelope
        },
        otpk: {
          id: window.bobAcc.otpk.id,
          envelope: window.bobAcc.otpk.envelope
        },
      }
    } else if (data.forUsername === 'alice') {
      return {
        username: 'alice',
        publicKey: window.aliceAcc.publicKey
      }
    }
  } else {
    return {
      signature: cryptoHelper.uint8ArrayToBase64(signature),
      message
    };
  }
}

function displayTimes(times) {
  for(const time in times) {
    if (!times.hasOwnProperty(time)) continue;
    const element = $(`#${time}`)
    element.find('.results').text(times[time].join('ms, '));
    element.find('.average').text(average(times[time]))
    element.find('.std').text(standardDiv(times[time]))
  }
}

async function benchmarkMessaging() {
  const initialMessagesEncryptTimes = [];
  const initialMessagesDecryptTimes = [];
  const regularMessagesEncryptTimes = [];
  const regularMessageTickDecryptTimes = [];
  const regularMessageNoTickDecryptTimes = [];
  const skipMessagesNoTickDecryptTimes = [];
  const outOfOrderMessageDecryptTimes = [];

  const runs = parseInt($('#runsMessaging').val());
  const messageSize = parseInt($('#messageSize').val());

  const alice = await generateAlice();
  const bob = await generateBob();
  window.aliceAcc = alice;
  window.bobAcc = bob;

  const messageBody = {
    text: 'a'.repeat(messageSize),
    date: new Date()
  }

  const messageBodyJson = JSON.stringify(messageBody);
  let aliceState;
  let bobState;

  let additionalData;

  let aliceInitialMessage;

  for (let i = 0; i < runs; i++) {
    // sending initial message: Alice contacts bob, ignoring network conditions
    const start = performance.now();
    const bobPreKeyBundle = await postJsonAuthenticated('/messaging/key-bundle', { forUsername: 'bob' }, 'alice', alice.privateKey);
    const publicKey = cryptoHelper.base64ToUint8Array(bobPreKeyBundle.publicKey)
    let spk, otpk, ephemeralSendPreKeyPair, ephemeralReceivePreKeyPair;
    try {
      [
        spk,
        otpk,
        ephemeralSendPreKeyPair,
        ephemeralReceivePreKeyPair,
      ] = await Promise.all([
        cryptoHelper.openSignedEnvelope(
          cryptoHelper.base64ToUint8Array(bobPreKeyBundle.spk.envelope),
          publicKey
        ),
        cryptoHelper.openSignedEnvelope(
          cryptoHelper.base64ToUint8Array(bobPreKeyBundle.otpk.envelope),
          publicKey
        ),
        cryptoHelper.generateDHKeys(),
        cryptoHelper.generateDHKeys()
      ])
    } catch (e) {
      throw new Error('Pre-keys are not authentic');
    }

    const [
      dh1,
      dh2
    ] = await Promise.all([
      cryptoHelper.deriveDHSecret(ephemeralSendPreKeyPair.privateKey, otpk),
      cryptoHelper.deriveDHSecret(ephemeralReceivePreKeyPair.privateKey, spk)
    ])

    const sharedKey = await cryptoHelper.deriveBytesHKDF(
      cryptoHelper.concatUint8Arrays(dh1, dh2),
      new Uint8Array(cryptoHelper.HKDF_SHA_512.hashOutputLengthBytes),
      constants.APPLICATION_NAME
    )

    aliceState = await ratcheting.ratchetSetupInitiator(
      'alice',
      'bob',
      sharedKey,
      spk,
      {
        ephemeralSendPreKey: cryptoHelper.uint8ArrayToBase64(ephemeralSendPreKeyPair.publicKey),
        ephemeralReceivePreKey: cryptoHelper.uint8ArrayToBase64(ephemeralReceivePreKeyPair.publicKey),
        keyBundleIds: {
          spk: bobPreKeyBundle.spk.id,
          otpk: bobPreKeyBundle.otpk.id
        }
      }
    )

    additionalData = `alice:${alice.publicKey}:${bobPreKeyBundle.publicKey}:${bobPreKeyBundle.username}`
    const encryptionResultAliceInitial = await ratcheting.ratchetEncrypt(aliceState, messageBodyJson, additionalData)
    encryptionResultAliceInitial.initialisationParams = aliceState.initialisationParams;

    encryptionResultAliceInitial.forUsername = bobPreKeyBundle.username;
    aliceInitialMessage = await postJsonAuthenticated('/messaging/send-message', encryptionResultAliceInitial, 'alice', alice.privateKey)
    initialMessagesEncryptTimes.push(performance.now() - start);
  }
  // end initial message

  // receive first message
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    const isSignatureValid = await cryptoHelper.verifySignature(
      cryptoHelper.base64ToUint8Array(aliceInitialMessage.signature),
      cryptoHelper.base64ToUint8Array(btoa(aliceInitialMessage.message)),
      cryptoHelper.base64ToUint8Array(alice.publicKey)
    )
  
    if (!isSignatureValid) {
      throw new Error('Message source not authentic');
    }
  
    const messageParsed = JSON.parse(aliceInitialMessage.message);
  
    const {
      keyBundleIds,
      ephemeralSendPreKey: ephemeralSendPreKeyBase64,
      ephemeralReceivePreKey: ephemeralReceivePreKeyBase64
    } = messageParsed.initialisationParams
  
    const ephemeralSendPreKey = cryptoHelper.base64ToUint8Array(ephemeralSendPreKeyBase64);
    const ephemeralReceivePreKey = cryptoHelper.base64ToUint8Array(ephemeralReceivePreKeyBase64);
    const otpkPrivateKey = bob.otpk.privateKey;
    const spKeypair = bob.spk.keypair;
  
    const [
      dh1,
      dh2
    ] = await Promise.all([
      cryptoHelper.deriveDHSecret(otpkPrivateKey, ephemeralSendPreKey),
      cryptoHelper.deriveDHSecret(spKeypair.privateKey, ephemeralReceivePreKey)
    ])
  
    const sharedKey = await cryptoHelper.deriveBytesHKDF(
      cryptoHelper.concatUint8Arrays(dh1, dh2),
      new Uint8Array(cryptoHelper.HKDF_SHA_512.hashOutputLengthBytes),
      constants.APPLICATION_NAME
    )
  
    bobState = await ratcheting.ratchetSetupRecipient(
      'bob',
      'alice',
      sharedKey,
      spKeypair
    )
  
  
    const messageDecrypted = await ratcheting.ratchetDecrypt(
      bobState,
      messageParsed,
      additionalData
    )
    const messageObject = JSON.parse(cryptoHelper.UTF8_DECODER.decode(messageDecrypted));
    initialMessagesDecryptTimes.push(performance.now() - start)
  }
  // end receive first message

  let bobStateTmpRegular;
  // encrypt regular message
  for (let i = 0; i < runs; i++) {
    bobStateTmpRegular = $.extend(true, {}, bobState)
    const start = performance.now();

    const encryptionResultBobRegular = await ratcheting.ratchetEncrypt(bobStateTmpRegular, messageBodyJson, additionalData)
    encryptionResultBobRegular.forUsername = 'alice';
    bobRegularMessage = await postJsonAuthenticated('/messaging/send-message', encryptionResultBobRegular, 'bob', bob.privateKey)
    regularMessagesEncryptTimes.push(performance.now() - start)
  }
  bobState = bobStateTmpRegular;
  // end regular message

  // decrypt message tick
  let aliceStateTmpTick;
  for (let i = 0; i < runs; i++) {
    aliceStateTmpTick = $.extend(true, {}, aliceState);
    const start = performance.now();

    const isSignatureValid = await cryptoHelper.verifySignature(
      cryptoHelper.base64ToUint8Array(bobRegularMessage.signature),
      cryptoHelper.base64ToUint8Array(btoa(bobRegularMessage.message)),
      cryptoHelper.base64ToUint8Array(bob.publicKey)
    )

    if (!isSignatureValid) throw new Error('Signature not valid')

    const messageParsed = JSON.parse(bobRegularMessage.message);
    const messageDecrypted = await ratcheting.ratchetDecrypt(
      aliceStateTmpTick,
      messageParsed,
      additionalData
    )
    const messageObject = JSON.parse(cryptoHelper.UTF8_DECODER.decode(messageDecrypted));
    regularMessageTickDecryptTimes.push(performance.now() - start);
  }
  aliceState = aliceStateTmpTick;
  // end decrypt message tick

  // prep messages
  const prepMessages = [];
  for (let i = 0; i < 2; i++) {
    const encryptionResult= await ratcheting.ratchetEncrypt(bobState, messageBodyJson, additionalData)
    encryptionResult.forUsername = 'alice';
    const m = await postJsonAuthenticated('/messaging/send-message', encryptionResult, 'bob', bob.privateKey)
    prepMessages.push(m);
  }
  const [
    firstMessage,
    secondMessage
  ] = prepMessages;

  // end prep messages

  // decrypt message no-tick in order
  for (let i = 0; i < runs; i++) {
    let aliceStateTmpNoTickInOrder = $.extend(true, {}, aliceState);
    const start = performance.now();

    const isSignatureValid = await cryptoHelper.verifySignature(
      cryptoHelper.base64ToUint8Array(firstMessage.signature),
      cryptoHelper.base64ToUint8Array(btoa(firstMessage.message)),
      cryptoHelper.base64ToUint8Array(bob.publicKey)
    )

    if (!isSignatureValid) throw new Error('Signature not valid')

    const messageParsed = JSON.parse(firstMessage.message);
    const messageDecrypted = await ratcheting.ratchetDecrypt(
      aliceStateTmpNoTickInOrder,
      messageParsed,
      additionalData
    )
    const messageObject = JSON.parse(cryptoHelper.UTF8_DECODER.decode(messageDecrypted));
    regularMessageNoTickDecryptTimes.push(performance.now() - start);
  }
  // end decrypt message no-tick in order

  let aliceStateTmpNoTickSkip1;
  // decrypt message no-tick skip 1
  for (let i = 0; i < runs; i++) {
    aliceStateTmpNoTickSkip1 = $.extend(true, {}, aliceState);
    const start = performance.now();

    const isSignatureValid = await cryptoHelper.verifySignature(
      cryptoHelper.base64ToUint8Array(secondMessage.signature),
      cryptoHelper.base64ToUint8Array(btoa(secondMessage.message)),
      cryptoHelper.base64ToUint8Array(bob.publicKey)
    )

    if (!isSignatureValid) throw new Error('Signature not valid')

    const messageParsed = JSON.parse(secondMessage.message);
    const messageDecrypted = await ratcheting.ratchetDecrypt(
      aliceStateTmpNoTickSkip1,
      messageParsed,
      additionalData
    )
    const messageObject = JSON.parse(cryptoHelper.UTF8_DECODER.decode(messageDecrypted));
    skipMessagesNoTickDecryptTimes.push(performance.now() - start);
  }
  aliceState = aliceStateTmpNoTickSkip1;
  // end decrypt message no-tick skip 1

  
  // decrypt message out of order
  for (let i = 0; i < runs; i++) {
    let aliceStateTmpNoTickOutOfOrder= $.extend(true, {}, aliceState);
    const start = performance.now();

    const isSignatureValid = await cryptoHelper.verifySignature(
      cryptoHelper.base64ToUint8Array(firstMessage.signature),
      cryptoHelper.base64ToUint8Array(btoa(firstMessage.message)),
      cryptoHelper.base64ToUint8Array(bob.publicKey)
    )

    if (!isSignatureValid) throw new Error('Signature not valid')

    const messageParsed = JSON.parse(firstMessage.message);
    const messageDecrypted = await ratcheting.ratchetDecrypt(
      aliceStateTmpNoTickOutOfOrder,
      messageParsed,
      additionalData
    )
    const messageObject = JSON.parse(cryptoHelper.UTF8_DECODER.decode(messageDecrypted));
    outOfOrderMessageDecryptTimes.push(performance.now() - start);
  }
  // end decrypt message out of order
  const times = {
    initialMessagesEncryptTimes,
    initialMessagesDecryptTimes,
    regularMessagesEncryptTimes,
    regularMessageTickDecryptTimes,
    regularMessageNoTickDecryptTimes,
    skipMessagesNoTickDecryptTimes,
    outOfOrderMessageDecryptTimes,
  }
  displayTimes(times);

  const downloadButton = $('#messagingResultsDownload');
  downloadButton.prop('href', URL.createObjectURL(new Blob([JSON.stringify(times)], {type : 'application/json'})))
  downloadButton.prop('download', `messageBenchmark-${runs}-${messageSize}-${navigator.userAgent.replace(/[/\\?%*:|"<>]/g, '-')}.json`)
  downloadButton.removeClass('disabled');
  downloadButton[0].click();
}

$('#runBenchmarkMessaging').on('click', function() {
  $(this).prop('disabled', true);
  benchmarkMessaging().then(() => {
    $(this).prop('disabled', false)
  })
})
