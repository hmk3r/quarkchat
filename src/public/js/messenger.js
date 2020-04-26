// const stateSaver = ((function() {
//   const DH_SEND_PRIVATE_KEY_DB_FIELD = 'DHsPr';
//   const DH_SEND_PUBLIC_KEY_DB_FIELD = 'DHsPb';
//   const DH_RECEIVE_KEY_DB_FIELD = 'DHr';
//   const ROOT_KEY_DB_FIELD = 'RK';
//   const CHAIN_KEY_SEND_DB_FIELD = 'CKs';
//   const CHAIN_KEY_RECEIVE_DB_FIELD = 'CKr';

//   async function getState(username) {
//     username = username.toLowerCase();

//     const stateRaw = await stateStorage.getItem(username);
//     if(!state) return;
//     const [
//       dhSendPrivateKey,
//       dhSendPublicKey,
//       dhReceive,
//       rootKey,
//       chainKeySend,
//       chainKeyReceive
//     ] = await Promise.all([
//       stateKeyStorage.getItem(`${username}:${DH_SEND_PRIVATE_KEY_DB_FIELD}`),
//       stateKeyStorage.getItem(`${username}:${DH_SEND_PUBLIC_KEY_DB_FIELD}`),
//       stateKeyStorage.getItem(`${username}:${DH_RECEIVE_KEY_DB_FIELD}`),
//       stateKeyStorage.getItem(`${username}:${ROOT_KEY_DB_FIELD}`),
//       stateKeyStorage.getItem(`${username}:${CHAIN_KEY_SEND_DB_FIELD}`),
//       stateKeyStorage.getItem(`${username}:${CHAIN_KEY_RECEIVE_DB_FIELD}`)
//     ]);

//     const skippedMessageKeys = {}
//     return {
//       initiator: ownUsername,
//       recipient: remoteUsername,
//       dhSendPrivateKey,
//       dhSendPublicKey,
//       dhReceive,
//       rootKey,
//       chainKeySend,
//       chainKeyReceive,
//       messageNumberSend,
//       messageNumberReceive,
//       previousChainLength,
//       skippedMessageKeys,
//     }
//   }

//   async function saveState(username, state) {
//     username = username.toLowerCase();

//     return {
//       initiator: ownUsername,
//       recipient: remoteUsername,
//       dhSendPrivateKey: dhSendKeyPair.privateKey,
//       dhSendPublicKey: dhSendKeyPair.publicKey,
//       dhReceive,
//       rootKey,
//       chainKeySend,
//       chainKeyReceive,
//       messageNumberSend,
//       messageNumberReceive,
//       previousChainLength,
//       skippedMessageKeys: {}
//     }
//   }

//   return {
//     saveState,
//     getState,
//   }
// }
// )());

