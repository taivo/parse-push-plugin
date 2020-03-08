//
// Note: use before_plugin_install hook instead of after_plugin_install.
// Cordova generates its own version of AndroidManifest and saves it after the after_plugin_install hook
// so our updates would be overwritten. This is true for Cordova 5.4.1.
//
var DefaultApplicationName = ["github.taivo.parsepushplugin", "ParsePushApplication"].join('.');

module.exports = function(context) {
   var path = require('path');
   var ConfigFile = require("cordova-common").ConfigFile;

   var androidPrjDir = path.join(context.opts.projectRoot, 'platforms/android/app/src/main');
   var androidManifest = new ConfigFile(androidPrjDir, 'android', 'AndroidManifest.xml');

   //
   // set android:name attrib on <application> tag to point to the class that initializes Parse.Push for cold start.
   // Note: preserve user customization and write android:name IFF the attribute doesn't exist.
   //
   var applicationNode = androidManifest.data.find('application');
   if(applicationNode.get('android:name') === undefined){
      applicationNode.set('android:name', DefaultApplicationName);
      androidManifest.save();
   } else{
      console.warn("It looks like your application's android:name has already been set. If you have not set it up for Parse.Push, please refer to the Advanced Configuration section of this plugin's README.");
   }

   return true;
}
