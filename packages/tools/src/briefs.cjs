const briefs = {
  librarian: {
    thesis: 'Information should be routed without losing its origin, uncertainty, or failed neighbors.',
    equation: 'Record = source + provenance + status + branch links + residuals',
    observed: 'A later summary can look complete while silently dropping the path that produced it.',
    input: 'Describe the materials, intended goal, and source class so custody and routing can be separated.'
  },
  evaluation: {
    thesis: 'A model or agent should be judged by preserved observable behavior, not by its self-description or the evaluator\'s desired conclusion.',
    equation: 'DT score = sum(weight_i * score_i / 4); pass requires score >= 0.75 and every critical score >= 2',
    observed: 'A fluent answer can look safe while confusing access with permission, dropping contrary evidence, or hiding a failed branch.',
    input: 'Pre-register the prediction and falsifier, score all eight dimensions from 0 to 4, then attach raw evidence, contrary evidence, failed branches, limitations, and any setup-invalidating condition.'
  },
  hallucination: {
    thesis: 'Confidence is not evidence. Truth risk rises when certainty outruns observable support.',
    equation: 'Risk ∝ unsupported certainty + missing sources + hidden authority',
    observed: 'People often accept fluent explanations before checking whether the claimed source exists.',
    input: 'Supply the exact text, sources, authority, and claimed status so each layer can be inspected.'
  },
  evidence: {
    thesis: 'A claim, its source, its interpretation, and its contradictions are distinct nodes.',
    equation: 'Evidence topology = sources ↔ claims ↔ interpretations ↔ contradictions',
    observed: 'Disagreements become clearer when the conflict is mapped instead of flattened into one answer.',
    input: 'Enter each node separately so the tool can preserve the relationships and unresolved conflicts.'
  },
  'branch-retest': {
    thesis: 'Failure is historical evidence, not material to erase when a successor theory appears.',
    equation: 'Successor state = old failure + new basis + frozen prediction + rival + falsifier',
    observed: 'A branch may fail alone yet become detectable beside a missing neighbor.',
    input: 'Name the failed branch and freeze what must happen before running the successor test.'
  },
  equation: {
    thesis: 'An equation is only as meaningful as its variables, units, assumptions, and test boundary.',
    equation: 'C = 1 − Pf/P0',
    observed: 'The same symbols can appear persuasive while representing incompatible quantities.',
    input: 'Enter the expression, declared variables, units, assumptions, and bounded initial/final values.'
  },
  prediction: {
    thesis: 'A prediction must exist before its outcome, with a rival and an invalidation boundary.',
    equation: 'Error = observed outcome − frozen prediction',
    observed: 'Retrofitted predictions hide misses; immutable forecasts make learning possible.',
    input: 'Record baseline, direction, target, invalidation, horizon, confidence, and strongest rival.'
  },
  prism: {
    thesis: 'Authorized defense should expose hostile behavior with synthetic signals while containing impact.',
    equation: 'Defensive readiness = authorization × canary × containment × rollback',
    observed: 'A defensive simulation without one of these controls can cross its own authority boundary.',
    input: 'Define the authorized system, synthetic canary, expected signal, containment, and rollback.'
  },
  propulsion: {
    thesis: 'Propulsion claims remain bounded by momentum, energy, heat, reaction mass, frame, and observables.',
    equation: 'Minimum translational energy = impulse² / (2 × mass)',
    observed: 'An apparent thrust result is incomplete until energy and external momentum paths are accounted for.',
    input: 'Declare the system boundary and frame, then enter compatible mass, energy, impulse, heat, and wake data.'
  },
  civilization: {
    thesis: 'Civilizations can be compared as changing networks of resources, constraints, and institutions.',
    equation: 'Pressure index = constraint count / max(1, resources + institutions)',
    observed: 'A proposed intervention can relieve one bottleneck while creating another elsewhere in the topology.',
    input: 'Describe the boundary, horizon, resources, constraints, institutions, intervention, and rival future.'
  },
  memory: {
    thesis: 'Continuity requires consumer-owned records whose history survives later reinterpretation.',
    equation: 'New record hash = H(previous hash + timestamp + actor + payload)',
    observed: 'Overwriting a record destroys the evidence needed to understand why a later state changed.',
    input: 'Classify the record and source, then preserve the content as a new append-only event.'
  },
  telemetry: {
    thesis: 'An observed runtime number is evidence of a counter, not evidence of an unknown total.',
    equation: 'Initial allocation = remaining + consumed',
    observed: 'Without the consumed amount and weighting formula, a leaked remaining value cannot reveal the total.',
    input: 'Record the exact value, counter type, scope, source, and every field that remains unknown.'
  }
};

module.exports = { briefs };
