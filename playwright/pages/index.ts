// Components (cross-cutting UI widgets)
export { Navbar } from './components/Navbar';
export { DataTable } from './components/DataTable';
export { ContentList } from './components/ContentList';
export { CertificatesCard } from './components/CertificatesCard';
export { RunScriptModal } from './components/RunScriptModal';
export type { RunScriptStatus } from './components/RunScriptModal';
export { ScriptDetailsModal } from './components/ScriptDetailsModal';
export { MdmCommandDetailsModal } from './components/MdmCommandDetailsModal';
export { HostSoftwareLibrary } from './components/HostSoftwareLibrary';
export type { LibraryInstallAction, LibraryUninstallAction } from './components/HostSoftwareLibrary';
export { InstallDetailsModal, UninstallDetailsModal } from './components/SoftwareActionDetailsModal';
export { FilterModal } from './components/FilterModal';
export { Pagination } from './components/Pagination';
export { TeamDropdown } from './components/TeamDropdown';
export type { TeamScope } from './components/TeamDropdown';
export { PlatformDropdown } from './components/PlatformDropdown';
export type { AppStorePlatformLabel } from './components/PlatformDropdown';
export { StatusFilter } from './components/StatusFilter';
export { LabelFilter } from './components/LabelFilter';
export { CommandPalette } from './components/CommandPalette';
export { EditAppearanceModal } from './components/EditAppearanceModal';
export { EditSoftwareModal, normalizeScript } from './components/EditSoftwareModal';
export { VersionsModal, pinTargetLabel, pinTargetApiValue } from './components/VersionsModal';
export type { PinTarget } from './components/VersionsModal';
export { clickHoverAction } from './components/clickHoverAction';
export { EnrollSecretModal } from './components/EnrollSecretModal';
export {
  expectGatedByGitOps,
  expectNotGatedByGitOps,
  expectGitOpsTooltip,
  gitopsWrapperFor,
  gitopsWrappers,
} from './components/gitopsMode';
export type { GitOpsDisabledStyle, GitOpsGateOptions } from './components/gitopsMode';

// Auth
export { LoginPage } from './auth/LoginPage';
export { ForgotPasswordPage } from './auth/ForgotPasswordPage';

// Account
export { MyAccountPage } from './account';

// Dashboard (its own top-level nav entry)
export { DashboardPage } from './DashboardPage';
export type { ChartDatasetLabel, DashboardPlatformLabel } from './DashboardPage';

// Hosts
export { HostsListPage } from './hosts/HostsListPage';
export { HostDetailsPage } from './hosts/HostDetailsPage';
export { HostQueryReportPage } from './hosts/HostQueryReportPage';

// Software + vulnerabilities
export { SoftwareTitlesPage } from './software/SoftwareTitlesPage';
export { SoftwareLibraryPage } from './software/SoftwareLibraryPage';
export { SoftwareVersionsPage } from './software/SoftwareVersionsPage';
export { SoftwareTitleDetailPage } from './software/SoftwareTitleDetailPage';
export type { SoftwareTitleAction } from './software/SoftwareTitleDetailPage';
export { SoftwareVersionDetailPage } from './software/SoftwareVersionDetailPage';
export { SoftwareOsPage } from './software/SoftwareOsPage';
export { SoftwareOsDetailPage } from './software/SoftwareOsDetailPage';
export { VulnerabilitiesListPage } from './software/VulnerabilitiesListPage';
export { CveDetailPage } from './software/CveDetailPage';
export { FleetMaintainedAppsPage } from './software/FleetMaintainedAppsPage';
export { FleetMaintainedAppDetailPage } from './software/FleetMaintainedAppDetailPage';
export { SoftwareCustomPackagePage } from './software/SoftwareCustomPackagePage';
export { SoftwareAppStoreVppPage } from './software/SoftwareAppStoreVppPage';
export type { VppPlatformLabel } from './software/SoftwareAppStoreVppPage';
export { SoftwareAppStoreAndroidPage } from './software/SoftwareAppStoreAndroidPage';

// Controls
export { ControlsPage } from './controls/ControlsPage';
export { OsUpdatesPage } from './controls/OsUpdatesPage';
export { OsSettingsPage } from './controls/OsSettingsPage';
export { DiskEncryptionPage } from './controls/DiskEncryptionPage';
export type { DiskEncryptionPlatform } from './controls/DiskEncryptionPage';
export { ConfigurationProfilesPage } from './controls/ConfigurationProfilesPage';
export { CertificatesPage } from './controls/CertificatesPage';
export { InstallSoftwarePage } from './controls/InstallSoftwarePage';
export type { InstallSoftwarePlatform } from './controls/InstallSoftwarePage';
export { ScriptsLibraryPage } from './controls/ScriptsLibraryPage';
export { ScriptsBatchProgressPage } from './controls/ScriptsBatchProgressPage';
export { VariablesPage } from './controls/VariablesPage';
export { BootstrapPackagePage } from './controls/BootstrapPackagePage';
export { SetupExperiencePage } from './controls/SetupExperiencePage';
export { RunScriptPage } from './controls/RunScriptPage';
export { SetupExperienceUsersPage } from './controls/SetupExperienceUsersPage';
export { SetupAssistantPage } from './controls/SetupAssistantPage';

// Reports
export { ReportsListPage } from './reports/ReportsListPage';
export { ReportEditPage } from './reports/ReportEditPage';
export type {
  ReportFormValues,
  ReportInterval,
  ReportPlatform,
  SaveReportValues,
} from './reports/ReportEditPage';
export { ReportDetailsPage } from './reports/ReportDetailsPage';
export type { ReportDetailsValues } from './reports/ReportDetailsPage';
export { ReportLivePage } from './reports/ReportLivePage';

// Policies
export { PoliciesListPage } from './policies/PoliciesListPage';
export { PolicyEditPage } from './policies/PolicyEditPage';
export type {
  PolicyFormValues,
  PolicyPlatform,
  PolicyTargetType,
  SavePolicyValues,
} from './policies/PolicyEditPage';
export { PolicyDetailsPage } from './policies/PolicyDetailsPage';
export type { PolicyDetailsValues } from './policies/PolicyDetailsPage';

// Labels
export { LabelsPage } from './labels/LabelsPage';

// Packs
export { PacksListPage } from './packs/PacksListPage';
export { PackEditPage } from './packs/PackEditPage';

// Settings
export { OrganizationInfoPage } from './settings/OrganizationInfoPage';
export { OrganizationAdvancedPage } from './settings/OrganizationAdvancedPage';
export { IntegrationsPage } from './settings/IntegrationsPage';
export { ChangeManagementPage } from './settings/ChangeManagementPage';
export { TeamSettingsPage } from './settings/TeamSettingsPage';
export {
  UsersPage,
  CreateUserPage,
  CreateApiUserPage,
  EditUserPage,
  UserFormFields,
} from './settings/users';
export type { AddUserOption, RowAction, GlobalRole, ApiGlobalRole } from './settings/users';