async function getDmProcessor() {
  const storageConcurrencyPromises = {};
  const publicKeys = {};
  const additionalData = {};

  const CONVERSATION_STARTED_BY_OTHER_PARTY = 'ConversationStartedByOtherRecipient';

  await Promise.all([
    contactsPublicKeysStorage.iterate((v, k) => { publicKeys[k] = v }),
    contactsADStorage.iterate((v, k) => { additionalData[k] = v })
  ]);

  async function getState(username, receivedMessage) {
    if (publicKeys.hasOwnProperty(username) && additionalData.hasOwnProperty(username)) {
      return stateStorage.getItem(username);
    }

    const response = await postJsonAuthenticated('/messaging/key-bundle', { forUsername: username })
    const publicKey = cryptoHelper.base64ToUint8Array(response.publicKey)
    if ((!response.spk || !response.otpk) && receivedMessage) {
      const ownUsername = await accountStorage.getItem(constants.USERNAME_DB_FIELD);
      const ownPublicKey = await accountStorage.getItem(constants.PUBLIC_KEY_DB_FIELD)

      const isSignatureValid = await cryptoHelper.verifySignature(
        cryptoHelper.base64ToUint8Array(receivedMessage.signature),
        receivedMessage.content,
        publicKey
      )

      if (!isSignatureValid) {
        throw new Error('Message source not authentic');
      }

      const {
        keyBundleIds,
        ephemeralSendPreKey: ephemeralSendPreKeyBase64,
        ephemeralReceivePreKey: ephemeralReceivePreKeyBase64
      } = JSON.parse(receivedMessage.content)

      const ephemeralSendPreKey = cryptoHelper.base64ToUint8Array(ephemeralSendPreKeyBase64);
      const ephemeralReceivePreKey = cryptoHelper.base64ToUint8Array(ephemeralReceivePreKeyBase64);
      const otpkPrivateKey = await otpkStorage.getItem(keyBundleIds.otpk.toString());
      const spKeypair = await pkStorage.getItem(keyBundleIds.spk.toString());

      const dh1 = await cryptoHelper.deriveDHSecret(otpkPrivateKey, ephemeralSendPreKey);
      const dh2 = await cryptoHelper.deriveDHSecret(spKeypair.privateKey, ephemeralReceivePreKey);

      const sharedKey = await cryptoHelper.deriveBytesHKDF(
        cryptoHelper.concatUint8Arrays(dh1, dh2),
        new Uint8Array(cryptoHelper.HKDF_SHA_512.hashOutputLengthBytes),
        constants.APPLICATION_NAME
      )

      const state = await ratcheting.ratchetSetupRecipient(
        ownUsername,
        response.username,
        sharedKey,
        spKeypair
      )

      await stateStorage.setItem(response.username, state);

      publicKeys[response.username] = publicKey;
      await contactsPublicKeysStorage.setItem(response.username, publicKey);


      const ad = `${response.username}:${response.publicKey}:${cryptoHelper.uint8ArrayToBase64(ownPublicKey)}:${ownUsername.toLowerCase()}`
      additionalData[response.username] = ad;
      await contactsADStorage.setItem(response.username, ad)
      await otpkStorage.removeItem(keyBundleIds.otpk.toString());

      return state;
    } else if (!response.spk || !response.otpk) {
      const error = new Error();
      error.name = CONVERSATION_STARTED_BY_OTHER_PARTY
      throw error;
    } else {
      let spk, otpk;

      try {
        spk = await cryptoHelper.openSignedEnvelope(
          cryptoHelper.base64ToUint8Array(response.spk.envelope),
          publicKey
        )
        otpk = await cryptoHelper.openSignedEnvelope(
          cryptoHelper.base64ToUint8Array(response.otpk.envelope),
          publicKey
        )
      } catch (e) {
        throw new Error('Pre-keys are not authentic');
      }

      const ephemeralSendPreKeyPair = await cryptoHelper.generateDHKeys();
      const ephemeralReceivePreKeyPair = await cryptoHelper.generateDHKeys();

      const dh1 = await cryptoHelper.deriveDHSecret(ephemeralSendPreKeyPair.privateKey, otpk);
      const dh2 = await cryptoHelper.deriveDHSecret(ephemeralReceivePreKeyPair.privateKey, spk);

      const sharedKey = await cryptoHelper.deriveBytesHKDF(
        cryptoHelper.concatUint8Arrays(dh1, dh2),
        new Uint8Array(cryptoHelper.HKDF_SHA_512.hashOutputLengthBytes),
        constants.APPLICATION_NAME
      )

      const state = await ratcheting.ratchetSetupInitiator(
        ownUsername,
        response.username,
        sharedKey,
        spk,
        {
          ephemeralSendPreKey: cryptoHelper.uint8ArrayToBase64(ephemeralSendPreKeyPair.publicKey),
          ephemeralReceivePreKey: cryptoHelper.uint8ArrayToBase64(ephemeralReceivePreKeyPair.publicKey),
          keyBundleIds: {
            spk: response.spk.id,
            otpk: response.otpk.id
          }
        }
      )

      await stateStorage.setItem(response.username, state);

      publicKeys[response.username] = publicKey;
      await contactsPublicKeysStorage.setItem(response.username, publicKey);

      const ad = `${ownUsername.toLowerCase()}:${cryptoHelper.uint8ArrayToBase64(ownPublicKey)}:${response.publicKey}:${response.username}`
      additionalData[response.username] = ad;
      await contactsADStorage.setItem(response.username, ad)
      return state;
    }
  }

  async function encryptMessage(username, message, attempt) {
    attempt = attempt ? attempt : 0;
    if (attempt > 10) {
      throw new Error('Message cannot be sent at this time')
    }

    try {
      const result = await _encryptMessage(username, message);
      return result;
    } catch (error) {
      if (error.name = CONVERSATION_STARTED_BY_OTHER_PARTY) {
        await timeout(15 * 1000);
        return encryptMessage(username, message, attempt + 1);
      } else {
        throw error;
      }
    }
  }

  function _encryptMessage(username, message) {
    username = username.toLowerCase();
    if (!storageConcurrencyPromises.hasOwnProperty(username)) {
      storageConcurrencyPromises[username] = Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      storageConcurrencyPromises[username] = storageConcurrencyPromises[username].then(() => {
        return getState(username)
      }).then((state) => {

        return Promise.all([
          state,
          ratcheting.ratchetEncrypt(state, message, additionalData[username]),
        ])
      }).then((result) => {
        const [
          state,
          encryptionResult
        ] = result;

        if (!state.received) {
          encryptionResult.initialisationParams = state.initialisationParams;
        }

        return Promise.all([
          stateStorage.setItem(username, state),
          encryptionResult,
        ])
      }).then((result) => {
        resolve(result[1])
        return;
      }).catch((error) => {
        reject(error);
        return;
      })
    })
  }

  function decryptMessage(receivedMessage) {
    const messageContent = JSON.parse(receivedMessage.content);
    username = messageContent.username.toLowerCase();
    if (!storageConcurrencyPromises.hasOwnProperty(username)) {
      storageConcurrencyPromises[username] = Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      storageConcurrencyPromises[username] = storageConcurrencyPromises[username].then(() => {
        return getState(username, receivedMessage)
      }).then((state) => {
        // TODO: extract signature checking before concurrency control, so that messages from the same user can be verified in parallel
        return Promise.all([
          state,
          cryptoHelper.verifySignature(
            cryptoHelper.base64ToUint8Array(receivedMessage.signature),
            receivedMessage.content,
            publicKeys[username]
          )
        ])
      }).then((result) => {
        const [
          state,
          isSignatureValid
        ] = result;

        if (!isSignatureValid) {
          throw new Error('Invalid signature');
        }

        return Promise.all([
          state,
          ratcheting.ratchetDecrypt(
            state,
            messageContent,
            additionalData[username])
        ]).then((result) => {
          const [
            state,
            decryptionResult
          ] = result;

          return Promise.all([
            stateStorage.setItem(username, state),
            decryptionResult,
          ])
        }).then((result) => {
          resolve(result[1])
          return;
        }).catch((error) => {
          reject(error);
          return;
        })
      })
    })
  }

  return {
    encryptMessage,
    decryptMessage
  }
}

