/**
 * Expo config plugin: wire PushKit VoIP + CallKeep in AppDelegate so
 * incoming calls can be reported to CallKit before JS boots (cold start).
 *
 * Supports modern Expo Swift AppDelegate and legacy Obj-C AppDelegate.mm.
 */
const {
  withAppDelegate,
  withEntitlementsPlist,
  withInfoPlist,
  createRunOncePlugin,
} = require('@expo/config-plugins');

const SWIFT_IMPORTS = `import PushKit
import RNVoipPushNotification
import RNCallKeep`;

const SWIFT_VOIP_HELPERS = `
  // MARK: - PushKit VoIP (incoming calls when app is killed)
  private var voipRegistry: PKPushRegistry?

  private func setupVoipPush() {
    let registry = PKPushRegistry(queue: DispatchQueue.main)
    registry.delegate = self
    registry.desiredPushTypes = [.voIP]
    voipRegistry = registry
    RNVoipPushNotificationManager.voipRegistration()
  }
`;

const SWIFT_DELEGATE_METHODS = `
// MARK: - PKPushRegistryDelegate
extension AppDelegate: PKPushRegistryDelegate {
  public func pushRegistry(_ registry: PKPushRegistry, didUpdate credentials: PKPushCredentials, for type: PKPushType) {
    RNVoipPushNotificationManager.didUpdate(credentials, forType: type.rawValue)
  }

  public func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
    // Token invalidated — JS will re-register on next launch.
  }

  public func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType,
    completion: @escaping () -> Void
  ) {
    let dict = payload.dictionaryPayload
    let uuid = (dict["uuid"] as? String) ?? UUID().uuidString.lowercased()
    let callerName = (dict["callerName"] as? String)
      ?? (dict["caller_name"] as? String)
      ?? "LionsGeek user"
    let handle = (dict["handle"] as? String)
      ?? String(describing: dict["call_id"] ?? uuid)
    let callType = (dict["call_type"] as? String) ?? (dict["callType"] as? String) ?? "audio"
    let hasVideo = callType == "video"

    RNVoipPushNotificationManager.addCompletionHandler(uuid, completionHandler: completion)
    RNVoipPushNotificationManager.didReceiveIncomingPush(with: payload, forType: type.rawValue)

    // Apple requires CallKit report before completion() on iOS 13+.
    RNCallKeep.reportNewIncomingCall(
      uuid,
      handle: handle,
      handleType: "generic",
      hasVideo: hasVideo,
      localizedCallerName: callerName,
      fromPushKit: true,
      payload: dict
    )

    completion()
  }
}
`;

