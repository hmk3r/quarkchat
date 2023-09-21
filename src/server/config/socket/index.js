/**
 *
 *
 * @export
 * @param {http.Server} server
 * @param {Object} params
 * @return {SocketIO.Server}
 */
module.exports = function(server, params) {
  const io = require('socket.io')(server);

  io.on('connection', (socket) => {
    socket.emit('socket_id', socket.id);
  });

  return io;
};
