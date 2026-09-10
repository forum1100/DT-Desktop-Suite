from pathlib import Path
import json, hashlib

HERE = Path(__file__).resolve().parent
MANIFEST = json.loads((HERE / 'source_manifest.json').read_text(encoding='utf-8'))
ns = {'__name__': '__replay__'}
executed = []
for cell in MANIFEST['cells']:
    path = HERE / cell['file']
    code = path.read_text(encoding='utf-8')
    actual = hashlib.sha256(code.encode()).hexdigest()
    if actual != cell['sha256']:
        raise RuntimeError(f"Source hash mismatch: {cell['file']}")
    exec(compile(code, str(path), 'exec'), ns, ns)
    executed.append({'file': cell['file'], 'sha256': actual})

# The final historical cell leaves df3 in the shared namespace.
if 'df3' not in ns:
    raise RuntimeError('Expected historical final DataFrame df3 was not produced')
records = ns['df3'].to_dict('records')
out = {'source_class': 'REPLAY_OF_VERBATIM_HISTORICAL_EXECUTED_CELLS', 'executed_cells': executed, 'final_records': records}
(HERE / 'replay_result.json').write_text(json.dumps(out, indent=2), encoding='utf-8')
print(json.dumps(records, indent=2))