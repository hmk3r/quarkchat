const cron = require('node-schedule');

module.exports = function(params) {
  const {
    data,
    dateUtils,
    config,
  } = params;

  cron.scheduleJob('*/30 * * * *', async () => {
    await data.removeChallengesOlderThan(
        dateUtils.getMsTimestamp() - config.challengeTimeout,
    );
  });
};
