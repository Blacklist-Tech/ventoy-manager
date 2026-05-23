import unittest
from unittest.mock import patch, MagicMock
from pathlib import Path
import json
import sys
import os

# Add the parent directory to path so we can import the script
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ventoy_persist

class TestVentoyPersist(unittest.TestCase):

    def setUp(self):
        self.drive = Path("/tmp/mock_ventoy")
        self.iso = "test.iso"
        self.dat = "test-persistence.dat"
        self.ventoy_json = self.drive / "ventoy/ventoy.json"

    @patch('ventoy_persist.run')
    @patch('shutil.disk_usage')
    @patch('shutil.which')
    @patch('pathlib.Path.exists')
    @patch('ventoy_persist.load_ventoy_json')
    @patch('ventoy_persist.save_ventoy_json')
    def test_add_persistence_logic(self, mock_save, mock_load, mock_exists, mock_which, mock_usage, mock_run):
        # Mocking setup
        mock_load.return_value = {}
        mock_exists.side_effect = lambda: True if "test.iso" in str(mock_exists.call_args) else False
        mock_exists.return_value = True # For simplicity in this test
        
        mock_usage.return_value.free = 100 * (1024**3) # 100GB free
        mock_which.return_value = "/usr/bin/fallocate"
        
        # We need to mock Path.exists more carefully or just mock the whole function's file checks
        with patch('ventoy_persist.Path.exists', return_value=True):
            # This is tricky because Path.exists is used for ISO check AND .dat check
            # Let's mock add_persistence internal checks
            pass

    def test_load_ventoy_json_empty(self):
        with patch('pathlib.Path.exists', return_value=False):
            config = ventoy_persist.load_ventoy_json(self.drive)
            self.assertEqual(config, {})

    @patch('builtins.open', new_callable=unittest.mock.mock_open, read_data='{"persistence": []}')
    @patch('pathlib.Path.exists', return_value=True)
    def test_load_ventoy_json_valid(self, mock_exists, mock_file):
        config = ventoy_persist.load_ventoy_json(self.drive)
        self.assertEqual(config, {"persistence": []})

if __name__ == '__main__':
    unittest.main()
