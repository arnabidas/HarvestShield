import base64
import hashlib
import unittest
from pathlib import Path

import torch

from backend.harvestshield_backend import HarvestShieldBackend
from backend.simulator_component import handle_request

ROOT = Path(__file__).resolve().parents[1]


class SimulatorBridgeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(2)
        cls.backend = HarvestShieldBackend(ROOT)

    def request(self, path, body=None, method='POST'):
        return handle_request({'id': 'test', 'method': method, 'path': path, 'body': body}, self.backend)

    def test_real_photo_matches_preserved_checkpoint(self):
        path = ROOT / 'simulator/public/samples/red-tomato.jpg'
        raw = path.read_bytes()
        reply = self.request('/api/inference/tomato', {
            'sourceItemId': 'UPLOAD-C01-L01-I01', 'commodity': 'tomato',
            'mimeType': 'image/jpeg', 'imageBase64': base64.b64encode(raw).decode(),
        })
        self.assertEqual(reply['status'], 200)
        actual = self.backend.condition_model.predict_condition(path)
        evidence = reply['body']
        self.assertEqual(evidence['sourceLabel'], actual['source_label'])
        self.assertEqual(evidence['confidence'], actual['confidence'])
        self.assertEqual(evidence['sourceType'], 'REAL_TOMATO_MODEL')
        self.assertEqual(evidence['imageSha256'], hashlib.sha256(raw).hexdigest())

    def test_bad_image_returns_error_without_substituting_prediction(self):
        reply = self.request('/api/inference/tomato', {
            'sourceItemId': 'test', 'commodity': 'tomato', 'mimeType': 'image/jpeg', 'imageBase64': 'invalid',
        })
        self.assertEqual(reply['status'], 400)
        self.assertIn('error', reply['body'])
        self.assertNotIn('confidence', reply['body'])

    def test_legacy_comparison_uses_original_python_engines(self):
        batch = {'batchId': 'test', 'quantityKg': 100, 'sourceLabel': 'Rotten',
                 'confidence': .9, 'temperatureC': 30, 'humidityPct': 70, 'daysSinceHarvest': 5}
        reply = self.request('/api/inference/legacy-plan', {'batches': [batch], 'storageKg': 150, 'truckKg': 200})
        self.assertEqual(reply['status'], 200)
        risk = self.backend.calculate_risk('Rotten', .9, 30, 70, 5)
        expected = self.backend.generate_action_plan_engine([
            {'batch_id': 'test', 'quantity': 100, 'risk': risk['risk'], 'risk_score': risk['score'],
             'source_label': 'Rotten', 'days_since_harvest': 5}], 150, 200)
        self.assertEqual(reply['body']['plan'], expected)

    def test_invalid_capacities_and_arbitrary_urls_are_rejected(self):
        self.assertEqual(self.request('/api/inference/legacy-plan', {
            'batches': [{}], 'storageKg': float('nan'), 'truckKg': 200})['status'], 400)
        self.assertEqual(self.request('https://example.com')['status'], 404)
        self.assertEqual(self.request('/api/operator/action')['status'], 404)

    def test_hosted_session_is_explicitly_demo_mode(self):
        reply = self.request('/api/session', method='GET')
        self.assertEqual(reply['body']['mode'], 'LOCAL_DEMO')
        self.assertEqual(reply['status'], 200)
