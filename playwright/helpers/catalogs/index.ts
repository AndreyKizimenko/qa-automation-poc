// Barrel for app-store catalogs (FMA, VPP, Android).
// Tests import shape:
//
//   import { fmaApps, vppApps, vppUiSearchNames, androidApps } from '../../helpers/catalogs';
//
// API tests pick (id + platform) entries; UI search tests use vppUiSearchNames.

export * from "./types";
export { fmaApps } from "./fma";
export { vppApps, vppUiSearchNames } from "./vpp";
export { androidApps } from "./android";
