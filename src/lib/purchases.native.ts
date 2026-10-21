// Purchases on a phone, through RevenueCat, which fronts the App Store and Google Play and
// tells our server (the `revenuecat` edge function) when a subscription starts, renews,
// lapses or is refunded. The app never decides whether someone has Plus; it asks the server
// after a purchase, and the server has heard from RevenueCat by then.
//
// Keys: EXPO_PUBLIC_REVENUECAT_IOS and EXPO_PUBLIC_REVENUECAT_ANDROID, the public SDK keys
// from the RevenueCat dashboard. They are public by design (they can only read the current
// user's own purchases). With neither set, the paywall says Plus is not for sale yet.
import { Linking, Platform } from 'react-native';
import { PLUS_ENTITLEMENT, PLUS_PRODUCT } from './plus';

export type PurchaseOutcome = 'ok' | 'cancelled' | 'unavailable' | 'failed';

let Purchases: any = null;
try { Purchases = require('react-native-purchases').default; } catch { Purchases = null; }

const KEY = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID;
let configured = false;

export function purchasesAvailable(): boolean { return !!Purchases && !!KEY; }

export async function configurePurchases(userId: string): Promise<void> {
  if (!purchasesAvailable()) return;
  try {
    if (!configured) { Purchases.configure({ apiKey: KEY, appUserID: userId }); configured = true; }
    else await Purchases.logIn(userId);
  } catch { /* the paywall reports the store as unavailable */ }
}

function hasPlus(info: any): boolean { return !!info?.entitlements?.active?.[PLUS_ENTITLEMENT]; }

export async function purchasePlus(): Promise<PurchaseOutcome> {
  if (!purchasesAvailable() || !configured) return 'unavailable';
  try {
    const offerings = await Purchases.getOfferings();
    const pkgs: any[] = offerings?.current?.availablePackages ?? [];
    const pkg = pkgs.find(p => p.product?.identifier === PLUS_PRODUCT) ?? offerings?.current?.monthly ?? pkgs[0];
    if (!pkg) return 'unavailable';
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return hasPlus(customerInfo) ? 'ok' : 'failed';
  } catch (e: any) {
    return e?.userCancelled ? 'cancelled' : 'failed';
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (!purchasesAvailable() || !configured) return false;
  try { return hasPlus(await Purchases.restorePurchases()); } catch { return false; }
}

export async function manageSubscription(): Promise<boolean> {
  try {
    const info = configured ? await Purchases.getCustomerInfo().catch(() => null) : null;
    const url = info?.managementURL ?? (Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions');
    await Linking.openURL(url);
    return true;
  } catch { return false; }
}
