var serviceName = 'ParsePushPlugin';

//
// establish an exec bridge so native code can call javascript
// when a PN event occurs
//
var eventSubscriberStarted = false;
var eventSubscriber = function() {
  if (eventSubscriberStarted) {
    return;
  }
  require('cordova/channel').onCordovaReady.subscribe(function() {
  	var jsCallback = function(pn, pushAction) {
  		if(pn !== null){
  			if(pushAction === 'OPEN'){
  				 //
  				 // trigger a callback when user click open a notification.
  				 // One usecase for this pertains a cordova app that is already running in the background.
  				 // Relaying a push OPEN action, allows the app to resume and use javascript to navigate
  				 // to a different screen.
  				 //
  				 ParsePushPlugin.trigger(ParsePushPlugin._openEvent, pn);
  			 } else{
  				 //
  				 //an eventKey can be registered with the register() function to trigger
  				 //additional javascript callbacks when a notification is received.
  				 //This helps modularizes notification handling for different aspects
  				 //of your javascript app, e.g., receivePN:chat, receivePN:system, etc.
  				 //
  				 var base = ParsePushPlugin._receiveEvent;
  				 var customEventKey = ParsePushPlugin._customEventKey;
  				 
  				 ParsePushPlugin.trigger(base, pn);
  				 if(customEventKey && pn[customEventKey]){
  					 ParsePushPlugin.trigger(base + ':' + pn[customEventKey], pn);
  				 }
  			 }
  		}
     };
     
     require('cordova/exec')(jsCallback, null, serviceName, 'registerCallback', []);
     eventSubscriberStarted = true;
  });
};

var ParsePushPlugin = {
	 _openEvent: 'openPN',
	 _receiveEvent: 'receivePN',
	 _customEventKey: 'event', //default key for custom events associated with each PN, set this to anything you see fit
	 
    getInstallationId: function(successCb, errorCb) {
       cordova.exec(successCb, errorCb, serviceName, 'getInstallationId', []);
    },

    getInstallationObjectId: function(successCb, errorCb) {
       cordova.exec(successCb, errorCb, serviceName, 'getInstallationObjectId', []);
    },

    getSubscriptions: function(successCb, errorCb) {
       cordova.exec(successCb, errorCb, serviceName, 'getSubscriptions', []);
    },

    subscribe: function(channel, successCb, errorCb) {
       cordova.exec(successCb, errorCb, serviceName, 'subscribe', [ channel ]);
    },

    unsubscribe: function(channel, successCb, errorCb) {
       cordova.exec(successCb, errorCb, serviceName, 'unsubscribe', [ channel ]);
    }
};

//
// give ParsePushPlugin event handling capability so we can use it to trigger
// push notification onReceive events
function poorManExtend(object, source){
	object || (object = {});
	
	for (var prop in source) {
	    if(source.hasOwnProperty(prop)) {
	       object[prop] = source[prop];
	    }
	}
	return object;
}

var eventSplitter = /\s+/;
var slice = Array.prototype.slice;
var EventMixin = {
	on: function(events, callback, context) {

      var calls, event, node, tail, list;
      if (!callback) {
        return this;
      }
      events = events.split(eventSplitter);
      calls = this._callbacks || (this._callbacks = {});

      // Create an immutable callback list, allowing traversal during
      // modification.  The tail is an empty object that will always be used
      // as the next node.
      event = events.shift();
      while (event) {
        list = calls[event];
        node = list ? list.tail : {};
        node.next = tail = {};
        node.context = context;
        node.callback = callback;
        calls[event] = {tail: tail, next: list ? list.next : node};
        event = events.shift();
      }
      
      eventSubscriber();

      return this;
    },

    /**
     * Remove one or many callbacks. If `context` is null, removes all callbacks
     * with that function. If `callback` is null, removes all callbacks for the
     * event. If `events` is null, removes all bound callbacks for all events.
     */
    off: function(events, callback, context) {
      var event, calls, node, tail, cb, ctx;

      // No events, or removing *all* events.
      if (!(calls = this._callbacks)) {
        return;
      }
      if (!(events || callback || context)) {
        delete this._callbacks;
        return this;
      }

      // Loop through the listed events and contexts, splicing them out of the
      // linked list of callbacks if appropriate.
      events = events ? events.split(eventSplitter) : Object.keys(calls);
      event = events.shift();
      while (event) {
        node = calls[event];
        delete calls[event];
        if (!node || !(callback || context)) {
          event = events.shift();
          continue;
        }
        // Create a new list, omitting the indicated callbacks.
        tail = node.tail;
        node = node.next;
        while (node !== tail) {
          cb = node.callback;
          ctx = node.context;
          if ((callback && cb !== callback) || (context && ctx !== context)) {
            this.on(event, cb, ctx);
          }
          node = node.next;
        }
        event = events.shift();
      }

      return this;
    },

    /**
     * Trigger one or many events, firing all bound callbacks. Callbacks are
     * passed the same arguments as `trigger` is, apart from the event name
     * (unless you're listening on `"all"`, which will cause your callback to
     * receive the true name of the event as the first argument).
     */
    trigger: function(events) {
      var event, node, calls, tail, args, all, rest;
      if (!(calls = this._callbacks)) {
        return this;
      }
      all = calls.all;
      events = events.split(eventSplitter);
      rest = slice.call(arguments, 1);

      // For each event, walk through the linked list of callbacks twice,
      // first to trigger the event, then to trigger any `"all"` callbacks.
      event = events.shift();
      while (event) {
        node = calls[event];
        if (node) {
          tail = node.tail;
          while ((node = node.next) !== tail) {
            node.callback.apply(node.context || this, rest);
          }
        }
        node = all;
        if (node) {
          tail = node.tail;
          args = [event].concat(rest);
          while ((node = node.next) !== tail) {
            node.callback.apply(node.context || this, args);
          }
        }
        event = events.shift();
      }

      return this;
    }
};

module.exports = poorManExtend(ParsePushPlugin, EventMixin);
