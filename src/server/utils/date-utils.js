const moment = require('moment');

/**
 * Returns the time in milliseconds since Epoch time
 *
 * @return {Number}
 */
function getMsTimestamp() {
  return moment().valueOf();
}

/**
 * Returns the current date
 *
 * @return {Date}
 */
function getDate() {
  return new Date();
}

/**
 * Adds time to date
 *
 * @param {Date} date
 * @param {Number} value Amount of time
 * @param {string} unit Unit of time
 * @return {Date}
 */
function addToDate(date, value, unit) {
  return moment(date).add(value, unit).toDate();
}

module.exports = {
  getMsTimestamp,
  getDate,
  addToDate,
};
