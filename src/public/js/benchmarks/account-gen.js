

async function generateAccount(username) {
  const signatureKeypair = await cryptoHelper.generateSignatureKeys();

  const pkKeypair = await cryptoHelper.generateDHKeys();
  const pkIndex = 0;

  const spkEnvelope = await cryptoHelper.signInEnvelope(pkKeypair.publicKey, signatureKeypair.privateKey);
  
  const usernameSignature = await cryptoHelper.sign(
    cryptoHelper.base64ToUint8Array(window.btoa(username)),
    signatureKeypair.privateKey
  );
  
  const otpks = {};
  let otpkIndex = 0;
  for (let i = 0; i < constants.OTPKS_AMOUNT; i++, otpkIndex++) {
    const dhKeyPair = await cryptoHelper.generateDHKeys();
    const otpkEnvelope = await cryptoHelper.signInEnvelope(dhKeyPair.publicKey, signatureKeypair.privateKey);
    otpks[otpkIndex.toString()] = cryptoHelper.uint8ArrayToBase64(otpkEnvelope);
  }

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
  downloadButton.prop('href', `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(results))}`)
  downloadButton.prop('download', `accountGenBenchmark-${runs}-${messageSize}-${navigator.userAgent.replace(/[/\\?%*:|"<>]/g, '-')}.json`)
  downloadButton.removeClass('disabled');
  downloadButton[0].click();
}

$('#runBenchmark').on('click', function() {
  $(this).prop('disabled', true);
  benchmarkAccount().then(() => {
    $(this).prop('disabled', false)
  })
})
