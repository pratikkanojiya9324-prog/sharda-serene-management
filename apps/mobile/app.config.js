// Static config lives in app.json; this file only adds what depends on the machine.
// Android push (FCM V1) needs google-services.json from your Firebase project
// (see README, "Push notifications on Android (Firebase)"). It is wired in only when
// the file exists, so builds without it still work (just without Android push).
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const googleServices = path.join(__dirname, 'google-services.json');
  if (fs.existsSync(googleServices)) {
    config.android = { ...config.android, googleServicesFile: './google-services.json' };
  }
  return config;
};
