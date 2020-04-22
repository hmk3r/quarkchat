function bootstrapMessenger() {
  let conversations = ['Jane Doe', 'John Doe']
  let messages = {
    'Jane Doe': [
    {type: 'in', content: 'AAAAAAAAAAAAAAAAAAAAAAAAa'},
      {type: 'in', content: 'a?'},
      {type: 'in', content: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'},
      {type: 'in', content: 'a'},
      {type: 'out', content: '???????'},
      {type: 'in', content: '!'},
      {type: 'in', content: '!'},
      {type: 'out', content: '!'},
    ],
    'John Doe': [
      {type: 'in', content: 'Hello'},
      {type: 'in', content: 'Are you there?'},
      {type: 'in', content: 'ASDFASFASDSA'},
      {type: 'in', content: 'QWERT'},
      {type: 'out', content: 'Works'},
      {type: 'in', content: 'Does it now?'},
    ]
  }
  
  let app = new Vue({
  el: '#app',
  data: {
    conversation,
    messages
  }
  }) 
}
