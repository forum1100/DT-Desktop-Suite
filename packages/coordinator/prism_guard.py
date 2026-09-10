from __future__ import annotations
import json
import re
from pathlib import Path

ALLOWED_TASKS = {
    'closeout_hash', 'closeout_scan', 'closeout_slice', 'closeout_manifest'
}
SECRET_KEYS = re.compile(
    r'(api[_-]?key|password|passwd|secret|access[_-]?token|private[_-]?key)',
    re.IGNORECASE,
)
SECRET_VALUES = re.compile(
    r'(-----BEGIN [A-Z ]*PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+/=-]{8,})',
    re.IGNORECASE,
)
AUTHORITY_TERMS = (
    'self grant', 'self-promote', 'subdelegate', 'unrestricted access',
    'administrator access', 'perpetual permission', 'bypass approval',
)
COVERT_TERMS = (
    'covert capture', 'hidden capture', 'record without consent',
    'background screen recording', 'silent screen capture',
)

class PrismRejected(ValueError):
    def __init__(self, reasons):
        self.reasons = tuple(sorted(set(reasons)))
        super().__init__('PRISM_REJECTED: ' + ','.join(self.reasons))

def _resolve(raw):
    return Path(str(raw)).expanduser().resolve(strict=False)

def _under(path, roots):
    return any(path == root or root in path.parents for root in roots)

def _scan_sensitive(value, reasons):
    if isinstance(value, dict):
        for key, child in value.items():
            if SECRET_KEYS.search(str(key)):
                reasons.append('SECRET_BEARING_FIELD')
            else:
                _scan_sensitive(child, reasons)
    elif isinstance(value, (list, tuple)):
        for child in value:
            _scan_sensitive(child, reasons)
    elif isinstance(value, str) and SECRET_VALUES.search(value):
        reasons.append('SECRET_BEARING_VALUE')
def _task_paths(task_type, payload):
    reads, writes = [], []
    if task_type == 'closeout_hash':
        reads.extend(payload.get('paths', []))
    elif task_type == 'closeout_scan':
        reads.extend(payload.get('roots', []))
    elif task_type == 'closeout_slice':
        reads.append(payload.get('source'))
        writes.append(payload.get('output'))
    elif task_type == 'closeout_manifest':
        reads.append(payload.get('root'))
        writes.append(payload.get('output'))
    return [x for x in reads if x], [x for x in writes if x]

def inspect_task(task_type, payload):
    reasons = []
    if task_type not in ALLOWED_TASKS:
        reasons.append('UNSUPPORTED_TASK_TYPE')
    if not isinstance(payload, dict):
        return {'allowed': False, 'code': 'PRISM_REJECTED',
                'reasons': ['INVALID_PAYLOAD']}
    _scan_sensitive(payload, reasons)
    rendered = json.dumps(payload, sort_keys=True, default=str).lower()
    if any(term in rendered for term in AUTHORITY_TERMS):
        reasons.append('AUTHORITY_EXPANSION')
    if any(term in rendered for term in COVERT_TERMS):
        reasons.append('COVERT_CAPTURE')
    policy = payload.get('_prism')
    if not isinstance(policy, dict):
        reasons.append('MISSING_PRISM_POLICY')
        policy = {}
    read_roots = [_resolve(x) for x in policy.get('read_roots', [])]
    write_roots = [_resolve(x) for x in policy.get('write_roots', [])]
    if not read_roots:
        reasons.append('MISSING_READ_ROOT')
    reads, writes = _task_paths(task_type, payload)
    for raw in reads:
        if not _under(_resolve(raw), read_roots):
            reasons.append('READ_PATH_ESCAPE')
    for raw in writes:
        if not write_roots:
            reasons.append('MISSING_WRITE_ROOT')
        elif not _under(_resolve(raw), write_roots):
            reasons.append('WRITE_PATH_ESCAPE')
    return {
        'allowed': not reasons,
        'code': 'PRISM_PASS' if not reasons else 'PRISM_REJECTED',
        'reasons': sorted(set(reasons)),
        'task_type': task_type if task_type in ALLOWED_TASKS else 'REDACTED',
    }

def require_task(task_type, payload):
    result = inspect_task(task_type, payload)
    if not result['allowed']:
        raise PrismRejected(result['reasons'])
    return result
def inspect_archive_record(locator, metadata, allowed_roots):
    reasons = []
    _scan_sensitive(metadata, reasons)
    rendered = json.dumps(metadata, sort_keys=True, default=str).lower()
    if any(term in rendered for term in AUTHORITY_TERMS):
        reasons.append('AUTHORITY_EXPANSION')
    if any(term in rendered for term in COVERT_TERMS):
        reasons.append('COVERT_CAPTURE')
    roots = [_resolve(x) for x in (allowed_roots or [])]
    if not roots:
        reasons.append('MISSING_READ_ROOT')
    elif not _under(_resolve(locator), roots):
        reasons.append('READ_PATH_ESCAPE')
    return {
        'allowed': not reasons,
        'code': 'PRISM_PASS' if not reasons else 'PRISM_REJECTED',
        'reasons': sorted(set(reasons)),
    }

def require_archive_record(locator, metadata, allowed_roots):
    result = inspect_archive_record(locator, metadata, allowed_roots)
    if not result['allowed']:
        raise PrismRejected(result['reasons'])
    return result
