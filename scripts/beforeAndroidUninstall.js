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
   // because the user may have customized <application> android:name, remove it IFF it is the default name
   //
   var applicationNode = androidManifest.data.find('application');
   if(applicationNode.get('android:name') === DefaultApplicationName){
      delete applicationNode.attrib['android:name'];
      androidManifest.is_changed = true;
   }

   //
   // Remove the <meta-data android:name="com.parse.push.gcm_sender_id" />
   // We changed it via after_prepare hook so cordova doesn't know to remove it automatically
   //
   var manifestGcmIdNodes = androidManifest.data.findall('application/meta-data[@android:name="com.parse.push.gcm_sender_id"]');
   manifestGcmIdNodes.forEach(function(node){
      applicationNode.remove(node);
      androidManifest.is_changed = true;
   })

   if(androidManifest.is_changed){
      androidManifest.save();
   }

   return true;
}
