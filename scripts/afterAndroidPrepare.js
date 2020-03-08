module.exports = function (context) {
  var fs = require('fs');
  var path = require('path');
  var ET = require('elementtree');
  var ConfigFile = require("cordova-common").ConfigFile;

  var configXml = new ConfigFile(context.opts.projectRoot, null, './config.xml');

  // find the meta-data node in AndroidManifest.xml
  var androidPrjDir = path.join(context.opts.projectRoot, 'platforms/android/app/src/main');
  var androidManifest = new ConfigFile(androidPrjDir, 'android', 'AndroidManifest.xml');
  var applicationNode = androidManifest.data.find('application');

  // detect Parse notification icon
  var parsePushNotificationIcon = configXml.data.find('preference[@name="ParseNotificationIcon"]').get('value');
  if (!!parsePushNotificationIcon) {
    // add to AndroidManifest.xml
    var manifestPushNotificationIconNode = applicationNode.find('meta-data[@android:name="com.parse.push.notification_icon"]');

    if (!manifestPushNotificationIconNode) {
      manifestPushNotificationIconNode = new ET.Element('meta-data', { 'android:name': 'com.parse.push.notification_icon' });
      applicationNode.append(manifestPushNotificationIconNode);
    }
    manifestPushNotificationIconNode.set('android:resource', '@drawable/' + parsePushNotificationIcon);

    // COPY ICON
    // create target path
    var iconTargetPath = path.join(context.opts.projectRoot, 'platforms', 'android', 'app', 'src', 'main', 'res', 'drawable');
    try {
      fs.mkdirSync(iconTargetPath);
    } catch (err) {
      // Directory already exists
    }

    // copy icon to android folder
    fs
      .createReadStream(path.join(context.opts.projectRoot, 'resources', parsePushNotificationIcon + '.png'))
      .pipe(fs.createWriteStream(path.join(iconTargetPath, parsePushNotificationIcon + '.png')));
  }

  // Copy gcm sender id from config.xml into AndroidManifest
  // detect parse.com or parse-server mode
  var parseServerUrl = configXml.data.find('preference[@name="ParseServerUrl"]').get('value');

  if (parseServerUrl.toUpperCase() !== "PARSE_DOT_COM") {
    //opensource parse-server requires own GcmSenderId, so copy it from config.xml to AndroidManifest
    var configXmlGcmIdNode = configXml.data.find('preference[@name="ParseGcmSenderId"]');
    if (!configXmlGcmIdNode) {
      console.error("ParseGcmSenderId is not set in config.xml");
      return false;
    }

    var manifestGcmIdNode = applicationNode.find('meta-data[@android:name="com.parse.push.gcm_sender_id"]');

    if (!manifestGcmIdNode) {
      manifestGcmIdNode = new ET.Element('meta-data', { 'android:name': 'com.parse.push.gcm_sender_id' });
      applicationNode.append(manifestGcmIdNode);
    }

    manifestGcmIdNode.set('android:value', 'id:' + configXmlGcmIdNode.get('value'));
  }


  androidManifest.save();

  return true;
}
