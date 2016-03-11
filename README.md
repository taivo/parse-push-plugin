Phonegap Parse.com Plugin
=========================

Phonegap 3.x plugin for Parse.com push service.

[Parse.com's](http://parse.com) Javascript API has no mechanism to register a device for or receive push notifications, which
makes it fairly useless for PN in Phonegap/Cordova. This plugin bridges the gap by leveraging native Parse.com SDKs
to register/receive PNs and allow a few essential methods to be accessible from Javascript.

* Phonegap/Cordova > 3.0.0. 
* Android Parse SDK v1.10.1 with or without GCM. 
* iOS Parse SDK v1.11.0

How Is This Fork Different?
--------------------------

**API**

This plugin can handle cold start. It uses the following JS API to give access to native services:

* **getInstallationId**( successCB, errorCB )
* **getSubscriptions**( successCB, errorCB )
* **subscribe**( channel, successCB, errorCB )
* **unsubscribe**( channel, successCB, errorCB )
* **resetBadge**( successCB, errorCB )

ParsePushPlugin makes these notification events available: `openPN, receivePN, receivePN:customEvt`. 
To handle notification events in JS, do this:

```javascript
ParsePushPlugin.on('receivePN', function(pn){
	console.log('yo i got this push notification:' + JSON.stringify(pn));
});

//customEvt can be any string of your choosing, i.e., chat, system, upvote, etc.
ParsePushPlugin.on('receivePN:chat', function(pn){
	console.log('yo i can also use custom event to keep things like chat modularized');
});

ParsePushPlugin.on('openPN', function(pn){
	//you can do things like navigating to a different view here
	console.log('Yo, I get this when the user clicks open a notification from the tray');
});
```



**Multiple notifications**

Android: to prevent flooding the notification tray, this plugin retains only the last PN with the same `title` field.
For messages without the `title` field, the application name is used. A count of unopened PNs is shown.

iOS: iOS handles the notification tray.


**Foreground vs. Background**

Android: Only add an entry to the notification tray if the application is not running in foreground.
The actual PN payload is always forwarded to your javascript when it is received.

iOS: Forward the PN payload to javascript in foreground mode. When app inactive or in background, iOS
holds PNs in the tray. Only when the user opens these PNs would we have access and forward them to javascript.


**Navigate to a specific view when user opens a notification**

Simply add a `urlHash` field in your PN payload that contains either a url hash, i.e. #myhash,
or a url parameter string, i.e. ?param1=a&param2=b. If your app is already running, you can always
handle page transition via javascript.

```javascript
ParsePushPlugin.on('openPN', function(pn){
	if(pn.urlHash){
		window.location.hash = hash;
	}
});
```

Android: If `urlHash` starts with "#" or "?", this plugin will pass it along as an extra in the 
android intent to launch your MainActivity. For the cold start case, you can change your initial url
in  `MainActivity.onCreate()`:

```java
@Override
public void onCreate(Bundle savedInstanceState)
{
    //
    // your code...
    //

    String urlHash = intent.hasExtra("urlHash") ? intent.getStringExtra("urlHash") : "";
    loadUrl(launchUrl + urlHash);
}
```

iOS: ... haven't tried yet but probably should be handled in `AppDelegate.didReceiveRemoteNotification`


Installation
------------

For both Android and iOS, run

```
cordova plugin add https://github.com/taivo/parse-push-plugin
```


####Android Setup:
Phonegap/Cordova doesn't define a custom `android.app.Application`, it only defines an android `Activity`. With an `Activity` alone,
we should be able to receive PNs just fine while our app is running. However, if a PN arrives when the app is not running,
the app will be automatically invoked, and this plugin's `ParsePushPluginReceiver` runs before the `Activity` class or any javascript code
gets a chance to call `Parse.initialize()`. The result is a crash dialog. To fix this, do the following:

1. Define a custom Application class that calls `Parse.initialize()` in its `onCreate` method. This way, the Parse
subsystem gets initialized before the PN-handling code runs. Crash avoided. In your application's Java source path,
e.g., `platforms/android/src/com/example/app`, create a file named MainApplication.java and define it this way
    ```java
    package com.example.app;  //REPLACE THIS WITH YOUR package name

    import android.app.Application;
    import com.parse.Parse;
    import com.parse.ParseInstallation;

    public class MainApplication extends Application {
	    @Override
        public void onCreate() {
            super.onCreate();
            Parse.initialize(this, "YOUR_PARSE_APPID", "YOUR_PARSE_CLIENT_KEY");
            ParseInstallation.getCurrentInstallation().saveInBackground();
        }
    }
    ```
2. Now register MainApplication in AndroidManifest.xml so it's used instead of the default.
In the `<application>` tag, add the attribute `android:name="MainApplication"`. Obviously, you don't have
to name your application class this way, but you have to use the same name in 1 and 2.

3. Optional. To customize background color for the push notification icon in Android Lollipop, go to
your `platforms/android/res/values` folder and create a file named `colors.xml`. Paste the following
content in it and replace the hex color value of the form `#AARRGGBB` to your liking.

    ```xml
	<?xml version="1.0" encoding="utf-8"?>
    <resources>
        <color name="parse_push_icon_color">#ff112233</color>
    </resources>
    ```


####Android Without GCM support:
If you only care about GCM devices, you're good to go. Move on to the [Usage](#usage) section.

The setup above is not enough for non-GCM devices. To support them, `ParseBroadcastReceiver`
must be setup to work properly. This receiver takes care of establishing a persistent
connection that will handle PNs without GCM. Follow these steps for `ParseBroadcastReceiver` setup:

1. Add the following to your AndroidManifest.xml, inside the `<application>` tag
    ```xml
    <receiver android:name="com.parse.ParseBroadcastReceiver">
       <intent-filter>
          <action android:name="android.intent.action.BOOT_COMPLETED" />
          <action android:name="android.intent.action.USER_PRESENT" />
       </intent-filter>
    </receiver>
    ```

2. Add the following permission to AndroidManifest.xml, as a sibling of the `<application>` tag
    ```xml
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    ```

####iOS Setup:

1. Create your SSL push certificates with Apple and configure them in your Parse.com app. 
There is a tutorial [here](https://github.com/ParsePlatform/PushTutorial/tree/master/iOS) that you may find useful. All the steps
prior to adding code to your iOS application are applicable.

2. To initialize Parse.com and configure push, open `platforms/ios/ProjectName/Classes/AppDelegate.m` and add the `Parse/Parse.h` header as well as code to the following function. Cordova should have defined the function
for you already so search for it first.

```objective-c
#import <Parse/Parse.h>

- (BOOL)application:(UIApplication*)application didFinishLaunchingWithOptions:(NSDictionary*)launchOptions
{
	//
	// Stuff already defined by Cordova
	//
    
    //
    // Initialize Parse
    [Parse setApplicationId:@"YOUR_PARSE_APPID" clientKey:@"YOUR_PARSE_CLIENT_KEY"];
    
    //
    // Basic notification config, left as cut-and-paste instead of part of plugin code for easy customization
    UIUserNotificationType userNotificationTypes = (UIUserNotificationTypeAlert | UIUserNotificationTypeBadge | UIUserNotificationTypeSound);
    UIUserNotificationSettings *settings = [UIUserNotificationSettings settingsForTypes:userNotificationTypes categories:nil];
    [application registerUserNotificationSettings:settings];
    [application registerForRemoteNotifications];

    return YES;
}
```




Usage
-----

When your app starts, ParsePushPlugin automatically obtains and stores necessary device tokens to your native `ParseInstallation`. 
This plugin also registers a javascript callback that will be triggered when a push notification is received or opened on the native side.
This setup enables the following simple API and event handling.

**API**


```javascript
ParsePushPlugin.getInstallationId(function(id) {
    alert(id);
}, function(e) {
    alert('error');
});

ParsePushPlugin.getSubscriptions(function(subscriptions) {
    alert(subscriptions);
}, function(e) {
    alert('error');
});

ParsePushPlugin.subscribe('SampleChannel', function(msg) {
    alert('OK');
}, function(e) {
    alert('error');
});

ParsePushPlugin.unsubscribe('SampleChannel', function(msg) {
    alert('OK');
}, function(e) {
    alert('error');
});
```


**Receiving push notifications**

Anywhere in your code, you can set a listener for notification events using the ParsePushPlugin object (it extends Parse.Events).
```javascript
if(window.ParsePushPlugin){
	ParsePushPlugin.on('receivePN', function(pn){
		alert('yo i got this push notification:' + JSON.stringify(pn));
	});

	//
	//you can also listen to your own custom subevents
	//
	ParsePushPlugin.on('receivePN:chat', chatEventHandler);
	ParsePushPlugin.on('receivePN:serverMaintenance', serverMaintenanceHandler);
}
```


**Silent Notifications**

For Android, a silent notification can be sent by omitting the `title` and `alert` fields in the
JSON payload. This means the push notification will not be shown in the system tray, but its JSON
payload will still be delivered to your `receivePN` and `receivePN:customEvt` handlers.


**Troubleshooting**
Android: Starting with the Parse Android SDK v1.10.1 update, your app may crash at start and the log says
something about a missing method in OkHttpClient. Just update the cordova libs of your project
via `cordova platform update android`. If your previous cordova libs are old, you may run into
further compilation errors that has to do with the new cordova libs setting your android target
to be 22 or higher. Look at file `platforms/android/project.properties` and make sure that is
consistent with your `config.xml`

iOS: This plugin takes advantage of the `cordova.exec` bridge. If calls to `cordova.exec` only gets triggered
after pressing your device's Home button, try inspecting your Content-Security-Policy. Your `frame-src` must allow
`gap:` because the cordova bridge on iOS works via Iframe.