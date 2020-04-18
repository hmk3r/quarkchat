module.exports = {
  name: 'User',
  schema: {
    username: {
      type: String,
      required: true,
      index: true,
      unique: true,
      minlength: [3, 'Username is too short!'],
      maxlength: [30, 'Username is too long!'],
    },
    public_key: {
      type: String,
      required: true,
    },
    spk: {
      id: {
        type: Number,
        required: true,
      },
      envelope: {
        type: String,
        required: true,
      },
    },
    otpks: {
      type: Map,
      of: String,
    },
    challenges: {
      type: Map,
      of: String,
    },
  },
};
