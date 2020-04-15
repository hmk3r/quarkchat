const socket = io();

socket.on('socket_id', (socketId) => {
  console.log(socketId, ' ', typeof socketId) 
})
