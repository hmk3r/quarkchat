const sphincs = require('sphincs/dist/sphincs');
const crypto = require('crypto');

/**
 * Generates a random string using a cryptographically secure RNG
 *
 * @param {int} length
 * @return {string} random string
 */
async function randomHexString(length) {
  length = length || 32;
  return crypto.randomBytes(length).toString('hex');
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
    envelope = await base64ToUint8(signature);
  }
  if (typeof message === 'string') {
    envelope = await base64ToUint8(message);
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

module.exports = {
  randomHexString,
  openSignedEnvelope,
  isSignatureValid,
  base64ToBuffer,
  base64ToUint8,
};
