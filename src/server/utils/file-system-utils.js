const fs = require('fs');
const path = require('path');

/**
 * Recursively scans a directory (synchronously) and executes a
 * callback on files found
 *
 * @param {string} currentDirPath Root directory
 * @param {Function} callback Callback to execute on each file found
 */
function walkDirectorySync(currentDirPath, callback) {
  fs.readdirSync(currentDirPath).forEach((name) => {
    const filePath = path.join(currentDirPath, name);
    const stat = fs.statSync(filePath);

    if (stat.isFile()) {
      return callback(filePath, name);
    } else if (stat.isDirectory()) {
      walkDirectorySync(filePath, callback);
    }
  });
}

/**
 * Reads a file
 *
 * @param {Array<String>} paths
 * @return {File}
 */
function readFileSync(...paths) {
  return fs.readFileSync(path.join(...paths));
}

module.exports = {
  walkDirectorySync,
  readFileSync,
};
