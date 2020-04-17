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
        type: String,
        required: true,
      },
      envelope: {
        type: String,
        required: true,
      },
    },
    otpks: [
      {
        id: {
          type: String,
          required: true,
        },
        envelope: {
          type: String,
          required: true,
        },
      },
    ],
    challenges: {
      type: Map,
      of: String,
    },
  },
};
