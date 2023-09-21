function bootstrapMessenger() {
  function submitForm() {
    console.log('submitted')
  }
  // username: hasNewMessages
  let conversations = {'Jane Doe': false, 'John Doe': false}
  let conversationsOrder = ['Jane Doe','John Doe' ]
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
  let username = 'Aa'.repeat(15);
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
      addMessageToUser: function(username, message) {
        if(!this.messages.hasOwnProperty(username)) {
          this.$set(this.messages, username, [message])
        } else {
          this.messages[username].push(message)
        }

        if(this.activeConversationRecipient !== username) {
          this.$set(this.conversations, username, true)
        }

        this.conversationsOrder = [
          username,
          ...(this.conversationsOrder.filter((item) => item !== username))
        ]

        if(this.activeConversationRecipient === username) {
          this.scrollToLatestMessage();
        }
      },
      mounted: function() {
        this.scrollToLatestMessage();
      }
    }
  })

  $('#messageComposer').on('keypress' ,(event) => {
    if(!event.shiftKey && event.which == 13) {        
      event.preventDefault();
      submitForm();
    }
  });

  $('#messageComposer').focus();

  window.addEventListener('beforeunload', function(event) {
    localStorage.setItem('drafts', JSON.stringify(app.drafts))
  })

  window.app = app;
}
