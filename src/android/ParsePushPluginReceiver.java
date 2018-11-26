package github.taivo.parsepushplugin;

import com.parse.ParsePushBroadcastReceiver;
import com.parse.ParseAnalytics;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.app.PendingIntent;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.NotificationChannel;

import github.taivo.parsepushplugin.ParsePushConfigReader;

import android.support.v4.app.NotificationCompat;

import android.net.Uri;
import android.util.Log;

import org.json.JSONObject;
import org.json.JSONException;

import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;

import java.util.List;
import java.util.Random;

import android.content.SharedPreferences;

import me.leolin.shortcutbadger.ShortcutBadger;

public class ParsePushPluginReceiver extends ParsePushBroadcastReceiver {
  public static final String LOGTAG = "ParsePushPluginReceiver";
  public static final String RESOURCE_PUSH_ICON_COLOR = "parse_push_icon_color";
  private static final String DEFAULT_CHANNEL_ID = "parse_push";
  private static final String DEFAULT_CHANNEL_TITLE = "Default Channel";

  private static JSONObject MSG_COUNTS = new JSONObject();
  private static int badgeCount = 0;

  private static final String KEY = "badge";

  @Override
  protected void onPushReceive(Context context, Intent intent) {
    if (ParsePushPlugin.isInForeground()) {
      //
      // relay the push notification data to the javascript
      ParsePushPlugin.jsCallback(getPushData(intent));
    } else {
      //
      // only create entry for notification tray if plugin/application is
      // not running in foreground.
      //
      // So first we check if the user has set the configuration to have multiple
      // notifications show in the tray (i.e. set <preference name="ParseMultiNotifications" value="true" />)
      ParsePushConfigReader config = new ParsePushConfigReader(context, null,
          new String[] { "ParseMultiNotifications" });
      String parseMulti = config.get("ParseMultiNotifications");
      if (parseMulti != null && !parseMulti.isEmpty() && parseMulti.equals("true")) {
        // If the user wants multiple notifications in the tray, then we let ParsePushBroadcastReceiver
        // handle it from here
        super.onPushReceive(context, intent);
      }
      else {
        // check if this is a silent notification
        Notification notification = getNotification(context, intent);

        if (notification != null) {
          // use tag + notification id=0 to limit the number of notifications in the tray
          // (older messages with the same tag and notification id will be replaced)
          NotificationManager notifManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
          notifManager.notify(getNotificationTag(context, intent), 0, notification);
        }

        //
        // A user with Android 5.0.1 reports that notif is not created in tray when
        // app is off (not background), trying method described here
        // https://github.com/phonegap/phonegap-plugin-push/issues/211 by @vikasing
        // to see if it works
        //
        intent.addFlags(Intent.FLAG_INCLUDE_STOPPED_PACKAGES);
        setResultCode(Activity.RESULT_OK);
      }
    }
  }

  @Override
  protected void onPushOpen(Context context, Intent intent) {
    JSONObject pnData = getPushData(intent);
    resetCount(getNotificationTag(context, pnData));

    String uriString = pnData.optString("uri");
    Intent activityIntent = uriString.isEmpty() ? new Intent(context, getActivity(context, intent))
        : new Intent(Intent.ACTION_VIEW, Uri.parse(uriString));

    activityIntent.putExtras(intent).addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_NEW_TASK);

    ParseAnalytics.trackAppOpened(intent);

    // allow a urlHash parameter for hash as well as query params.
    // This lets the app know what to do at coldstart by opening a PN.
    // For example: navigate to a specific page of the app
    String urlHash = pnData.optString("urlHash");
    if (urlHash.startsWith("#") || urlHash.startsWith("?")) {
      activityIntent.putExtra("urlHash", urlHash);
    }

    context.startActivity(activityIntent);

