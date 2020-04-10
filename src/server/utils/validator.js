module.exports = {
  validateString(str, min, max, chars) {
    if (typeof str !== 'string' || str.length < min || str.length > max) {
      return false;
    }
    if (chars) {
      const strToCheck = str.split('');
      if (strToCheck.some((char) => {
        return chars.indexOf(char) < 0;
      })) {
        return false;
      }
    }
    return true;
  },
  validateNumberBetween(num, min, max) {
    if (typeof num !== 'number' || num < min || min > max) {
      return false;
    }

    return true;
  },
};
