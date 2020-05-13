const connectionStrings = {
  // if in production environment, the connection string must be provided
  // as a environmental variable
  production: process.env.CONNECTION_STRING,
  // the connection string in a development variable may be provided as
  // an environmental variable or be the default one
  development: process.env.CONNECTION_STRING || 'mongodb://localhost/QuarkChatDB',
};

const environment = process.env.NODE_ENV || 'development';

module.exports = {
  environment,
  connectionString: connectionStrings[environment],
  port: process.env.PORT || 8080,
  challengeTimeout: process.env.CHALLENGE_TIMEOUT || 60 * 1000, // 60 seconds
  // renewal time for signed pre-key
  spkRenewalInterval: {
    value: process.env.SPK_RENEWAL_INTERVAL_VALUE || 2,
    unit: process.env.SPK_RENEWAL_INTERVAL_UNIT || 'd',
  },
  lowOtpkWarningThreshold: process.env.LOW_OTPK_WARNING_THRESHOLD || 5,
};

