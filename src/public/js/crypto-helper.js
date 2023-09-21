// Part of this code was composed by me during the Year 2 Group project

// https://tools.ietf.org/html/draft-ietf-msec-mikey-ecc-03
// https://crypto.stackexchange.com/questions/2482/how-strong-is-the-ecdsa-algorithm
// Use sha-256 to sign 256-bit ECDSA https://tools.ietf.org/html/rfc5656#section-6.2.1
const cryptoHelper = (function () {
  const AES_256_GCM = {
    name: 'AES-GCM',
    length: 256
  }

  const HKDF_SHA_512 = {
    name: 'HKDF',
    hash: 'SHA-512'
  }

  const HMAC_SHA_512 = {
    name: 'HMAC',
    hash: 'SHA-512'
  }

  const _sidhWorker = new Worker('/js/workers/sidh-worker.js');
  const _sphincsWorker = new Worker('/js/workers/sphincs-worker.js');
  const sidhWorker = new PromiseWorker(_sidhWorker);
  const sphincsWorker = new PromiseWorker(_sphincsWorker);

  const UTF8_ENCODER = new TextEncoder('utf-8')
  const UTF8_DECODER = new TextDecoder('utf-8')
  const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#*?_'

  // browser compatibility
  crypto = crypto || window.msCrypto; //for IE11
  if (crypto.webkitSubtle) {
    crypto.subtle = crypto.webkitSubtle; //for Safari
  }

  async function generateSignatureKeys() {
    return sphincsWorker.postMessage({type: constants.CRYPTO_WORKER_OPS.KEYGEN});
  }

  async function signInEnvelope(message, privateKey) {
    return sphincsWorker.postMessage({
      type: constants.CRYPTO_WORKER_OPS.SIGN,
      message,
      privateKey
    });
  }

  async function sign(message, privateKey) {
    return sphincsWorker.postMessage({
      type: constants.CRYPTO_WORKER_OPS.SIGN_DETACHED,
      message,
      privateKey
    });
  }

  async function openSignedEnvelope(envelope, publicKey) {
    return sphincsWorker.postMessage({
      type: constants.CRYPTO_WORKER_OPS.OPEN,
      signed: envelope,
      publicKey
    });
  }

  async function verifySignature(signature, message, publicKey) {
    return sphincsWorker.postMessage({
      type: constants.CRYPTO_WORKER_OPS.VERIFY_DETACHED,
      signature,
      message,
      publicKey
    });
  }

  async function generateDHKeys() {
    return sidhWorker.postMessage({type: constants.CRYPTO_WORKER_OPS.KEYGEN});
  }

  async function deriveDHSecret(localPrivateKey, remotePublicKey) {
    return sidhWorker.postMessage({
      type: constants.CRYPTO_WORKER_OPS.DERIVE_SECRET,
      remotePublicKey,
      localPrivateKey
    });
  }

  // https://stackoverflow.com/a/40031979
  function bufToHex(buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer),
      function (x) { return ('00' + x.toString(16)).slice(-2); }).join('')
  }

  // https://gist.github.com/tauzen/3d18825ae41ff3fc8981
  function hexToBuf(hex) {
    if (!hex) {
      return new Uint8Array()
    }
    const arr = []
    for (let i = 0, len = hex.length; i < len; i += 2) {
      arr.push(parseInt(hex.substr(i, 2), 16))
    }
    return new Uint8Array(arr)
  }

  function bufToBase64(buffer) {
    return uint8ArrayToBase64(new Uint8Array(buffer));
  }

  function base64ToBuf(base64) {
    return base64ToUint8Array(base64).buffer;
  }

  // Adapted from https://stackoverflow.com/questions/9267899/arraybuffer-to-base64-encoded-string
  function uint8ArrayToBase64(uint8Array) {
    let bytesAsChars = '';
    for (let i = 0; i < uint8Array.byteLength; i++) {
      bytesAsChars += String.fromCharCode(uint8Array[i]);
    }
    
    return window.btoa(bytesAsChars);
  }

  // Adapted from https://stackoverflow.com/questions/21797299/convert-base64-string-to-arraybuffer
  function base64ToUint8Array(base64) {
    let bytesAsChars = window.atob(base64);
    let bytes = new Uint8Array(bytesAsChars.length);
    for (let i = 0; i < bytes.byteLength; i++) {
      bytes[i] = bytesAsChars.charCodeAt(i);
    }
    return bytes;
  }

  //https://stackoverflow.com/a/52420482
  function arrayToUint8Array(arr) {
    return new Uint8Array(arr);
  }

  //https://stackoverflow.com/a/52420482
  function uint8ArrayToArray(uint8arr) {
    return Array.from
      ? Array.from(uint8arr)
      : uint8arr.map(v => v);
  }

  // adapted from https://stackoverflow.com/a/44831114
  function splitDataAndAuthTag(encrypted, tagLength) {
    if (!tagLength) {
      tagLength = 128;
    }
    const slicePoint = encrypted.byteLength - ((tagLength + 7) >> 3);

    const data = bufToHex(encrypted.slice(0, slicePoint))
    const authTag = bufToHex(encrypted.slice(slicePoint));

    return {
      data,
      authTag
    }
  }

  function numToChar(number) {
    return ALPHABET.charAt(number % ALPHABET.length)
  }

  async function sha512(message) {
    const buffer = await crypto.subtle.digest({
      name: "SHA-512",
    }, UTF8_ENCODER.encode(message))
    return bufToHex(buffer)
  }

  // returns JWK
  function extractJWKey(key) {
    return crypto.subtle.exportKey('jwk', key)
  }

  // returns CryptoKey
  function importJWKey(jsonString, algorithm) {
    let jwk = JSON.parse(jsonString)

    return crypto.subtle.importKey(
      'jwk',
      jwk,
      algorithm || ECDSA_256,
      false,
      jwk.key_ops
    )
  }

  // returns a random password of a specified length
  function generatePass(length) {
    let numbers = new Uint8Array(length || 15)
    crypto.getRandomValues(numbers);
    return Array.prototype.map.call(numbers, numToChar).join('');
  }

  // generates salt to be used in key derivation function
  function generatePbkdf2Salt(length) {
    return crypto.getRandomValues(new Uint8Array(length || 16))
  }

  // returns a CryptoKey to be used in AES encryption/decryption
  async function deriveAESKey(password, pbkdfSalt, AESAlgorithm) {
    let PBKDF2 = {
      name: 'PBKDF2',
      salt: UTF8_ENCODER.encode(pbkdfSalt),
      iterations: 1000,
      hash: { name: 'SHA-256' }
    }

    const key = await crypto.subtle.importKey('raw', UTF8_ENCODER.encode(password), PBKDF2, false, ['deriveKey', 'deriveBits'])
    return crypto.subtle.deriveKey(PBKDF2, key, AESAlgorithm || AES_256_GCM, false, ['encrypt', 'decrypt'])
  }

  function deriveAESKeyRaw(buffer) {
    return crypto.subtle.importKey(
      'raw',
      buffer,
      AES_256_GCM,
      false,
      ['encrypt', 'decrypt']
    )
  }

  // returns {encryptedData: ..., iv: ...}
  async function encryptAES(key, message, additionalData, AESAlgorithm, ivLength) {
    let iv = crypto.getRandomValues(new Uint8Array(ivLength || 12));
    const algorithm = {
      name: AESAlgorithm || AES_256_GCM.name,
      iv
    }

    if (additionalData) {
      algorithm.additionalData = additionalData;
    }

    const encryptedData = await crypto.subtle.encrypt(
      algorithm,
      key,
      UTF8_ENCODER.encode(message)
    )

    return {encryptedData, iv}
  }

  // returns the decrypted data as string
  async function decryptAES(key, data, iv, additionalData, AESAlgorithm) {
    const algorithm = {
      name: AESAlgorithm || AES_256_GCM.name,
      iv
    }

    if (additionalData) {
      algorithm.additionalData = additionalData;
    }
  
    const message = await crypto.subtle.decrypt(algorithm, key, data)
    return UTF8_DECODER.decode(message)
  }

  async function deriveBytesHKDF(baseKey, salt, info, length, shouldDeriveBits) {
    if (!baseKey.constructor || baseKey.constructor.name !== 'CryptoKey') {
      baseKey = await crypto.subtle.importKey(
        'raw',
        baseKey,
        HKDF_SHA_512,
        false,
        ['deriveBits']
      );
    }

    if (typeof info === 'string') {
      info = UTF8_ENCODER.encode(info);
    }

    if (!shouldDeriveBits) {
      length *= 8
    }

    return crypto.subtle.deriveBits(
      {
        name: HKDF_SHA_512.name,
        hash: HKDF_SHA_512.hash,
        salt,
        info
      },
      baseKey,
      length
    )
  }

  async function hmacSign(key, data) {
    if (!baseKey.constructor || baseKey.constructor.name !== 'CryptoKey') {
      key = await crypto.subtle.importKey(
        'raw',
        baseKey,
        HMAC_SHA_512,
        false,
        ['sign']
      );
    }

    return crypto.subtle.sign(HMAC_SHA_512, key, data)
  }

  return {
    AES_256_GCM,
    HKDF_SHA_512,
    HMAC_SHA_512,
    UTF8_ENCODER,
    UTF8_DECODER,
    bufToHex,
    hexToBuf,
    bufToBase64,
    base64ToBuf,
    uint8ArrayToBase64,
    base64ToUint8Array,
    arrayToUint8Array,
    uint8ArrayToArray,
    splitDataAndAuthTag,
    sha512,
    extractJWKey,
    importJWKey,
    generatePass,
    generatePbkdf2Salt,
    deriveAESKey,
    deriveAESKeyRaw,
    encryptAES,
    decryptAES,
    generateDHKeys,
    deriveDHSecret,
    generateSignatureKeys,
    signInEnvelope,
    sign,
    openSignedEnvelope,
    verifySignature,
    deriveBytesHKDF,
    hmacSign,
  }
})()
