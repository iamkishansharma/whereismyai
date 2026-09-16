import UIKit
import React_RCTAppDelegate
import RNBootSplash

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory
    else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window

    // startReactNative installs the root view controller and calls
    // makeKeyAndVisible on the window itself.
    factory.startReactNative(
      withModuleName: "whereismyai",
      in: window,
      launchOptions: appDelegate.launchOptions
    )

    // iOS tears the launch storyboard down once the window is visible. This
    // re-shows it inside the root view until JS has loaded; without it the app
    // opens on a white root view and BootSplash.hide() has nothing to hide.
    RNBootSplash.initWithStoryboard("BootSplash", rootView: window.rootViewController?.view)
  }
}
