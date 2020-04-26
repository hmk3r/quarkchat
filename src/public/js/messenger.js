async function postJsonAuthenticated(url, data, challenge, privateKey) {
  const username = await accountStorage.getItem(constants.USERNAME_DB_FIELD);
  if (!privateKey) {
    privateKey = await accountStorage.getItem(constants.PRIVATE_KEY_DB_FIELD);
  }

  if (!challenge) {
    challenge = (await postJson('/challenge', {username})).challenge
  }

  data.username = username;
  data.challenge = challenge;

  const message = JSON.stringify(data);
  const signature = await cryptoHelper.sign(
    cryptoHelper.base64ToUint8Array(btoa(message)),
    privateKey
  )
  return postJson(url, {signature: cryptoHelper.uint8ArrayToBase64(signature), message});
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
  function submitForm() {
    console.log('submitted')
  }
  // username: hasNewMessages
  let conversationsJson = localStorage.getItem('conversations')
  let conversationsOrderJson = localStorage.getItem('conversationsOrder')
  let conversations = conversationsJson ? JSON.parse(conversationsJson) : {'Jane Doe': true, 'John Doe': false}
  let conversationsOrder = conversationsOrderJson ? JSON.parse(conversationsOrderJson): ['Jane Doe','John Doe' ]
  let messages = {
  'Jane Doe': [
      {type: 'in', content: 'AAAAAAAAAAAAAAAAAAAAAAAAa', date: new Date().toLocaleDateTimeString()},
      {type: 'in', content: 'a?', date: new Date().toLocaleDateTimeString()},
      {type: 'in', content: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA '.repeat(50), date: new Date().toLocaleDateTimeString()},
      {type: 'in', content: 'a', date: new Date().toLocaleDateTimeString()},
      {type: 'out', content: '???????', date: new Date().toLocaleDateTimeString()},
      {type: 'in', content: '!', date: new Date().toLocaleDateTimeString()},
      {type: 'in', content: '!', date: new Date().toLocaleDateTimeString()},
      {type: 'out', content: '!', date: new Date().toLocaleDateTimeString()},
    ],
    'John Doe': [
      {type: 'in', content: 'Hello', date: new Date().toLocaleDateTimeString()},
      {type: 'in', content: 'Are you there?', date: new Date().toLocaleDateTimeString()},
      {type: 'in', content: 'ASDFASFASDSA', date: new Date().toLocaleDateTimeString()},
      {type: 'in', content: 'QWERT', date: new Date().toLocaleDateTimeString()},
      {type: 'out', content: 'Works'.repeat(21), date: new Date().toLocaleDateTimeString()},
      {type: 'in', content: 'Does it now?', date: new Date().toLocaleDateTimeString()},
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
      switchConversation: function(username) {
        username = username.toLowerCase();
        const messageComposer = $('#messageComposer');
        const draft = messageComposer.val();
        const draftUsername = messageComposer.attr('username');
        this.activeConversationRecipient = username;
        this.scrollToLatestMessage()
        this.$set(this.drafts, draftUsername, draft);
        this.$set(this.conversations, username, false);
      },
      scrollToLatestMessage: function() {
        this.$nextTick(function(){
          const latestMessageDom = document.getElementById('latestMessage');
          if(latestMessageDom) latestMessageDom.scrollIntoView();
        })
      },
      addNewRecipient: function(username) {
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
      addMessageToUser: function(username, message) {
        username = username.toLowerCase();
        if(!this.messages.hasOwnProperty(username)) {
          this.$set(this.messages, username, [message])
        } else {
          this.messages[username].push(message)
        }

        if(this.activeConversationRecipient !== username) {
          this.$set(this.conversations, username, this.activeConversationRecipient !== username)
        }

        this.conversationsOrder = [
          username,
          ...(this.conversationsOrder.filter((item) => item !== username))
        ]

        if(this.activeConversationRecipient === username) {
          this.scrollToLatestMessage();
        }
      }
    }
  })

  window.addEventListener('beforeunload', function(event) {
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
  messageComposer.on('keypress' ,(event) => {
    if(!event.shiftKey && event.which == 13) {        
      event.preventDefault();
      sendButton.click();
    }
  });

  messageComposer.focus();

  window.app = app;

  const socket = io();
  socket.on('socket_id', (socketId) => {
    postJsonAuthenticated('/messaging/bind-socket', {socketId}).then(() => console.log('Registered socket ID: ', socketId));
  });

  $('#search').on('keypress', (event) => {
    if(event.which == 13) {        
      event.preventDefault();
      searchUsername().then();
    }
  })

  $('#searchButton').on('click', () => searchUsername().then());
  $('#app').attr('style', '');
}
