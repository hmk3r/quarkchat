const constants = require('../../config/constants');

module.exports = {
  name: 'Message',
  schema: {
    type: {
      type: String,
      required: true,
      enum: Object.values(constants.MESSAGE_TYPE),
    },
    for_username: {
      type: String,
      required: true,
      index: true,
      minlength: [3, 'Username is too short!'],
      maxlength: [30, 'Username is too long!'],
    },
    content: {
      type: Object,
      required: true,
    },
  },
  indexes: [
    {
      fields: {for_username: 1, type: -1},
      options: {},
    },
  ],
};
