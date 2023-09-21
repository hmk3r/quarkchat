importScripts('/libs/promise-worker/dist/promise-worker.register.min.js');
importScripts('/js/constants.js')
importScripts('/libs/sidh/dist/sidh.js')

registerPromiseWorker(function (data) {
  switch (data.type) {
    case constants.CRYPTO_WORKER_OPS.KEYGEN:
      return sidh.keyPair()
    case constants.CRYPTO_WORKER_OPS.DERIVE_SECRET:
      return sidh.secret(data.remotePublicKey, data.localPrivateKey);
    default:
      throw new Error('Requested operation is invalid');
  }
});
