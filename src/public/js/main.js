const socket = io();

socket.on('socket_id', (socketId) => {
  console.log(socketId, ' ', typeof socketId);
})

$('input[name="username"]').tooltip({
  'trigger':'focus',
  'title': 'Username must be between 3 and 30 characters',
  'placement': 'right'
});

$("#username").on('change keydown paste input blur', function(){
  const username = this.value;
  let validationResult = Promise.resolve();

  if (username.length < 3 || username.length > 30) {
    validationResult = Promise.resolve('Username must be between 3 and 30 characters')
  } else {
    validationResult = fetch(`/username-check/${username}`)
      .then(response => {return response.json()})
      .then(response => {
        if (response.status >= 400) {
          return response.message
        } else if (!response.isFree){
          return 'This username is already taken'
        }
      })
  }

  
  validationResult.then(errorMessage => {
    if (errorMessage) {
      $(this).removeClass('is-valid');
      $(this).addClass('is-invalid');
    } else {
      $(this).removeClass('is-invalid');
      $(this).addClass('is-valid');
    }
  
    $('#usernameFeedback').text(errorMessage);
  })
});
