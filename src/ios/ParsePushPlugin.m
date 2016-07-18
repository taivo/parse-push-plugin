#import "ParsePushPlugin.h"
#import <Cordova/CDV.h>

#import <Parse/Parse.h>

@implementation ParsePushPlugin

@synthesize callbackId;


- (void)pluginInitialize {
    //store userInfo dictionaries if js callback is not yet registered.
    self.pnQueue = [NSMutableArray new];
}

- (void)registerCallback: (CDVInvokedUrlCommand*)command
{
    //
    // Save callbackId to trigger later when PN arrives
    //
    //
    self.callbackId = command.callbackId;
    CDVPluginResult* pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];

    [pluginResult setKeepCallbackAsBool:YES];
    [self.commandDelegate sendPluginResult:pluginResult callbackId:self.callbackId];

    if(self.pnQueue && self.pnQueue.count){
        [self flushPushNotificationQueue];
    }
}

- (void)initialize:(CDVInvokedUrlCommand *)command
{
    CDVPluginResult* pluginResult = nil;   
    
    NSString *shouldInit = [self getConfigForKey:@"ParseAutoRegistration"];
    if ([shouldInit isEqualToString:@"false"]){
        UIUserNotificationType userNotificationTypes = (UIUserNotificationTypeAlert | UIUserNotificationTypeBadge | UIUserNotificationTypeSound);
        UIUserNotificationSettings *settings = [UIUserNotificationSettings settingsForTypes:userNotificationTypes categories:nil];
        [[UIApplication sharedApplication] registerUserNotificationSettings:settings];
        [[UIApplication sharedApplication] registerForRemoteNotifications];
    }
    
    pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void)getInstallationId:(CDVInvokedUrlCommand*) command
{
    [self.commandDelegate runInBackground:^{
        CDVPluginResult* pluginResult = nil;
        PFInstallation *currentInstallation = [PFInstallation currentInstallation];
        NSString *installationId = currentInstallation.installationId;
        pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsString:installationId];
        [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
    }];
}

- (void)getInstallationObjectId:(CDVInvokedUrlCommand*) command
{
    [self.commandDelegate runInBackground:^{
        CDVPluginResult* pluginResult = nil;
        PFInstallation *currentInstallation = [PFInstallation currentInstallation];
        NSString *objectId = currentInstallation.objectId;
        pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsString:objectId];
        [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
    }];
}

- (void)getSubscriptions: (CDVInvokedUrlCommand *)command
{
    NSArray *channels = [PFInstallation currentInstallation].channels;
    CDVPluginResult* pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsArray:channels];
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void)subscribe: (CDVInvokedUrlCommand *)command
{
    // Not sure if this is necessary
    if ([[UIApplication sharedApplication] respondsToSelector:@selector(registerUserNotificationSettings:)]) {
        UIUserNotificationSettings *settings =
        [UIUserNotificationSettings settingsForTypes:UIUserNotificationTypeAlert |
                                                     UIUserNotificationTypeBadge |
                                                     UIUserNotificationTypeSound
                                          categories:nil];
        [[UIApplication sharedApplication] registerUserNotificationSettings:settings];
        [[UIApplication sharedApplication] registerForRemoteNotifications];
    }
    else {
        [[UIApplication sharedApplication] registerForRemoteNotificationTypes:
            UIRemoteNotificationTypeBadge |
            UIRemoteNotificationTypeAlert |
            UIRemoteNotificationTypeSound];
    }

    CDVPluginResult* pluginResult = nil;
    PFInstallation *currentInstallation = [PFInstallation currentInstallation];
    NSString *channel = [command.arguments objectAtIndex:0];
    [currentInstallation addUniqueObject:channel forKey:@"channels"];
    [currentInstallation saveInBackground];
    pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void)unsubscribe: (CDVInvokedUrlCommand *)command
{
    CDVPluginResult* pluginResult = nil;
    PFInstallation *currentInstallation = [PFInstallation currentInstallation];
    NSString *channel = [command.arguments objectAtIndex:0];
    [currentInstallation removeObject:channel forKey:@"channels"];
    [currentInstallation saveInBackground];
    pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void)resetBadge:(CDVInvokedUrlCommand *)command
{
    CDVPluginResult* pluginResult = nil;
    PFInstallation *currentInstallation = [PFInstallation currentInstallation];
    currentInstallation.badge = 0;
    [currentInstallation saveInBackground];
    pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
}

- (void)jsCallback: (NSDictionary*)userInfo withAction: (NSString*)pnAction
{
   //
   // format the pn payload to be just 1 level deep and consistent with other platform versions of this plugin
   NSMutableDictionary* pnPayload = [NSMutableDictionary dictionaryWithDictionary:userInfo];
   [pnPayload addEntriesFromDictionary:pnPayload[@"aps"]];
   [pnPayload removeObjectForKey:@"aps"];

   NSArray* callbackArgs = [NSArray arrayWithObjects:pnPayload, pnAction, nil];
   CDVPluginResult* pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsMultipart:callbackArgs];
   [pluginResult setKeepCallbackAsBool:YES];

   if(self.callbackId){
      [self.commandDelegate sendPluginResult:pluginResult callbackId:self.callbackId];
   } else{
      //
      //callback has not been registered by the js side,
      //queue things up so it can be flushed when js callback is registered.
      //cap queue size at reasonable number
      //
      if(self.pnQueue.count <= 10){
         [self.pnQueue addObject:pluginResult];
      }
   }
}

- (void)flushPushNotificationQueue
{
   while(self.pnQueue && self.pnQueue.count){
      //
      // de-queue the oldest pn and trigger callback
      CDVPluginResult* pluginResult = self.pnQueue[0];
      [self.pnQueue removeObjectAtIndex:0];

      [self.commandDelegate sendPluginResult:pluginResult callbackId:self.callbackId];
   }
}

- (NSString *)getConfigForKey:(NSString *)key
{
   //
   // get config.xml <preference> settings
   //
   return [self.commandDelegate.settings objectForKey:[key lowercaseString]];
}

+ (void)saveDeviceTokenToInstallation: (NSData*)deviceToken
{
   PFInstallation *currentInstallation = [PFInstallation currentInstallation];
   [currentInstallation setDeviceTokenFromData:deviceToken];
   [currentInstallation saveInBackground];
}

@end