async function postJsonAuthenticated(url, data, challenge, privateKey) {
  const username = await accountStorage.getItem(constants.USERNAME_DB_FIELD);
  if (!privateKey) {
    privateKey = await accountStorage.getItem(constants.PRIVATE_KEY_DB_FIELD);
  }

  if (!challenge) {
    challenge = (await postJson('/challenge', { username })).challenge
  }

  data.username = username;
  data.challenge = challenge;

  const message = JSON.stringify(data);
  const signature = await cryptoHelper.sign(
    cryptoHelper.base64ToUint8Array(btoa(message)),
    privateKey
  )
  return postJson(url, { signature: cryptoHelper.uint8ArrayToBase64(signature), message });
}

async function searchUsername() {
  const searchBtn = $('#searchButton');
  const searchBox = $('#search');
  const username = searchBox.val().toLowerCase();
  if (searchBtn.prop('disabled') || searchBox.prop('disabled')) {
    return;
  }

  if (!searchBox[0].checkValidity() || !username) {
    searchBox[0].reportValidity()
    return;
  }
  searchBtn.prop('disabled', true);
  searchBox.prop('disabled', true);

  try {
    const result = await getJson(`/username-check/${username}`)
    if (result.isFree) {
      throw new Error()
    }
    searchBox.val('');
    app.addNewRecipient(username)
  } catch (e) {
    toastr.error(`User ${username} does not exists!`, 'User not found');
  } finally {
    searchBtn.prop('disabled', false);
    searchBox.prop('disabled', false);
  }
}

