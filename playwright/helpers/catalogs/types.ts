// Shared types for app-store catalogs (FMA, VPP, Android).
// Catalog entries identify an app; tests layer on flow-specific flags
// (self_service, setup_experience, ...) when constructing the request.

export type ApplePlatform = "darwin" | "ios" | "ipados";
export type FmaPlatform = "darwin" | "windows";
export type Platform = ApplePlatform | "windows" | "android";

export interface FmaApp {
  // Slug Fleet uses to identify a Fleet-Maintained App, e.g. "1password/darwin".
  // Always includes the platform suffix.
  slug: string;
  platform: FmaPlatform;
}

export interface VppApp {
  // Human-readable name as it appears in the App Store.
  name: string;
  // Apple App Store numeric ID (string to preserve leading zeros and JSON shape).
  appStoreId: string;
  platform: ApplePlatform;
}

export interface AndroidApp {
  // Managed Google Play package name, e.g. "com.openai.chatgpt".
  appStoreId: string;
  platform: "android";
}
