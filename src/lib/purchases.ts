// Purchases on the web, and the shape every platform shares. There is no store on the
// web, so everything here says so; the native file beside it (purchases.native.ts) talks
// to RevenueCat, which fronts the App Store and Google Play.
export type PurchaseOutcome = 'ok' | 'cancelled' | 'unavailable' | 'failed';

export function purchasesAvailable(): boolean { return false; }
export async function configurePurchases(_userId: string): Promise<void> { /* no store on the web */ }
export async function purchasePlus(): Promise<PurchaseOutcome> { return 'unavailable'; }
export async function restorePurchases(): Promise<boolean> { return false; }
// The store's own subscription management page, when there is one.
export async function manageSubscription(): Promise<boolean> { return false; }
