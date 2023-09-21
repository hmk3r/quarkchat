const cron = require('node-schedule');

module.exports = function(params) {
  const {
    data,
    dateUtils,
  } = params;

  cron.scheduleJob('*/15 * * * *', async () => {
    await data.removeChallengesOlderThan(
        dateUtils.getMsTimestamp(),
    );
  });
};