async function bootstrapMessenger() {
  // username: hasNewMessages
  let conversationsJson = localStorage.getItem('conversations')
  let conversationsOrderJson = localStorage.getItem('conversationsOrder')
  let conversations = conversationsJson ? JSON.parse(conversationsJson) : { 'Jane Doe': true, 'John Doe': false }
  let conversationsOrder = conversationsOrderJson ? JSON.parse(conversationsOrderJson) : ['Jane Doe', 'John Doe']
  let messages = {
    'Jane Doe': [
      { type: 'in', content: 'AAAAAAAAAAAAAAAAAAAAAAAAa', date: new Date().toLocaleDateTimeString() },
      { type: 'in', content: 'a?', date: new Date().toLocaleDateTimeString() },
      { type: 'in', content: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA '.repeat(50), date: new Date().toLocaleDateTimeString() },
      { type: 'in', content: 'a', date: new Date().toLocaleDateTimeString() },
      { type: 'out', content: '???????', date: new Date().toLocaleDateTimeString() },
      { type: 'in', content: '!', date: new Date().toLocaleDateTimeString() },
      { type: 'in', content: '!', date: new Date().toLocaleDateTimeString() },
      { type: 'out', content: '!', date: new Date().toLocaleDateTimeString() },
    ],
    'John Doe': [
      { type: 'in', content: 'Hello', date: new Date().toLocaleDateTimeString() },
      { type: 'in', content: 'Are you there?', date: new Date().toLocaleDateTimeString() },
      { type: 'in', content: 'ASDFASFASDSA', date: new Date().toLocaleDateTimeString() },
      { type: 'in', content: 'QWERT', date: new Date().toLocaleDateTimeString() },
      { type: 'out', content: 'Works'.repeat(21), date: new Date().toLocaleDateTimeString() },
      { type: 'in', content: 'Does it now?', date: new Date().toLocaleDateTimeString() },
    ]
  }
  const draftsJson = localStorage.getItem('drafts');
  let drafts = draftsJson ? JSON.parse(draftsJson) : {};
  let username = (await accountStorage.getItem(constants.USERNAME_DB_FIELD)).toLowerCase();
  let activeConversationRecipient = (() => {
    for (const i of conversationsOrder) if (!conversations[i]) return i;
  })();

  let app = new Vue({
    el: '#app',
    data: {
      activeConversationRecipient,
      conversations,
      conversationsOrder,
      messages,
      drafts,
      username
    },
    methods: {
      switchConversation: function (username) {
        username = username.toLowerCase();
        const messageComposer = $('#messageComposer');
        const draft = messageComposer.val();
        const draftUsername = messageComposer.attr('username');
        this.activeConversationRecipient = username;
        this.scrollToLatestMessage()
        this.$set(this.drafts, draftUsername, draft);
        this.$set(this.conversations, username, false);
      },
      scrollToLatestMessage: function () {
        this.$nextTick(function () {
          const latestMessageDom = document.getElementById('latestMessage');
          if (latestMessageDom) latestMessageDom.scrollIntoView();
        })
      },
      addNewRecipient: function (username) {
        username = username.toLowerCase()
        if (username === this.username) {
          return;
        }

        if (this.conversations.hasOwnProperty(username)) {
          this.$set(this.conversations, username, false)
          this.activeConversationRecipient = username;
          this.scrollToLatestMessage();
          return;
        }

        this.$set(this.messages, username, [])
        this.$set(this.conversations, username, false)
        this.conversationsOrder = [
          username,
          ...(this.conversationsOrder.filter((item) => item !== username))
        ];
        this.activeConversationRecipient = username;
      },
      addMessageToUser: function (username, message) {
        username = username.toLowerCase();
        if (!this.messages.hasOwnProperty(username)) {
          this.$set(this.messages, username, [message])
        } else {
          this.messages[username].push(message)
        }

        if (this.activeConversationRecipient !== username) {
          this.$set(this.conversations, username, this.activeConversationRecipient !== username)
        }

        this.conversationsOrder = [
          username,
          ...(this.conversationsOrder.filter((item) => item !== username))
        ]

        if (this.activeConversationRecipient === username) {
          this.scrollToLatestMessage();
        }
      }
    }
  })

  window.addEventListener('beforeunload', function (event) {
    // localStorage.setItem('drafts', JSON.stringify(app.drafts))
    // localStorage.setItem('conversations', JSON.stringify(app.conversations));
    // localStorage.setItem('conversationsOrder', JSON.stringify(app.conversationsOrder));
  })

  app.scrollToLatestMessage();
  const sendButton = $('#sendButton');
  const messageComposer = $('#messageComposer');
  sendButton.on('click', () => {
    const message = messageComposer.val().trim();
    if (!message) {
      return;
    }
    const forUsername = messageComposer.attr('username').toLowerCase();
    const date = new Date();
    Vue.set(app.drafts, forUsername, '');
    app.addMessageToUser(forUsername, {
      type: 'out',
      content: message,
      date: date.toLocaleDateTimeString()
    })
  })
  messageComposer.on('keypress', (event) => {
    if (!event.shiftKey && event.which == 13) {
      event.preventDefault();
      sendButton.click();
    }
  });

  messageComposer.focus();

  window.app = app;

  const socket = io();
  socket.on('socket_id', (socketId) => {
    postJsonAuthenticated('/messaging/bind-socket', { socketId }).then(() => console.log('Registered socket ID: ', socketId));
  });

  $('#search').on('keypress', (event) => {
    if (event.which == 13) {
      event.preventDefault();
      searchUsername().then();
    }
  })

  $('#searchButton').on('click', () => searchUsername().then());
  $('#app').attr('style', '');
}
