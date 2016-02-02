#import <Cordova/CDV.h>
#import "AppDelegate.h"

@interface ParsePushPlugin: CDVPlugin

@property (nonatomic, copy) NSString* callbackId;
@property (nonatomic, retain) NSMutableArray* pnQueue;

//
// methods exposed to JS
- (void)registerCallback: (CDVInvokedUrlCommand*)command;

- (void)getInstallationId: (CDVInvokedUrlCommand*)command;
- (void)getInstallationObjectId: (CDVInvokedUrlCommand*)command;

- (void)getSubscriptions: (CDVInvokedUrlCommand *)command;
- (void)subscribe: (CDVInvokedUrlCommand *)command;
- (void)unsubscribe: (CDVInvokedUrlCommand *)command;

//
// methods internal to plugin
- (void)pluginInitialize;
- (void)jsCallback: (NSDictionary*)userInfo withAction: (NSString*)pnAction;
+ (void)saveDeviceTokenToInstallation: (NSData*)deviceToken;
@end

