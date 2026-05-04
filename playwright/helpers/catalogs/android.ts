import type { AndroidApp } from "./types";

// Managed Google Play apps available for testing the "Add Android app" API + GitOps flows.
export const androidApps: AndroidApp[] = [
  { appStoreId: "com.openai.chatgpt", platform: "android" },
  { appStoreId: "com.zhiliaoapp.musically", platform: "android" },
  { appStoreId: "com.instagram.android", platform: "android" },
  { appStoreId: "com.netflix.mediaclient", platform: "android" },
  { appStoreId: "com.sand.aircast", platform: "android" },
  { appStoreId: "com.sand.remotesupportaddon", platform: "android" },
  { appStoreId: "com.sand.airdroid", platform: "android" },
  { appStoreId: "com.alltrails.alltrails", platform: "android" },
];
