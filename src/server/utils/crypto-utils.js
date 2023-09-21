const sphincs = require('sphincs/dist/sphincs');
const crypto = require('crypto');

/**
 * Generates a random string using a cryptographically secure RNG
 * By default it's composed of the base64 character set
 *
 * @param {int} length in Bytes; 8 by default
 * @param {string} encoding string character set - base64, utf-8, hex, etc.
 * @return {string} random string
 */
async function randomString(length, encoding) {
  length = length || 8;
  encoding = encoding || '';
  return crypto.randomBytes(length).toString(encoding);
}

/**
 * Opens an envelope(signature+message), checks whether the signature
 * is valid and returns the message if so, using the SPHINCS DSA
 *
 * @param {UInt8Array|string} envelope SPHINCS message envelope as
 * UInt8Array or base64 string
 * @param {(UInt8Array|string)} publicKey SPHINCS public key as
 * UInt8Array or base64 string
 * @return {UInt8Array}
 */
async function openSignedEnvelope(envelope, publicKey) {
  if (typeof envelope === 'string') {
    envelope = await base64ToUint8(envelope);
  }
  if (typeof publicKey === 'string') {
    publicKey = await base64ToUint8(publicKey);
  }
  return sphincs.open(envelope, publicKey);
}

/**
 * Checks whether a SPHINCS signature for a message is valid
 *
 * @param {UInt8Array|string} signature SPHINCS signature as
 * UInt8Array or base64 string
 * @param {UInt8Array|string} message message to check as
 * UInt8Array or base64 string
 * @param {UInt8Array|string} publicKey SPHINCS public key as
 * UInt8Array or base64 string
 * @return {boolean}
 */
async function isSignatureValid(signature, message, publicKey) {
  if (typeof signature === 'string') {
    signature = await base64ToUint8(signature);
  }
  if (typeof message === 'string') {
    message = await base64ToUint8(message);
  }
  if (typeof publicKey === 'string') {
    publicKey = await base64ToUint8(publicKey);
  }
  return sphincs.verifyDetached(signature, message, publicKey);
}

/**
 * Converts a base64 string to NodeJS Buffer
 *
 * @param {string} base64String
 * @return {Buffer}
 */
async function base64ToBuffer(base64String) {
  return Buffer.from(base64String, 'base64');
}

/**
 * Converts a base64 string to Uint8Array
 *
 * @param {string} base64String
 * @return {Uint8Array}
 */
async function base64ToUint8(base64String) {
  const buffer = await base64ToBuffer(base64String);
  const uintArray = new Uint8Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    uintArray[i] = buffer[i];
  }
  return uintArray;
}

/**
 * Covert an ASCII string to base64
 *
 * @param {string} string ASCII String
 * @return {string} string encoded as Base64
 */
function base64Encode(string) {
  return Buffer.from(string, 'ascii').toString('base64');
}

/**
 * Covert a base64 string to an ASCII string
 *
 * @param {string} string ASCII String
 * @return {string} string encoded as Base64
 */
function base64Decode(string) {
  return Buffer.from(string, 'base64').toString('ascii');
}

module.exports = {
  randomString,
  openSignedEnvelope,
  isSignatureValid,
  base64ToBuffer,
  base64ToUint8,
  base64Encode,
  base64Decode,
};
