importScripts('/libs/promise-worker/dist/promise-worker.register.min.js');
importScripts('/js/constants.js')
importScripts('/libs/sphincs/dist/sphincs.js')

registerPromiseWorker(function (data) {
  switch (data.type) {
    case constants.CRYPTO_WORKER_OPS.KEYGEN:
      return sphincs.keyPair()
    case constants.CRYPTO_WORKER_OPS.SIGN:
      return sphincs.sign(data.message, data.privateKey);
    case constants.CRYPTO_WORKER_OPS.SIGN_DETACHED:
      return sphincs.signDetached(data.message, data.privateKey)
    case constants.CRYPTO_WORKER_OPS.OPEN:
      return sphincs.open(data.signed, data.publicKey);
    case constants.CRYPTO_WORKER_OPS.VERIFY_DETACHED:
      return sphincs.verifyDetached(data.signature, data.message, data.publicKey);
    default:
      throw new Error('Requested operation is invalid');
  }
});
