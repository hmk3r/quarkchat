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

let __generating_otpks_lock = false;
let __generating_spk_lock = false;

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

    const ownUsername = await accountStorage.getItem(constants.USERNAME_DB_FIELD);
    const ownPublicKey = await accountStorage.getItem(constants.PUBLIC_KEY_DB_FIELD);

    const response = await postJsonAuthenticated('/messaging/key-bundle', { forUsername: username })
    const publicKey = cryptoHelper.base64ToUint8Array(response.publicKey)
    if ((!response.spk || !response.otpk) && receivedMessage) {
      const isSignatureValid = await cryptoHelper.verifySignature(
        cryptoHelper.base64ToUint8Array(receivedMessage.signature),
        cryptoHelper.base64ToUint8Array(btoa(receivedMessage.message)),
        publicKey
      )

      if (!isSignatureValid) {
        throw new Error('Message source not authentic');
      }

      const messageParsed = JSON.parse(receivedMessage.message);

      const {
        keyBundleIds,
        ephemeralSendPreKey: ephemeralSendPreKeyBase64,
        ephemeralReceivePreKey: ephemeralReceivePreKeyBase64
      } = messageParsed.initialisationParams

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
      if (error.name === CONVERSATION_STARTED_BY_OTHER_PARTY) {
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
          messageStorage.getItem(username)
        ])
      }).then((result) => {
        let [
          state,
          encryptionResult,
          messages
        ] = result;

        if (!messages) {
          messages = []
        }

        const messageParsed = JSON.parse(message);
        const saveMessage = {
          type: 'out',
          content: messageParsed.text,
          date: messageParsed.date instanceof Date ? messageParsed.date : new Date(messageParsed.date)
        }

        messages.push(saveMessage);

        if (!state.received) {
          encryptionResult.initialisationParams = state.initialisationParams;
        }

        encryptionResult.forUsername = username;

        return Promise.all([
          stateStorage.setItem(username, state),
          messageStorage.setItem(username, messages),
          encryptionResult,
        ]);
      }).then((result) => {
        resolve(result[2])
        return;
      }).catch((error) => {
        reject(error);
        return;
      })
    })
  }

  function decryptMessage(receivedMessage) {
    const messageContent = JSON.parse(receivedMessage.message);
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
            cryptoHelper.base64ToUint8Array(btoa(receivedMessage.message)),
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
            additionalData[username]
          ),
          messageStorage.getItem(username),
        ]).then((result) => {
          let [
            state,
            decryptionResult,
            messages,
          ] = result;

          if (!messages) {
            messages = []
          }
          const messageObject = JSON.parse(cryptoHelper.UTF8_DECODER.decode(decryptionResult));
          const message = {
            type: 'in',
            content: messageObject.text,
            date: messageObject.date instanceof Date ? messageObject.date : new Date(messageObject.date)
          }

          messages.push(message);

          return Promise.all([
            stateStorage.setItem(username, state),
            messageStorage.setItem(username, messages),
            {
              sender: username,
              content: message
            }
          ])
        }).then((result) => {
          resolve(result[2])
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


async function sendMessage(app, dmProcessor, recipient, message) {
  const messageBody = {
    text: message,
    date: new Date()
  }

  try {
    app.addMessageToUser(recipient, {
      type: 'out',
      content: messageBody.text,
      date: messageBody.date
    });

    const encryptedMessage = await dmProcessor.encryptMessage(
      recipient.toLowerCase(),
      JSON.stringify(messageBody)
    )

    await postJsonAuthenticated('/messaging/send-message', encryptedMessage)
  } catch (e) {
    throw e;
    console.error(e)
  }
}

async function postJsonAuthenticated(url, data, challenge, privateKey) {
  const username = await accountStorage.getItem(constants.USERNAME_DB_FIELD);
  if (!data) {
    data = {};
  }
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

async function submitOtpks() {
  if (__generating_otpks_lock) {
    return;
  }

  __generating_otpks_lock = true;

  try {
    const privateKey = await accountStorage.getItem(constants.PRIVATE_KEY_DB_FIELD);

    const otpks = [];
    let otpkIndex = await accountStorage.getItem(constants.OTPK_INDEX_DB_FIELD);
    for (let i = 0; i < constants.OTPKS_AMOUNT; i++, otpkIndex++) {
      const dhKeyPair = await cryptoHelper.generateDHKeys();
      const otpkEnvelope = await cryptoHelper.signInEnvelope(dhKeyPair.publicKey, privateKey);
      otpks.push({
        id: otpkIndex,
        envelope: cryptoHelper.uint8ArrayToBase64(otpkEnvelope)
      })
      await accountStorage.setItem(constants.OTPK_INDEX_DB_FIELD, otpkIndex);
      await otpkStorage.setItem(otpkIndex.toString(), dhKeyPair.privateKey);
    }

    await postJsonAuthenticated('/account/otpks', { otpks });
  } catch (e) {
    throw e;
  } finally {
    __generating_otpks_lock = false;
  }

}

async function submitSpk(renewalDate) {
  if (__generating_spk_lock) {
    return;
  }

  __generating_spk_lock = true;

  renewalDate = renewalDate instanceof Date ? renewalDate : new Date(renewalDate);

  if ((new Date()).getTime() < renewalDate.getTime()) {
    return;
  }

  try {
    const privateKey = await accountStorage.getItem(constants.PRIVATE_KEY_DB_FIELD);

    const pkKeypair = await cryptoHelper.generateDHKeys();
    let pkIndex = await accountStorage.getItem(constants.SPK_INDEX_DB_FIELD);
    pkIndex++;
    await accountStorage.setItem(constants.SPK_INDEX_DB_FIELD, pkIndex);
    await pkStorage.setItem(pkIndex.toString(), pkKeypair);

    const spkEnvelope = await cryptoHelper.signInEnvelope(pkKeypair.publicKey, privateKey);

    const spk = {
      id: pkIndex,
      envelope: cryptoHelper.uint8ArrayToBase64(spkEnvelope)
    }

    await postJsonAuthenticated('/account/spk', { spk });
  } catch (e) {
    throw e;
  } finally {
    __generating_spk_lock = false;
  }

}

async function fetchMessages(app, dmProcessor, challenge) {
  const messages = await postJsonAuthenticated('/messaging/messages', {}, challenge);
  try {
    for (const message of messages) {
      switch (message.type) {
        case constants.MESSAGE_TYPE.DIRECT_MESSAGE:
          dmProcessor.decryptMessage(message.content).then((message) => {
            app.addMessageToUser(message.sender, message.content)
          })
          break;
        case constants.MESSAGE_TYPE.SPK_CHANGE:
          submitSpk(message.content).then();
          break;
        case constants.MESSAGE_TYPE.OTPKS_LOW:
          submitOtpks().then();
          break;
        default:
          toastr.error('Unknown message type received')
          break;
      }
    }
  } catch (e) {
    throw e;
  }
}

async function bootstrapMessenger() {
  // username: hasNewMessages
  let conversationsJson = localStorage.getItem('conversations')
  let conversationsOrderJson = localStorage.getItem('conversationsOrder')
  let verifiedContactsJson = localStorage.getItem('verifiedContacts')
  let conversations = conversationsJson ? JSON.parse(conversationsJson) : {}
  let conversationsOrder = conversationsOrderJson ? JSON.parse(conversationsOrderJson) : []
  let verifiedContacts = verifiedContactsJson ? JSON.parse(verifiedContactsJson) : {}
  let messages = {};
  await messageStorage.iterate((v, k) => { messages[k] = v })
  let draftsJson = localStorage.getItem('drafts');
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
      verifiedContacts,
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
        if (draftUsername) {
          this.$set(this.drafts, draftUsername, draft);
        }
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
      },
      showADRandomart: async function (username) {
        username = username.toLowerCase();
        if (!username) {
          return;
        }
        const trustForm = $('#trustForm');
        trustForm.hide();
        const randomartBox = $('#randomart');
        randomartBox.text('Please wait');
        const additionalData = await contactsADStorage.getItem(username);
        if (!additionalData) {
          randomartBox.text('The conversation with this user has not yet been initiated.')
          return;
        }
        const adHash = await cryptoHelper.sha512(additionalData);
        let adRandomArt = randomart.render(adHash).map((arr) => arr.join('')).join('\n')
        randomartBox.text(adRandomArt);
        trustForm.show();
      },
      changeTrustState: function (username, event) {
        username = username.toLowerCase();
        if (!username) {
          return;
        }
        this.$set(this.verifiedContacts, username, event.currentTarget.checked);
      }
    }
  })

  window.addEventListener('beforeunload', function (event) {
    localStorage.setItem('drafts', JSON.stringify(app.drafts))
    localStorage.setItem('conversations', JSON.stringify(app.conversations));
    localStorage.setItem('conversationsOrder', JSON.stringify(app.conversationsOrder));
    localStorage.setItem('verifiedContacts', JSON.stringify(app.verifiedContacts));
    localStorage.setItem('drafts', JSON.stringify(app.drafts))
  })

  app.scrollToLatestMessage();

  window.app = app;

  $('#search').on('keypress', (event) => {
    if (event.which == 13) {
      event.preventDefault();
      searchUsername().then();
    }
  })

  const dmProcessor = await getDmProcessor();

  const sendButton = $('#sendButton');
  const messageComposer = $('#messageComposer');
  sendButton.on('click', () => {
    const message = messageComposer.val().trim();
    if (!message) {
      return;
    }
    const forUsername = messageComposer.attr('username');
    if (!forUsername) {
      return;
    }
    Vue.set(app.drafts, forUsername, '');
    sendMessage(app, dmProcessor, forUsername, message);
  })

  messageComposer.on('keypress', (event) => {
    if (!event.shiftKey && event.which == 13) {
      event.preventDefault();
      sendButton.click();
    }
  });

  const socket = io();
  socket.on('socket_id', (socketId) => {
    postJsonAuthenticated('/messaging/bind-socket', { socketId }).then();
  });
  socket.on('new_message', (challenge) => {
    fetchMessages(app, dmProcessor, challenge);
  })

  $('#searchButton').on('click', () => searchUsername().then());
  $('#app').attr('style', '');
  messageComposer.focus();
  fetchMessages(app, dmProcessor);
  const latestMessageDom = document.getElementById('latestMessage');
  if (latestMessageDom) latestMessageDom.scrollIntoView();
}
