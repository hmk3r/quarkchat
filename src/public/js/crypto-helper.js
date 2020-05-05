// Part of this code was composed by me during the Year 2 Group project

const cryptoHelper = (function () {
  const AES_256_GCM = {
    name: 'AES-GCM',
    length: 256
  }

  const AES_256_CBC = {
      name: 'AES-CBC',
      keyLength: 256,
  }

  const HKDF_SHA_512 = {
    name: 'HKDF',
    hash: 'SHA-512',
    hashOutputLengthBytes: 64
  }

  const HMAC_SHA_512 = {
    name: 'HMAC',
    hash: 'SHA-512',
    hashOutputLengthBytes: 64
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

  async function generateSignatureKeys(useWorker = true) {
    if (!useWorker) {
      return sphincs.keyPair();
    }
    return sphincsWorker.postMessage({type: constants.CRYPTO_WORKER_OPS.KEYGEN});
  }

  async function signInEnvelope(message, privateKey, useWorker = true) {
    if (!useWorker) {
      return sphincs.sign(message, privateKey);
    }
    return sphincsWorker.postMessage({
      type: constants.CRYPTO_WORKER_OPS.SIGN,
      message,
      privateKey
    });
  }

  async function sign(message, privateKey, useWorker = true) {
    if (!useWorker) {
      return sphincs.signDetached(message, privateKey)
    }
    return sphincsWorker.postMessage({
      type: constants.CRYPTO_WORKER_OPS.SIGN_DETACHED,
      message,
      privateKey
    });
  }

  async function openSignedEnvelope(envelope, publicKey, useWorker = true) {
    if (!useWorker) {
      return sphincs.open(envelope, publicKey);
    }
    return sphincsWorker.postMessage({
      type: constants.CRYPTO_WORKER_OPS.OPEN,
      signed: envelope,
      publicKey
    });
  }

  async function verifySignature(signature, message, publicKey, useWorker = true) {
    if (!useWorker) {
      sphincs.verifyDetached(signature, message, publicKey);
    }
    return sphincsWorker.postMessage({
      type: constants.CRYPTO_WORKER_OPS.VERIFY_DETACHED,
      signature,
      message,
      publicKey
    });
  }

  async function generateDHKeys(useWorker = true) {
    if (!useWorker) {
      return sidh.keyPair();
    }
    return sidhWorker.postMessage({type: constants.CRYPTO_WORKER_OPS.KEYGEN});
  }

  async function deriveDHSecret(localPrivateKey, remotePublicKey, useWorker = true) {
    if (!useWorker) {
      return sidh.secret(remotePublicKey, localPrivateKey);
    }
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

  function concatUint8Arrays(...arrays) {
    const concat = new Uint8Array(arrays.reduce((accumulator, arr) => {return accumulator + arr.byteLength || arr.length}, 0));
    for (let i = 0; i < arrays.length; i++) {
      concat.set(arrays[i], i === 0 ? 0 : arrays[i - 1].byteLength || arrays[i - 1].length);
    }
    return concat;
  }

  function concatArrayBuffers(...buffers) {
    return concatUint8Arrays(...buffers.map((b) => new Uint8Array(b))).buffer;
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
    if (typeof message === 'string') {
      message = UTF8_ENCODER.encode(message)
    }
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
      hash: { name: 'SHA-512' }
    }

    const key = await crypto.subtle.importKey('raw', UTF8_ENCODER.encode(password), PBKDF2.name, false, ['deriveKey'])
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

    if (!length) {
      length = HKDF_SHA_512.hashOutputLengthBytes;
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
    if (!key.constructor || key.constructor.name !== 'CryptoKey') {
      key = await crypto.subtle.importKey(
        'raw',
        key,
        HMAC_SHA_512,
        false,
        ['sign']
      );
    }

    return crypto.subtle.sign(HMAC_SHA_512, key, data)
  }

  async function hmacVerify(key, mac, data) {
    if (!key.constructor || key.constructor.name !== 'CryptoKey') {
      key = await crypto.subtle.importKey(
        'raw',
        key,
        HMAC_SHA_512,
        false,
        ['verify']
      );
    }
    return crypto.subtle.verify(HMAC_SHA_512, key, mac, data)
  }

  // as proposed in https://signal.org/docs/specifications/doubleratchet/#recommended-cryptographic-algorithms
  async function encryptAES_CBC_HMAC_SHA512(key, plaintext, info, additionalData) {
    if (typeof plaintext === 'string') {
      plaintext = UTF8_ENCODER.encode(plaintext);
    }

    if (typeof info === 'string') {
      info = UTF8_ENCODER.encode(info);
    }

    if (typeof additionalData === 'string') {
      additionalData = UTF8_ENCODER.encode(additionalData);
    }

    const derivedBytes = await deriveBytesHKDF(
      key,
      new Uint8Array(HKDF_SHA_512.hashOutputLengthBytes),
      info,
      80
    )

    const encKey = derivedBytes.slice(0, 32);
    const authKey = derivedBytes.slice(32, 64);
    const iv = derivedBytes.slice(64, 80);

    const aesKey = await crypto.subtle.importKey(
      'raw',
      encKey,
      { name: AES_256_CBC.name },
      false,
      ['encrypt']
    );;

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: AES_256_CBC.name,
        iv
      },
      aesKey,
      plaintext
    );

    const toSign = concatArrayBuffers(additionalData, ciphertext);
    const mac = await hmacSign(authKey, toSign);
    
    return concatArrayBuffers(ciphertext, mac);
  }

  // reverse of encryptAES_CBC_HMAC_SHA512
  async function decryptAES_CBC_HMAC_SHA512(key, ciphertextAndMac, info, additionalData) {
    if (typeof info === 'string') {
      info = UTF8_ENCODER.encode(info);
    }

    if (typeof additionalData === 'string') {
      additionalData = UTF8_ENCODER.encode(additionalData);
    }

    const derivedBytes = await deriveBytesHKDF(
      key,
      new Uint8Array(HKDF_SHA_512.hashOutputLengthBytes),
      info,
      80
    )

    const encKey = derivedBytes.slice(0, 32);
    const authKey = derivedBytes.slice(32, 64);
    const iv = derivedBytes.slice(64, 80);

    const ciphertextMacSplitPoint = ciphertextAndMac.byteLength - HMAC_SHA_512.hashOutputLengthBytes;
    const ciphertext = ciphertextAndMac.slice(0, ciphertextMacSplitPoint);
    const mac = ciphertextAndMac.slice(ciphertextMacSplitPoint, ciphertextAndMac.byteLength);

    const toVerify = concatArrayBuffers(additionalData, ciphertext);
    const isMacValid = await hmacVerify(authKey, mac, toVerify)

    if (!isMacValid) {
      throw new Error('MAC check not passed! The massage was possibly tampered with.')
    }

    const aesKey = await crypto.subtle.importKey(
      'raw',
      encKey,
      { name: AES_256_CBC.name },
      false,
      ['decrypt']
    );;

    const plaintext = await crypto.subtle.decrypt(
      {
        name: AES_256_CBC.name,
        iv
      },
      aesKey,
      ciphertext
    );

    return plaintext;
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
    concatUint8Arrays,
    concatArrayBuffers,
    encryptAES_CBC_HMAC_SHA512,
    decryptAES_CBC_HMAC_SHA512,
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
    hmacVerify,
  }
})()
