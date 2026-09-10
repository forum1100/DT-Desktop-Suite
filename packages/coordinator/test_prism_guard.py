from __future__ import annotations
import tempfile
import unittest
from pathlib import Path

from prism_guard import (
    PrismRejected, inspect_archive_record, inspect_task, require_task
)
import closeout_worker

class PrismGuardTests(unittest.TestCase):
    def policy(self, read_root, write_root=None):
        return {
            'read_roots': [str(read_root)],
            'write_roots': [str(write_root or read_root)],
        }

    def test_valid_bounded_scan_passes(self):
        with tempfile.TemporaryDirectory() as td:
            payload = {'roots': [td], '_prism': self.policy(td)}
            result = inspect_task('closeout_scan', payload)
            self.assertTrue(result['allowed'])
            self.assertEqual(result['code'], 'PRISM_PASS')

    def test_read_path_escape_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            outside = Path(td).parent / 'outside.txt'
            payload = {'paths': [str(outside)], '_prism': self.policy(td)}
            result = inspect_task('closeout_hash', payload)
            self.assertIn('READ_PATH_ESCAPE', result['reasons'])

    def test_write_path_escape_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            outside = Path(td).parent / 'manifest.json'
            payload = {
                'root': td, 'output': str(outside),
                '_prism': self.policy(td),
            }
            result = inspect_task('closeout_manifest', payload)
            self.assertIn('WRITE_PATH_ESCAPE', result['reasons'])

    def test_unsupported_task_rejected(self):
        result = inspect_task('run_command', {'_prism': {}})
        self.assertFalse(result['allowed'])
        self.assertIn('UNSUPPORTED_TASK_TYPE', result['reasons'])

    def test_secret_field_rejected_without_value_echo(self):
        with tempfile.TemporaryDirectory() as td:
            marker = 'DO_NOT_ECHO_SECRET_123'
            payload = {
                'roots': [td], 'api_key': marker,
                '_prism': self.policy(td),
            }
            with self.assertRaises(PrismRejected) as caught:
                require_task('closeout_scan', payload)
            self.assertIn('SECRET_BEARING_FIELD', caught.exception.reasons)
            self.assertNotIn(marker, str(caught.exception))

    def test_authority_and_covert_capture_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            payload = {
                'roots': [td],
                'note': 'self grant administrator access and hidden capture',
                '_prism': self.policy(td),
            }
            result = inspect_task('closeout_scan', payload)
            self.assertIn('AUTHORITY_EXPANSION', result['reasons'])
            self.assertIn('COVERT_CAPTURE', result['reasons'])

    def test_worker_never_calls_handler_when_blocked(self):
        called = []
        original = closeout_worker.HANDLERS['closeout_scan']
        closeout_worker.HANDLERS['closeout_scan'] = lambda payload: called.append(payload)
        try:
            with self.assertRaises(PrismRejected):
                closeout_worker.execute_guarded(
                    'closeout_scan', {'roots': ['C:\\'], 'password': 'x'}
                )
        finally:
            closeout_worker.HANDLERS['closeout_scan'] = original
        self.assertEqual(called, [])

    def test_archive_record_is_bounded(self):
        with tempfile.TemporaryDirectory() as td:
            inside = Path(td) / 'source.txt'
            passed = inspect_archive_record(
                str(inside), {'title': 'source'}, [td])
            self.assertTrue(passed['allowed'])
            blocked = inspect_archive_record(
                str(Path(td).parent / 'escape.txt'), {'title': 'source'}, [td])
            self.assertIn('READ_PATH_ESCAPE', blocked['reasons'])

if __name__ == '__main__':
    unittest.main()