function ensureSwiftVoip(contents) {
  let next = contents;

  if (!next.includes('import PushKit')) {
    if (next.includes('import Expo')) {
      next = next.replace('import Expo', `import Expo\n${SWIFT_IMPORTS}`);
    } else if (next.includes('import UIKit')) {
      next = next.replace('import UIKit', `import UIKit\n${SWIFT_IMPORTS}`);
    } else {
      next = `${SWIFT_IMPORTS}\n${next}`;
    }
  }

  if (!next.includes('setupVoipPush()')) {
    // Inject voip registry fields + call from didFinishLaunching
    if (next.includes('var window:')) {
      next = next.replace(
        /var window:[^\n]+\n/,
        (m) => `${m}${SWIFT_VOIP_HELPERS}\n`
      );
    } else if (next.includes('class AppDelegate')) {
      next = next.replace(
        /class AppDelegate[^{]*\{\n/,
        (m) => `${m}${SWIFT_VOIP_HELPERS}\n`
      );
    }

    if (next.includes('didFinishLaunchingWithOptions')) {
      next = next.replace(
        /(didFinishLaunchingWithOptions[^{]*\{\n)/,
        `$1    setupVoipPush()\n`
      );
    }
  }

  if (!next.includes('PKPushRegistryDelegate')) {
    next = `${next.trimEnd()}\n${SWIFT_DELEGATE_METHODS}\n`;
  }

  return next;
}

function ensureObjCVoip(contents) {
  let next = contents;

  if (!next.includes('#import <PushKit/PushKit.h>')) {
    next = next.replace(
      /#import "AppDelegate.h"/,
      `#import "AppDelegate.h"\n#import <PushKit/PushKit.h>\n#import "RNVoipPushNotificationManager.h"\n#import "RNCallKeep.h"`
    );
  }

  if (!next.includes('voipRegistration')) {
    next = next.replace(
      /didFinishLaunchingWithOptions:[\s\S]*?\{/,
      (m) => `${m}\n  [RNVoipPushNotificationManager voipRegistration];`
    );
  }

  if (!next.includes('didReceiveIncomingPushWithPayload')) {
    const methods = `
- (void)pushRegistry:(PKPushRegistry *)registry didUpdatePushCredentials:(PKPushCredentials *)credentials forType:(PKPushType)type {
  [RNVoipPushNotificationManager didUpdatePushCredentials:credentials forType:(NSString *)type];
}

- (void)pushRegistry:(PKPushRegistry *)registry didInvalidatePushTokenForType:(PKPushType)type {
}

- (void)pushRegistry:(PKPushRegistry *)registry didReceiveIncomingPushWithPayload:(PKPushPayload *)payload forType:(PKPushType)type withCompletionHandler:(void (^)(void))completion {
  NSDictionary *dict = payload.dictionaryPayload;
  NSString *uuid = dict[@"uuid"] ?: [[NSUUID UUID] UUIDString].lowercaseString;
  NSString *callerName = dict[@"callerName"] ?: dict[@"caller_name"] ?: @"LionsGeek user";
  NSString *handle = dict[@"handle"] ?: [NSString stringWithFormat:@"%@", dict[@"call_id"] ?: uuid];
  NSString *callType = dict[@"call_type"] ?: dict[@"callType"] ?: @"audio";
  BOOL hasVideo = [callType isEqualToString:@"video"];

  [RNVoipPushNotificationManager addCompletionHandler:uuid completionHandler:completion];
  [RNVoipPushNotificationManager didReceiveIncomingPushWithPayload:payload forType:(NSString *)type];
  [RNCallKeep reportNewIncomingCall:uuid handle:handle handleType:@"generic" hasVideo:hasVideo localizedCallerName:callerName fromPushKit:YES payload:dict];
  completion();
}
`;
    next = next.replace(/\n@end\s*$/, `\n${methods}\n@end\n`);
  }

  return next;
}

const withVoipPushCallKeepAppDelegate = (config) =>
  withAppDelegate(config, (cfg) => {
    const file = cfg.modResults;
    if (file.language === 'swift' || (file.path || '').endsWith('.swift')) {
      file.contents = ensureSwiftVoip(file.contents);
    } else {
      file.contents = ensureObjCVoip(file.contents);
    }
    return cfg;
  });

const withVoipEntitlements = (config) =>
  withEntitlementsPlist(config, (cfg) => {
    cfg.modResults['aps-environment'] =
      cfg.modResults['aps-environment'] || 'production';
    return cfg;
  });

const withVoipInfoPlist = (config) =>
  withInfoPlist(config, (cfg) => {
    const modes = new Set(cfg.modResults.UIBackgroundModes || []);
    modes.add('voip');
    modes.add('audio');
    modes.add('remote-notification');
    cfg.modResults.UIBackgroundModes = Array.from(modes);
    return cfg;
  });

const withVoipPushCallKeep = (config) => {
  config = withVoipInfoPlist(config);
  config = withVoipEntitlements(config);
  config = withVoipPushCallKeepAppDelegate(config);
  return config;
};

module.exports = createRunOncePlugin(
  withVoipPushCallKeep,
  'withVoipPushCallKeep',
  '1.0.0'
);
