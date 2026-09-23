const DESKTOP_STORAGE_POLICY = Object.freeze({
  id: 'DT_DESKTOP_HOME_SERVER',
  persistence: 'DURABLE_BY_DEFAULT',
  closeDeletesUserData: false,
  windowCloseKeepsKernelResident: true,
  exportImportOptional: true,
  deletionRequiresExplicitAuthenticatedAction: true,
  intendedRole: 'HOUSEHOLD_SYSTEM_OF_RECORD'
});

const WEBSITE_STORAGE_POLICY = Object.freeze({
  id: 'DT_WEBSITE_EPHEMERAL_CLIENT',
  persistence: 'MINIMIZED_CLIENT_STATE',
  closeDeletesSensitiveSessionData: true,
  serverOfRecord: false,
  intendedRole: 'REMOTE_CLIENT_SURFACE'
});

module.exports = { DESKTOP_STORAGE_POLICY, WEBSITE_STORAGE_POLICY };