    //
    // relay the push notification data to the javascript in case the
    // app is already running when this push is open.
    ParsePushPlugin.jsCallback(getPushData(intent), "OPEN");
  }

  @Override
  protected Notification getNotification(Context context, Intent intent) {
    //
    // Build a notification entry for the tray
    //
    JSONObject pnData = getPushData(intent);
    String pnTag = getNotificationTag(context, pnData);

    Log.d(LOGTAG, "onPushOpen - pnTag: " + pnData);

    Intent cIntent = new Intent(ACTION_PUSH_OPEN);
    Intent dIntent = new Intent(ACTION_PUSH_DELETE);

    cIntent.putExtras(intent).setPackage(context.getPackageName());
    dIntent.putExtras(intent).setPackage(context.getPackageName());

    int contentIntentRequestCode = 0;
    int deleteIntentRequestCode = 0;

    ParsePushConfigReader config = new ParsePushConfigReader(context, null, new String[] { "ParseMultiNotifications" });
    String parseMulti = config.get("ParseMultiNotifications");
    if (parseMulti != null && !parseMulti.isEmpty() && parseMulti.equals("true")) {
      Random random = new Random();
      contentIntentRequestCode = random.nextInt();
      deleteIntentRequestCode = random.nextInt();
    }

    PendingIntent contentIntent = PendingIntent.getBroadcast(context, contentIntentRequestCode, cIntent,
        PendingIntent.FLAG_UPDATE_CURRENT);
    PendingIntent deleteIntent = PendingIntent.getBroadcast(context, deleteIntentRequestCode, dIntent,
        PendingIntent.FLAG_UPDATE_CURRENT);

    int importance = NotificationManager.IMPORTANCE_HIGH;
    NotificationManager notifManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    NotificationChannel mChannel = notifManager.getNotificationChannel(DEFAULT_CHANNEL_ID);

    if (mChannel == null) {
      mChannel = new NotificationChannel(DEFAULT_CHANNEL_ID, DEFAULT_CHANNEL_TITLE, importance);
      mChannel.enableVibration(true);
      notifManager.createNotificationChannel(mChannel);
    }

    NotificationCompat.Builder builder = new NotificationCompat.Builder(context, DEFAULT_CHANNEL_ID);

    // check if this is a silent notification
    boolean isSilent = !pnData.has("title") && !pnData.has("alert");

    if (pnData.has("title")) {
      builder.setTicker(pnData.optString("title")).setContentTitle(pnData.optString("title"));
    } else if (pnData.has("alert")) {
      builder.setTicker(pnTag).setContentTitle(pnTag);
    }

    if (pnData.has("alert")) {
      builder.setContentText(pnData.optString("alert"));
    }

    if (!ParsePushPlugin.isInForeground()) {
      builder.setSound(android.provider.Settings.System.DEFAULT_NOTIFICATION_URI);
    }

    if (pnData.has("badge")) {
      try {
        if (pnData.getString("badge").equals("Increment")) {
          badgeCount += 1;
        }
      } catch (JSONException e) {
        Log.e(LOGTAG, "JSONException while parsing Increment:", e);
      }

      try {
        if (pnData.getInt("badge") >= 0) {
          badgeCount = pnData.getInt("badge");
        }
      } catch (JSONException e) {
        Log.e(LOGTAG, "JSONException while parsing badge:", e);
      }

      setBadge(badgeCount, context);
    }

    builder.setSmallIcon(getSmallIconId(context, intent)).setLargeIcon(getLargeIcon(context, intent))
        .setNumber(nextCount(pnTag)).setContentIntent(contentIntent).setDeleteIntent(deleteIntent).setAutoCancel(true);

    int colorId = context.getResources().getIdentifier(RESOURCE_PUSH_ICON_COLOR, "color", context.getPackageName());
    if (colorId != 0) {
      builder.setColor(context.getResources().getColor(colorId));
    }

    if (!isSilent) {
      return builder.build();
    }

    return null;
  }

  private static JSONObject getPushData(Intent intent) {
    JSONObject pnData = null;
    try {
      pnData = new JSONObject(intent.getStringExtra(KEY_PUSH_DATA));
    } catch (JSONException e) {
      Log.e(LOGTAG, "JSONException while parsing push data:", e);
    } finally {
      return pnData;
    }
  }

  private static String getAppName(Context context) {
    CharSequence appName = context.getPackageManager().getApplicationLabel(context.getApplicationInfo());
    return (String) appName;
  }

  private static String getNotificationTag(Context context, Intent intent) {
    return getPushData(intent).optString("title", getAppName(context));
  }

  private static String getNotificationTag(Context context, JSONObject pnData) {
    return pnData.optString("title", getAppName(context));
  }

  private static int nextCount(String pnTag) {
    try {
      MSG_COUNTS.put(pnTag, MSG_COUNTS.optInt(pnTag, 0) + 1);
    } catch (JSONException e) {
      Log.e(LOGTAG, "JSONException while computing next pn count for tag: [" + pnTag + "]", e);
    } finally {
      return MSG_COUNTS.optInt(pnTag, 0);
    }
  }

  private static void resetCount(String pnTag) {
    try {
      MSG_COUNTS.put(pnTag, 0);
    } catch (JSONException e) {
      Log.e(LOGTAG, "JSONException while resetting pn count for tag: [" + pnTag + "]", e);
    }
  }

  /*
    * Badge Counter methods. This will display badge counters on Samsung and Sony launchers.
    */

  /**
  * Sets the badge of the app icon.
  *
  * @param args
  * The new badge number
  * @param ctx
  * The application context
  */
  public static void setBadge(int badgeCount, Context ctx) {
    int badge = badgeCount;

    saveBadge(badge, ctx);
    ShortcutBadger.applyCount(ctx, badge);
  }

  public static void resetBadge(Context ctx) {
    saveBadge(0, ctx);
    ShortcutBadger.removeCount(ctx);
  }

  private static void saveBadge(int badge, Context ctx) {
    SharedPreferences.Editor editor = getSharedPreferences(ctx).edit();

    editor.putInt(KEY, badge);
    editor.apply();
  }

  private static SharedPreferences getSharedPreferences(Context context) {
    return context.getSharedPreferences(KEY, Context.MODE_PRIVATE);
  }

  public static String getLauncherClassName(Context context) {

    PackageManager pm = context.getPackageManager();

    Intent intent = new Intent(Intent.ACTION_MAIN);
    intent.addCategory(Intent.CATEGORY_LAUNCHER);

    List<ResolveInfo> resolveInfos = pm.queryIntentActivities(intent, 0);
    for (ResolveInfo resolveInfo : resolveInfos) {
      String pkgName = resolveInfo.activityInfo.applicationInfo.packageName;
      if (pkgName.equalsIgnoreCase(context.getPackageName())) {
        String className = resolveInfo.activityInfo.name;
        return className;
      }
    }

    return null;
  }
}
