module.exports = {
  name: 'Challenge',
  schema: {
    username: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      minlength: [3, 'Username is too short!'],
      maxlength: [30, 'Username is too long!'],
    },
    value: {
      type: String,
      required: true,
    },
    expires: {
      type: Number,
      required: true,
    },
  },
  indexes: [
    {
      fields: {username: 1, value: 1},
      options: {},
    },
  ],
};
