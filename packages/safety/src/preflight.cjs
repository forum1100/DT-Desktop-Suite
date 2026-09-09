const GUARANTEES = /\b(guaranteed|certainly true|cannot fail|proven fact|zero risk)\b/i;
const HIGH_STAKES = /\b(buy|sell|diagnose|legal conclusion|weapon|exploit|credential)\b/i;

function preflight({ text = '', sources = [], status = 'experimental', authority = 'consumer' }) {
  const flags = [];
  if (GUARANTEES.test(text)) flags.push({ code: 'UNSUPPORTED_CERTAINTY', severity: 'high' });
  if (HIGH_STAKES.test(text)) flags.push({ code: 'HIGH_STAKES_REVIEW', severity: 'high' });
  if (!sources.length) flags.push({ code: 'NO_SOURCES', severity: 'medium' });
  if (!status) flags.push({ code: 'STATUS_MISSING', severity: 'high' });
  if (!authority) flags.push({ code: 'AUTHORITY_MISSING', severity: 'high' });
  return {
    heuristic: true,
    mayCertifyTruth: false,
    status,
    authority,
    flags,
    promotionAllowed: !flags.some(flag => flag.severity === 'high')
  };
}
module.exports = { preflight };
