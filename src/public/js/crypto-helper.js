// This file was composed by me for the Year 2 group project

// https://tools.ietf.org/html/draft-ietf-msec-mikey-ecc-03
// https://crypto.stackexchange.com/questions/2482/how-strong-is-the-ecdsa-algorithm
// Use sha-256 to sign 256-bit ECDSA https://tools.ietf.org/html/rfc5656#section-6.2.1
const cryptoHelper = (function () {
  const ECDSA_256 = {
    name: 'ECDSA',
    namedCurve: 'P-256',
    hash: { name: 'SHA-256' }
  }
  const AES_256_GCM = {
    name: 'AES-GCM',
    length: 256
  }

  const ECDH_256 = {
    name: 'ECDH',
    namedCurve: 'P-256'
  }

  const RSA_OAEP_4096_SHA_512 = {
    name: 'RSA-OAEP',
    modulusLength: 4096,
    publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
    hash: { name: 'SHA-512' },
  }

  const UTF8_ENCODER = new TextEncoder('utf-8')
  const UTF8_DECODER = new TextDecoder('utf-8')
  const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#*?_'

  // browser compatibility
  crypto = crypto || window.msCrypto; //for IE11
  if (crypto.webkitSubtle) {
    crypto.subtle = crypto.webkitSubtle; //for Safari
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

  // https://stackoverflow.com/questions/9267899/arraybuffer-to-base64-encoded-string
  function bufToBase64(buffer) {
    let binary = '';
    let bytes = new Uint8Array(buffer);
    let len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  // https://stackoverflow.com/questions/21797299/convert-base64-string-to-arraybuffer
  function base64ToBuf(base64) {
    let binary_string = window.atob(base64);
    let len = binary_string.length;
    let bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
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

  function sha384(message) {
    return crypto.subtle.digest(
      {
        name: "SHA-384",
      },
      UTF8_ENCODER.encode(message)
    ).then(bufToHex)
  }

  // returns keypair {publicKey, privateKey}
  function generateECDSAKeys() {
    return crypto.subtle.generateKey(
      ECDSA_256,
      true,
      ['sign', 'verify']
    )
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

  // returns the signature as buffer string
  function sign(privateKey, messageString, algorithm) {
    let data = UTF8_ENCODER.encode(messageString)

    return crypto.subtle.sign(
      algorithm || ECDSA_256,
      privateKey,
      data
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
  function deriveAESKey(password, pbkdfSalt, AESAlgorithm) {
    let PBKDF2 = {
      name: 'PBKDF2',
      salt: UTF8_ENCODER.encode(pbkdfSalt),
      iterations: 1000,
      hash: { name: 'SHA-256' }
    }

    return crypto.subtle.importKey(
      'raw',
      UTF8_ENCODER.encode(password),
      PBKDF2,
      false,
      ['deriveKey', 'deriveBits']
    ).then(function (key) {

      return crypto.subtle.deriveKey(
        PBKDF2,
        key,
        AESAlgorithm || AES_256_GCM,
        false,
        ['encrypt', 'decrypt']
      )
    })
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

  // returns [encryptedData, initializationVector] Promise
  function encryptAES(key, message, AESAlgorithm, ivLength) {
    let iv = crypto.getRandomValues(new Uint8Array(ivLength || 12));
    const algorithm = {
      name: AESAlgorithm || AES_256_GCM.name,
      iv
    }

    return Promise.all([
      crypto.subtle.encrypt(
        algorithm,
        key,
        UTF8_ENCODER.encode(message)
      ),
      Promise.resolve(iv)
    ])
  }

  // returns the decrypted data as string
  function decryptAES(key, data, iv, AESAlgorithm) {
    const algorithm = {
      name: AESAlgorithm || AES_256_GCM.name,
      iv
    }

    return crypto.subtle.decrypt(
      algorithm,
      key,
      data
    ).then(function (message) {
      return Promise.resolve(UTF8_DECODER.decode(message))
    })
  }

  // returns keypair {publicKey - hex string, privateKey - CryptoKey}
  function generateECDHKeys() {
    return crypto.subtle.generateKey(
      ECDH_256,
      false,
      ['deriveKey', 'deriveBits']
    ).then(function (keyPair) {
      return Promise.all([
        Promise.resolve(keyPair.privateKey),
        crypto.subtle.exportKey('raw', keyPair.publicKey)
      ])
    }).then(function (result) {
      const [privateKey, publicKey] = result
      return { privateKey: privateKey, publicKey: bufToHex(publicKey) }
    })
  }

  // public key - hex
  // private key - CryptoKey
  // returns key as a buffer
  function deriveECDHKey(publicKey, privateKey) {
    return Promise.resolve().then(function () {
      return hexToBuf(publicKey)
    }).then(function (publicKeyRaw) {
      return crypto.subtle.importKey(
        'raw',
        publicKeyRaw,
        ECDH_256,
        true,
        [])
    }).then(function (pbk) {
      return crypto.subtle.deriveBits(
        {
          name: 'ECDH',
          namedCurve: 'P-256',
          public: pbk
        },
        privateKey,
        256)
    })
  }

  function generateRsaOAEPKeys() {
    return crypto.subtle.generateKey(
      RSA_OAEP_4096_SHA_512,
      true,
      ["encrypt", "decrypt"]
    )
  }

  return {
    ECDSA_256,
    AES_256_GCM,
    ECDH_256,
    RSA_OAEP_4096_SHA_512,
    UTF8_ENCODER,
    UTF8_DECODER,
    bufToHex,
    hexToBuf,
    bufToBase64,
    base64ToBuf,
    arrayToUint8Array,
    uint8ArrayToArray,
    splitDataAndAuthTag,
    sha384,
    generateECDSAKeys,
    extractJWKey,
    importJWKey,
    sign,
    generatePass,
    generatePbkdf2Salt,
    deriveAESKey,
    deriveAESKeyRaw,
    encryptAES,
    decryptAES,
    generateECDHKeys,
    deriveECDHKey,
    generateRsaOAEPKeys
  }
})()
