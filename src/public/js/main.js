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
