const socket = io();
toastr.options = {
  'closeButton': true,
  'debug': false,
  'newestOnTop': true,
  'progressBar': true,
  'positionClass': 'toast-top-right',
  'preventDuplicates': false,
  'onclick': null,
  'showDuration': '300',
  'hideDuration': '1000',
  'timeOut': '5000',
  'extendedTimeOut': '1000',
  'showEasing': 'swing',
  'hideEasing': 'linear',
  'showMethod': 'fadeIn',
  'hideMethod': 'fadeOut'
}

socket.on('socket_id', (socketId) => {
  console.log(socketId, ' ', typeof socketId);
})

$('input[name="username"]').tooltip({
  'trigger':'focus',
  'title': 'Username must be between 3 and 30 characters',
  'placement': 'right'
});

$("#username").on('change keyup paste input blur', event => {
  const username = event.currentTarget.value;
  let validationResult = Promise.resolve();

  if (username.length < 3 || username.length > 30) {
    validationResult = Promise.resolve('Username must be between 3 and 30 characters')
  } else {
    validationResult = getJson(`/username-check/${username}`)
      .then(response => {
        if (!response.isFree){
          return 'This username is already taken';
        }
      })
      .catch(error => {
        return error.message;
      })
  }

  
  return validationResult.then(errorMessage => {
    if (errorMessage) {
      $('#registerSubmitBtn').prop('disabled', true)
      $(event.currentTarget).removeClass('is-valid');
      $(event.currentTarget).addClass('is-invalid');
    } else {
      $('#registerSubmitBtn').prop('disabled', false)
      $(event.currentTarget).removeClass('is-invalid');
      $(event.currentTarget).addClass('is-valid');
    }
  
    $('#usernameFeedback').text(errorMessage);
  })
});

async function generateAccount(username) {
  const signatureKeypair = await cryptoHelper.generateSignatureKeys();
  await accountStorage.setItem(constants.PRIVATE_KEY_DB_FIELD, signatureKeypair.privateKey);
  await accountStorage.setItem(constants.PUBLIC_KEY_DB_FIELD, signatureKeypair.publicKey)

  const pkKeypair = await cryptoHelper.generateDHKeys();
  await accountStorage.setItem(constants.SPK_INDEX_DB_FIELD, constants.DEFAULT_INDEX);
  const pkIndex = await accountStorage.getItem(constants.SPK_INDEX_DB_FIELD);
  await accountStorage.setItem(constants.SPKS_DB_FIELD, {id: pkIndex, privateKey: pkKeypair.privateKey});
  
  await timeout(10);

  const spkEnvelope = await cryptoHelper.signInEnvelope(pkKeypair.publicKey, signatureKeypair.privateKey);
  
  const usernameSignature = await cryptoHelper.sign(
    cryptoHelper.base64ToUint8Array(window.btoa(username)),
    signatureKeypair.privateKey
  );
  
  const otpks = {};
  const otpksPrivate = {};
  let otpkIndex = constants.DEFAULT_INDEX;
  for (let i = 0; i < constants.OTPKS_AMOUNT; i++, otpkIndex++) {
    const dhKeyPair = await cryptoHelper.generateDHKeys();
    const otpkEnvelope = await cryptoHelper.signInEnvelope(dhKeyPair.publicKey, signatureKeypair.privateKey);
    otpks[otpkIndex.toString()] = cryptoHelper.uint8ArrayToBase64(otpkEnvelope);
    otpksPrivate[otpkIndex] = dhKeyPair.privateKey;
    // Prevent freezing
    await timeout(10);
  }

  await accountStorage.setItem(constants.OTPK_INDEX_DB_FIELD, otpkIndex);
  await accountStorage.setItem(constants.OTPKS_DB_FIELD, otpksPrivate);

  return {
    username,
    usernameSignature: cryptoHelper.uint8ArrayToBase64(usernameSignature),
    publicKey: cryptoHelper.uint8ArrayToBase64(signatureKeypair.publicKey),
    spk: {
      id: pkIndex,
      envelope: cryptoHelper.uint8ArrayToBase64(spkEnvelope)
    },
    otpks
  }
}

$('#registerForm').submit(event => {
  event.preventDefault();
  const usernameInput = $("#username");
  const inputs = $(event.currentTarget).find('input, button');
  const loadingSpinner = $('#loadingSpinner');

  // Validation short-cut
  usernameInput.triggerHandler('blur').then(() => {
    if(usernameInput.hasClass('is-invalid')) {
      throw new Error('Please enter a valid username');
    }

    const username = usernameInput.val();
    inputs.prop('disabled', true);
    loadingSpinner.show()
  
    return generateAccount(username);
  }).then((accountInfo) => {
    return postJson('/register', accountInfo);
  }).then(() => {
    toastr.success('You have successfully registered', 'Registration complete');
  }).catch(error => {
    toastr.error(error.message, error.name)
    inputs.prop('disabled', false);
    loadingSpinner.hide();
  });
})
