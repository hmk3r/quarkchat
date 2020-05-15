

async function generateAccount(username) {
  async function get_dh_signed_key(privateKey) {
    const keyPair = await cryptoHelper.generateDHKeys();
    const envelope = await cryptoHelper.signInEnvelope(keyPair.publicKey, privateKey);
    return {keyPair, envelope}
  }
  
  const signatureKeypair = await cryptoHelper.generateSignatureKeys();

  const usernameSignature = await cryptoHelper.sign(
    cryptoHelper.base64ToUint8Array(window.btoa(username)),
    signatureKeypair.privateKey
  );
  
  const promisesKeys = [];
  // one long-term SPK and the amount of OTPKS specified in the constants file
  const numberOfSignedKeysToGenerate = constants.OTPKS_AMOUNT + 1;
  for(let i = 0; i < numberOfSignedKeysToGenerate; i++) {
    promisesKeys.push(cryptoHelper.generateDHKeys())
  }
  const keyPairs = await Promise.all(promisesKeys);

  const promisesEnvelopes = [];
  for(const keyPair of keyPairs) {
    promisesEnvelopes.push(cryptoHelper.signInEnvelope(keyPair.publicKey, signatureKeypair.privateKey))
  }

  const envelopes = await Promise.all(promisesEnvelopes)
  const [
    _spk,
    ..._otpks
  ] = keyPairs;

  const [
    _spkEnvelope,
    ..._otpksEnvelopes
  ] = envelopes;
  const otpks = {};
  let otpkIndex = 0;

  for (const otpkEnvelope of _otpksEnvelopes) {
    otpks[otpkIndex.toString()] = cryptoHelper.uint8ArrayToBase64(otpkEnvelope);
    otpkIndex++;
  }

  return {
    username,
    usernameSignature: cryptoHelper.uint8ArrayToBase64(usernameSignature),
    publicKey: cryptoHelper.uint8ArrayToBase64(signatureKeypair.publicKey),
    spk: {
      id: 0,
      envelope: _spkEnvelope
    },
    otpks
  }
}

async function benchmarkAccount() {
  const runs = parseInt($('#runs').val());
  $('#numRuns').text(runs.toString())
  const results = [];
  for (let i = 0; i < runs; i++) {
    $('#runNum').text((i + 1).toString())
    const start = performance.now();
    await generateAccount(`test${i}`);
    results.push(performance.now() - start);
  }
  const avg = average(results);
  const std = standardDiv(results);
  $('#results').text(results.join('ms, '));
  $('#average').text(avg.toString());
  $('#std').text(std.toString());

  
  const downloadButton = $('#accountGenResultsDownload');
  downloadButton.prop('href', URL.createObjectURL(new Blob([JSON.stringify(results)], {type : 'application/json'})))
  downloadButton.prop('download', `accountGenBenchmark-${runs}-${navigator.userAgent.replace(/[/\\?%*:|"<>]/g, '-')}.json`)
  downloadButton.removeClass('disabled');
  downloadButton[0].click();
}

$('#runBenchmark').on('click', function() {
  $(this).prop('disabled', true);
  benchmarkAccount().then(() => {
    $(this).prop('disabled', false)
  })
})
