const constants = (function() {
  return {
    CRYPTO_WORKER_OPS: {
      KEYGEN: 'keygen',
      SIGN: 'sign',
      SIGN_DETACHED: 'signDetached',
      OPEN: 'open',
      VERIFY_DETACHED: 'verifyDetached',
      DERIVE_SECRET: 'deriveSecret',
    },
    USERNAME_DB_FIELD: 'username',
    PRIVATE_KEY_DB_FIELD: 'privateKey',
    PUBLIC_KEY_DB_FIELD: 'publicKey',
    SPK_INDEX_DB_FIELD: 'spkIndex',
    SPKS_DB_FIELD: 'spks',
    OTPK_INDEX_DB_FIELD: 'otpkIndex',
    OTPKS_DB_FIELD: 'otpks',
    DEFAULT_INDEX: 0,
    OTPKS_AMOUNT: 11,
    APPLICATION_NAME: 'QuarkChat',
    MESSAGE_TYPE: {
      DIRECT_MESSAGE: 'dm',
      SPK_CHANGE: 'spk_change',
      OTPKS_LOW: 'otpks_low',
    },
  }
})();
