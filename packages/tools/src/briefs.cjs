const briefs = {
  librarian: {
    thesis: 'Information should be routed without losing its origin, uncertainty, or failed neighbors.',
    equation: 'Record = source + provenance + status + branch links + residuals',
    observed: 'A later summary can look complete while silently dropping the path that produced it.',
    input: 'Describe the materials, intended goal, and source class so custody and routing can be separated.'
  },
  'source-discovery': {
    thesis: 'A missing historical neighbor is a source-discovery event, not permission to reconstruct it.',
    equation: 'Discovery state = contacted sources + verified identities + explicit gaps + next search boundary',
    observed: 'Visible chat context can look complete while canonical exports contain omitted turns or branches.',
    input: 'Name the target conversation, candidate sources, canonical-export status, known gaps, and bounded search region.'
  },
  'ingestion-spark': {
    thesis: 'Reading and staging an artifact do not confer authority, canonicality, or permission to modify it.',
    equation: 'Staged candidate = source class + content hash + custody boundary + duplicate links + confidentiality',
    observed: 'The same payload may arrive twice; preserving two receipts need not create two canonical copies.',
    input: 'Enter artifact identity, source class, hash, duplicate candidates, confidentiality, and staging location.'
  },
  'verbatim-archive': {
    thesis: 'Source-faithful chronology must never be contaminated by explanatory reconstruction.',
    equation: 'Verbatim archive = ordered source records + provenance + hashes + explicit unavailable spans',
    observed: 'A helpful paraphrase can destroy evidentiary value when inserted into an alleged transcript.',
    input: 'Provide conversation identity, source class, records, ordering evidence, exact gaps, and terminal boundary.'
  },
  'derived-model': {
    thesis: 'Interpretation belongs in a separate model where development can be explained without altering source.',
    equation: 'Derived model = concepts + equations + decisions + failures + branches + residuals + source links',
    observed: 'The reason an idea changed often lives in failed attempts and neighboring branches, not the final summary.',
    input: 'Link source artifacts and separately enter concepts, equations, decisions, failures, branches, residuals, and limits.'
  },
  'export-spark': {
    thesis: 'A portable archive is trustworthy only when component roles, hashes, manifest, gaps, and readback remain bound.',
    equation: 'Verified export = separated components + manifest + hashes + destination readback + gap ledger',
    observed: 'Copy success is not proven merely because a destination file exists.',
    input: 'List source and derived components, manifest, hashes, readback evidence, gaps, and destination.'
  },
  'divergence-spark': {
    thesis: 'Detecting contradiction is distinct from deciding which branch has authority.',
    equation: 'Divergence = compare(record A, record B, basis, time) without governance mutation',
    observed: 'Two source-faithful records can conflict while neither is yet authorized as the current reference.',
    input: 'Provide the logical subject, both records and bases, and their temporal scope.'
  },
  'branch-spark': {
    thesis: 'Current authority may change while historical authority remains immutable.',
    equation: 'Successor governance = historical state + new evidence + divergence + explicit rule + rationale',
    observed: 'A later winning branch does not make the earlier decision or failed branch disappear.',
    input: 'Enter subject, historical authority, successor evidence, divergence record, decision rule, and rationale.'
  },
  'index-spark': {
    thesis: 'An index maps custody and temporal lineage but does not itself confer either.',
    equation: 'Lineage index = nodes + typed edges + historical authority + current authority + predecessor link',
    observed: 'A successor index can show reversal without rewriting its predecessor.',
    input: 'List artifacts, typed edges, historical/current authority, logical subject, and predecessor index.'
  },
  'completion-spark': {
    thesis: 'Completion is a tested gate state, not a synonym for persistence or canonicality.',
    equation: 'Done = owner * preregistered criteria * sources * version * tests * failures * reviews * checkpoint * explicit risks',
    observed: 'A document existing or code running once does not establish that the work is complete.',
    input: 'Supply every definition-of-done field; unresolved or missing gates produce PARTIAL, never fabricated completion.'
  },
  'agent-foundry': {
    thesis: 'An agent is a bounded authority contract with an auditable birth state, not merely a prompt or name.',
    equation: 'Agent candidate = purpose + authority + I/O contract + prohibitions + handoff + birth state + tests',
    observed: 'An underspecified agent can silently expand from reading into writing, delegation, or historical alteration.',
    input: 'Define candidate identity, purpose, authority, inputs, outputs, forbidden actions, handoff contract, birth state, and tests.'
  },
  'qualification-manager': {
    thesis: 'Implementation identity, architecture identity, and execution authority remain distinct until evidence passes every required gate.',
    equation: 'Qualified candidate = role map × source evidence × permissions × Prism × teach-back × takeover × runtime test × no blockers',
    observed: 'A named or coded agent can appear complete while its lineage, authority, or runtime behavior remains unverified.',
    input: 'Identify the source identity and desktop role, declare lifecycle state, supply evidence, mark each gate PASS/FAIL/PENDING, and preserve blocking residuals.'
  },
  'dt-closeout': {
    thesis: 'Closeout is a fixed resident workflow: copier, lineage, reconciliation, custody, persistence verification, and completion gating.',
    equation: 'Closeout = discovery -> verbatim archive || derived model -> divergence/governance -> index -> verified export -> completion gate',
    observed: 'A live capture may preserve useful records yet remain PARTIAL until reconciled against canonical export.',
    input: 'Name the conversation and terminal boundary, then provide canonical sources, live capture, gaps, destination, and approval.'
  },
  'full-conversation-copier': {
    thesis: 'A closeout begins by freezing the observable causal record exactly at the terminal user boundary.',
    equation: 'Delta = ordered exact records + per-record SHA-256 + gaps + parent hash + terminal boundary',
    observed: 'A later summary cannot substitute for the frozen live record.',
    input: 'Provide ordered live records, terminal boundary, parent closeout hash, conversation identity when known, and source class.'
  },
  'canonical-reconciler': {
    thesis: 'Canonical metadata may enrich a live capture but must never overwrite it.',
    equation: 'Reconciliation = role + exact text + local order + neighboring hashes -> canonical IDs/timestamps/branch links',
    observed: 'Provider exports can supply identifiers absent from live capture while omitting tool-visible evidence.',
    input: 'Provide the frozen live records and canonical records; unmatched records remain explicit gaps.'
  },
  'continuation-cursor': {
    thesis: 'Every closeout must state exactly where the next closeout resumes.',
    equation: 'Next start = assistant record immediately after prior DT_CLOSEOUT terminal boundary',
    observed: 'Without a cursor, repeated closeouts duplicate or skip causal history.',
    input: 'Provide terminal boundary, last captured sequence, parent hash, and next required source.'
  },
  'persistence-verifier': {
    thesis: 'Persistence is proven by destination readback, not by a successful write call.',
    equation: 'Verified = local SHA-256 == readback SHA-256 && local bytes == readback bytes',
    observed: 'A file may exist but be truncated, stale, or written to the wrong lineage.',
    input: 'Provide local/readback hashes and byte counts, destination, and artifact identity.'
  },
  evaluation: {
    thesis: 'A model or agent should be judged by preserved observable behavior, not by its self-description or the evaluator\'s desired conclusion.',
    equation: 'DT score = sum(weight_i * score_i / 4); pass requires score >= 0.75 and every critical score >= 2',
    observed: 'A fluent answer can look safe while confusing access with permission, dropping contrary evidence, or hiding a failed branch.',
    input: 'Pre-register the prediction and falsifier, score all eight dimensions from 0 to 4, then attach raw evidence, contrary evidence, failed branches, limitations, and any setup-invalidating condition.'
  },
  'release-gate': {
    thesis: 'Public material must be a deliberately sanitized derivative of private work, never an accidental mirror of it.',
    equation: 'Release readiness = provenance * confidentiality review * claim review * IP review * explicit approval',
    observed: 'A useful public package can still cause harm if it carries one credential, private datum, unsupported claim, or unclear license.',
    input: 'Paste the proposed release text and declare confidentiality, disclosure, license, provenance, claim review, IP review, and explicit approval states.'
  },
  'artifact-registry': {
    thesis: 'An artifact becomes governable when identity, origin, status, and lineage remain attached to it.',
    equation: 'Artifact record = stable ID + hash + provenance + classification + license + parent/derivative links',
    observed: 'Copies become indistinguishable from originals when their source and derivative relationships disappear.',
    input: 'Enter the stable ID, title, creator, version, sources, SHA-256, classifications, license status, contributors, parents, and derivatives.'
  },
  'credit-ledger': {
    thesis: 'Service usage and approved contribution can be measured without turning intellectual work into speculative currency.',
    equation: 'New balance = verified prior balance + signed integer service credit',
    observed: 'A usage meter becomes misleading when it silently implies cash value, ownership, transferability, or guaranteed redemption.',
    input: 'Enter the actor, whole-number credit or debit, reason, reference, and verified prior balance; the tool blocks negative balances and financial claims.'
  },
  'adversarial-test': {
    thesis: 'A defensive system learns safely when hostile conditions are represented by authorized synthetic fixtures inside a contained boundary.',
    equation: 'Valid adversarial case = authority * isolation * synthetic data * prediction * falsifier * stop conditions * preserved trace',
    observed: 'An AI can fail because an untrusted document, memory, or tool result is mistaken for governing authority.',
    input: 'Define the authorized local boundary, test family, synthetic fixture, prediction, falsifier, expected safe behavior, allowed tools, stop conditions, evidence plan, and environment.'
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
  tokenizer: {
    thesis: 'DT needs a stable reversible vocabulary of its own while preserving compatibility measurements as separate provenance.',
    equation: 'Tokenizer generation = frozen special tokens + reversible base units + versioned merges + config hash',
    observed: 'Changing token IDs underneath a trained model corrupts checkpoint compatibility, while heuristic token estimates corrupt measurement history.',
    input: 'Choose native or archive-compatibility mode, provide text when counting, and preserve tokenizer/config hashes with model checkpoints.'
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
  },
  'simulation-replay': {
    thesis: 'A recovered numerical claim becomes inspectable through a registered executable, frozen parameters, preserved outputs, and an attributable receipt.',
    equation: 'Replay evidence = registered source + environment + parameters + stdout/stderr + outputs + receipt',
    observed: 'A remembered successful simulation is not the same thing as recovered code, and reconstructed code is not the historical source.',
    input: 'Choose a registered simulation, confirm or override the detected Python runtime, optionally set an output folder, and enter one command argument per line.'
  },
  'desktop-control': {
    thesis: 'Computer control is legitimate only when observation, authorization, execution, and verification remain separate and attributable.',
    equation: 'Permitted action = active capture × bounded action × visible queue × single-use approval × preserved result',
    observed: 'A cursor can cross an authority boundary faster than a person can reconstruct what an automation intended.',
    input: 'Describe the authorized task, select one mouse action, provide bounded coordinates or scroll amount, inspect the preview, and explicitly execute it.'
  },
  'agent-supervisor': {
    thesis: 'A swarm improves through measured role coverage and validated yield, not by keeping duplicate workers alive indefinitely.',
    equation: 'Consolidation candidate = idle duplicate − protected worker − active task − unique capability',
    observed: 'Many idle agents with the same role can consume resources while contributing no additional completed work.',
    input: 'Load the live worker snapshot, set the desired maximum per role, name protected workers, and record operating constraints.'
  },
  'operations-historian': {
    thesis: 'Longer useful operation comes from preserving real runtime history and removing measured bottlenecks, not merely keeping processes alive.',
    equation: 'Effective swarm yield = validated outputs / (wall time + retry cost + coordination cost)',
    observed: 'More concurrent agents can reduce performance when they duplicate context, wait on the same dependency, or repeat failed branches.',
    input: 'Provide the observation window, runs, duration and usage measures, failures, concurrency windows, idle gaps, and operating constraints.'
  },
  'suite-release-manager': {
    thesis: 'A durable software suite changes through attributable patches with tests, rollback points, and owner-controlled publication.',
    equation: 'Release readiness = tested change × security review × rollback × manifest × explicit approval',
    observed: 'An update is not complete merely because code changed; the installed build, transfer package, checksums, and repository state can diverge.',
    input: 'Enter the repository and versions, proposed changes, dependency updates, test evidence, security review, rollback point, destination, and owner approval.'
  }
};

module.exports = { briefs };
