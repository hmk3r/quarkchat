module.exports = {
  name: 'Otpk',
  schema: {
    username: {
      type: String,
      required: true,
      index: true,
      lowercase: true,
      trim: true,
      minlength: [3, 'Username is too short!'],
      maxlength: [30, 'Username is too long!'],
    },
    id: {
      type: String,
      required: true,
    },
    envelope: {
      type: String,
      required: true,
    },
  },
  indexes: [
    {
      fields: {username: 1, id: 1},
      options: {},
    },
  ],
};
