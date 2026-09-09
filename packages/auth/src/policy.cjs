const ADMIN_SCOPES = Object.freeze([
  'agent:list', 'agent:invoke', 'agent:message',
  'automation:create', 'automation:run', 'automation:revoke',
  'key:issue', 'key:rotate', 'key:revoke',
  'provider:configure', 'provider:request',
  'vault:read', 'vault:append', 'vault:export',
  'release:review'
]);

function isOwner(profile, authenticatedGithubLogin) {
  return Boolean(profile?.githubLogin && profile.githubLogin === authenticatedGithubLogin);
}

function ownerBootstrap(keys, profile) {
  return keys.issue({
    label: `owner:${profile.githubLogin}`,
    scopes: [...ADMIN_SCOPES]
  });
}

module.exports = { ADMIN_SCOPES, isOwner, ownerBootstrap };
