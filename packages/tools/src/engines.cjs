function items(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || '').split(/[\n;,]+/).map(v => v.trim()).filter(Boolean);
}

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function evidence(input) {
  const sources = items(input.source || input.sources);
  const contradictions = items(input.contradiction);
  return {
    claim: input.claim || null,
    sources,
    interpretations: items(input.interpretation),
    contradictions,
    evidentiaryStatus: sources.length ? 'SOURCE_ATTACHED_NOT_INDEPENDENTLY_VERIFIED' : 'UNSOURCED',
    topology: {
      sourceCount: sources.length,
      contradictionCount: contradictions.length,
      requiresResolution: contradictions.length > 0
    }
  };
}
function propulsion(input) {
  const mass = numeric(input.mass);
  const impulse = numeric(input.predictedImpulse);
  const inputEnergy = numeric(input.inputEnergy);
  const minimumKineticEnergy = mass > 0 && impulse !== null
    ? (impulse * impulse) / (2 * mass) : null;
  const energyMargin = inputEnergy !== null && minimumKineticEnergy !== null
    ? inputEnergy - minimumKineticEnergy : null;
  const auditFlags = [];
  if (!input.systemBoundary) auditFlags.push('SYSTEM_BOUNDARY_MISSING');
  if (!input.referenceFrame) auditFlags.push('REFERENCE_FRAME_MISSING');
  if (!input.heat) auditFlags.push('HEAT_PATH_UNACCOUNTED');
  if (!input.wake) auditFlags.push('WAKE_OR_REACTION_MASS_UNACCOUNTED');
  if (energyMargin !== null && energyMargin < 0) auditFlags.push('ENERGY_DEFICIT_UNDER_ENTERED_VALUES');
  return {
    calculation: { mass, impulse, inputEnergy, minimumKineticEnergy, energyMargin },
    auditFlags,
    scientificStatus: 'CALCULATION_ONLY_NOT_PHYSICAL_VALIDATION',
    assumptions: ['nonrelativistic translation', 'entered values use mutually compatible SI units']
  };
}
function civilization(input) {
  const resources = items(input.resources);
  const constraints = items(input.constraints);
  const institutions = items(input.institutions);
  const support = resources.length + institutions.length;
  const pressureIndex = constraints.length / Math.max(1, support);
  return {
    topology: { resources, constraints, institutions },
    pressureIndex,
    interpretation: pressureIndex > 1 ? 'CONSTRAINT_HEAVY' : pressureIndex === 1 ? 'BALANCED_COUNT' : 'SUPPORT_HEAVY',
    intervention: input.intervention || null,
    rivalScenario: input.rival || null,
    scientificStatus: 'SCENARIO_HEURISTIC_NOT_FORECAST'
  };
}

function telemetry(input) {
  const required = ['counterType', 'observedValue', 'scope', 'source'];
  const absent = required.filter(key => !String(input[key] || '').trim());
  const unknown = items(input.unknownFields);
  return {
    observation: {
      counterType: input.counterType || null,
      observedValue: input.observedValue || null,
      scope: input.scope || null,
      source: input.source || null
    },
    absent,
    unknown,
    totalRecoverable: absent.length === 0 && !unknown.some(v => /initial|consumed|weight/i.test(v)),
    inferenceBoundary: 'NO_TOTAL_DERIVED_WITHOUT_INITIAL_ALLOCATION_OR_CONSUMPTION'
  };
}
function prism(input) {
  const checks = {
    authorizedBoundary: Boolean(String(input.authorizedBoundary || '').trim()),
    syntheticCanary: Boolean(String(input.syntheticCanary || '').trim()),
    containment: Boolean(String(input.containment || '').trim()),
    rollback: Boolean(String(input.rollback || '').trim())
  };
  const missingControls = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  return {
    checks,
    missingControls,
    runPermitted: missingControls.length === 0,
    mode: 'AUTHORIZED_SYNTHETIC_DEFENSE_ONLY',
    activeIntrusionOrCredentialCapturePermitted: false,
    resultClass: missingControls.length ? 'INCOMPLETE_PREFLIGHT' : 'READY_FOR_LOCAL_SYNTHETIC_TEST'
  };
}

function librarian(input) {
  const text = (String(input.materials || '') + ' ' + String(input.goal || '')).toLowerCase();
  const routes = [];
  if (/claim|source|evidence|contradict/.test(text)) routes.push('evidence');
  if (/fail|branch|retest|successor/.test(text)) routes.push('branch-retest');
  if (/equation|variable|unit|calculate/.test(text)) routes.push('equation');
  if (/propulsion|thrust|impulse|energy/.test(text)) routes.push('propulsion');
  if (/civilization|institution|resource|collapse/.test(text)) routes.push('civilization');
  if (/hallucin|unsupported|certainty/.test(text)) routes.push('hallucination');
  return {
    sourceClass: input.sourceClass || 'UNCLASSIFIED',
    candidateRoutes: [...new Set(routes)],
    nextStep: routes.length ? 'Open ' + routes[0] + ' and preserve the original source.' : 'Classify the source and state one falsifiable goal.',
    canonicalizationPermitted: false
  };
}
function memory(input) {
  return {
    recordType: input.recordType || null,
    sourceClass: input.sourceClass || 'UNCLASSIFIED',
    preservation: 'APPEND_ONLY',
    contentPresent: Boolean(String(input.content || '').trim()),
    note: 'Vault receipt is created by the desktop runtime after this engine returns.'
  };
}

const engines = { evidence, propulsion, civilization, telemetry, prism, librarian, memory };

function runEngine(agentId, input) {
  return engines[agentId] ? engines[agentId](input) : {};
}

module.exports = { runEngine, engines, items, numeric };
