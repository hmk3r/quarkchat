const socket = io();
socket.on('socket_id', (socketId) => {
  console.log('Socket ID: ', socketId);
})

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

if (!localStorage.getItem('performance-disclaimer-dismiss')) {
  toastr.info(
    `As this is an experiment, the application monitors how long it
    takes to execute code which involves post-quantum cryptography.
    You can click on this message to hide it permanently.`,
    'Performance data collection',
    {
      'timeOut': '0',
      'extendedTimeOut': '0',
      'onclick': () => localStorage.setItem('performance-disclaimer-dismiss', 'true'),
      'onCloseClick': () => localStorage.setItem('performance-disclaimer-dismiss', 'true')
    });  
}


;(async () => {
  const privateKey = await accountStorage.getItem(constants.PRIVATE_KEY_DB_FIELD);
  const publicKey = await accountStorage.getItem(constants.PUBLIC_KEY_DB_FIELD);
  const username = await accountStorage.getItem(constants.USERNAME_DB_FIELD);
  const hasPks = await pkStorage.length() > 0;
  const hasOtpks = await otpkStorage.length() > 0;

  if (privateKey && publicKey && username && hasPks && hasOtpks) {
    $('#content').load('/html/messenger.html')
  } else {
    $('#registerSegment').attr('style','margin-bottom: 0');
    bootstrapRegisterPage();
  }
  
})();
