async function generateAccount(username) {
  username = username.toLowerCase();
  const signatureKeypair = await cryptoHelper.generateSignatureKeys(true);
  await accountStorage.setItem(constants.PRIVATE_KEY_DB_FIELD, signatureKeypair.privateKey);
  await accountStorage.setItem(constants.PUBLIC_KEY_DB_FIELD, signatureKeypair.publicKey)

  const pkKeypair = await cryptoHelper.generateDHKeys(true);
  await accountStorage.setItem(constants.SPK_INDEX_DB_FIELD, constants.DEFAULT_INDEX);
  const pkIndex = await accountStorage.getItem(constants.SPK_INDEX_DB_FIELD);
  await pkStorage.setItem(pkIndex.toString(), pkKeypair);

  const spkEnvelope = await cryptoHelper.signInEnvelope(pkKeypair.publicKey, signatureKeypair.privateKey, true);
  
  const usernameSignature = await cryptoHelper.sign(
    cryptoHelper.base64ToUint8Array(window.btoa(username)),
    signatureKeypair.privateKey,
    true
  );
  
  const otpks = [];
  let otpkIndex = constants.DEFAULT_INDEX;
  for (let i = 0; i < constants.OTPKS_AMOUNT; i++, otpkIndex++) {
    const dhKeyPair = await cryptoHelper.generateDHKeys(true);
    const otpkEnvelope = await cryptoHelper.signInEnvelope(dhKeyPair.publicKey, signatureKeypair.privateKey, true);
    otpks.push({
      id: otpkIndex,
      envelope: cryptoHelper.uint8ArrayToBase64(otpkEnvelope)
    })
    await accountStorage.setItem(constants.OTPK_INDEX_DB_FIELD, otpkIndex);
    await otpkStorage.setItem(otpkIndex.toString(), dhKeyPair.privateKey);
  }

  await accountStorage.setItem(constants.USERNAME_DB_FIELD, username);
  
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

function bootstrapRegisterPage() {
  let is_submitting = false;
  let accountFileJsonString;

  $("#username").on('change keyup paste input blur', event => {
    const username = event.currentTarget.value;
  
    if (!(/^[A-Za-z0-9]{3,30}$/.test(username))) {
      validationResult = Promise.resolve('Username must be alphanumeric, between 3 and 30 characters')
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
      if (is_submitting) {
      } else if (errorMessage) {
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
      toastr.info('This might take some time, please do not refresh the page', 'Generating account')
      is_submitting = true;
      return generateAccount(username);
    }).then((accountInfo) => {
      return postJson('/register', accountInfo);
    }).then(() => {
      toastr.success('You have successfully registered', 'Registration complete');
      $('#content').load('/html/messenger.html')
    }).catch(error => {
      toastr.error(error.message, error.name)
      is_submitting = false;
      inputs.prop('disabled', false);
      loadingSpinner.hide();
    });
  })
  
  $('#accountFile').on('change', (event) => {
    if(event.currentTarget.files.length === 0) {
      return;
    }
    const file = event.currentTarget.files[0];
    $('#accountFileLabel').text(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      accountFileJsonString = reader.result
    };
    reader.readAsText(file);
  })

  $('#importBtn').on('click', (event) => {
    const password = $('#password').val();

    if(!password || password.length < 10) {
      toastr.error('Invalid password', 'Import failed');
      return;
    }

    if(!accountFileJsonString) {
      toastr.error('Account file not supplied', 'Import failed');
      return
    }

    importAccount(accountFileJsonString, password, true).then(() => {
      toastr.success('Account imported', 'Import successful');
      window.location.reload();
    }).catch((error) => {
      toastr.error(error.name, 'Import failed');
      return
    })
  })
}
