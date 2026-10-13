"""Loopback-only adapter for the preserved HarvestShield tomato checkpoint."""
import argparse
import base64
import hashlib
import io
import os
import math
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
import sys
import threading
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'ml'))
MAX_IMAGE = 8 * 1024 * 1024
MAX_BODY = 12 * 1024 * 1024
LOCK = threading.Lock()
MODEL = None
MODEL_ERROR = None
MODEL_SHA = None

def initialize():
    global MODEL, MODEL_ERROR, MODEL_SHA
    try:
        import torch
        from inference import HarvestShieldConditionModel
        torch.set_num_threads(2)
        checkpoint = ROOT / 'models/harvestshield_mobilenetv3small_best.pth'
        MODEL_SHA = hashlib.sha256(checkpoint.read_bytes()).hexdigest()
        MODEL = HarvestShieldConditionModel(checkpoint, device='cpu')
        if MODEL.class_to_idx != {'Fresh': 0, 'Rotten': 1}:
            raise ValueError('Checkpoint class order differs from the preserved inference adapter')
        print(f'Tomato model ready: {MODEL_SHA[:16]}', flush=True)
    except Exception as exc:
        MODEL = None
        MODEL_ERROR = str(exc)
        print(f'Model unavailable: {exc}', flush=True)

def predict(payload, model=None, model_sha=None):
    active_model = model if model is not None else MODEL
    checkpoint_sha = model_sha if model_sha is not None else MODEL_SHA
    if active_model is None:
        raise RuntimeError(MODEL_ERROR or 'Tomato model not loaded')
    if payload.get('commodity') != 'tomato':
        raise ValueError('This model accepts tomato images only')
    item_id = payload.get('sourceItemId', '')
    if not isinstance(item_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', item_id):
        raise ValueError('Invalid source item ID')
    if payload.get('mimeType') not in ('image/jpeg', 'image/png', 'image/webp'):
        raise ValueError('Choose a JPEG, PNG or WebP image')
    encoded = payload.get('imageBase64')
    if not isinstance(encoded, str) or len(encoded) > MAX_BODY:
        raise ValueError('Invalid image body')
    try:
        raw = base64.b64decode(encoded, validate=True)
    except Exception as exc:
        raise ValueError('Invalid image encoding') from exc
    if not raw or len(raw) > MAX_IMAGE:
        raise ValueError('Image must be at most 8 MB')
    from PIL import Image, UnidentifiedImageError
    Image.MAX_IMAGE_PIXELS = 20_000_000
    try:
        image = Image.open(io.BytesIO(raw))
        expected = {'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/webp': 'WEBP'}
        if image.format != expected[payload['mimeType']]:
            raise ValueError('Image contents do not match its file type')
        if min(image.size) < 32 or image.width * image.height > 20_000_000:
            raise ValueError('Image dimensions must be at least 32×32 and at most 20 megapixels')
        image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ValueError('The file is not a supported image') from exc
    if not LOCK.acquire(timeout=15):
        raise RuntimeError('The model is busy; try the image again')
    try:
        output = active_model.predict_condition(image)
    finally:
        LOCK.release()
    return {
        'sourceItemId': item_id, 'sourceType': 'REAL_TOMATO_MODEL',
        'sourceLabel': output['source_label'], 'condition': output['condition'],
        'confidence': output['confidence'], 'freshScore': output['fresh_score'],
        'deteriorationScore': output['deterioration_score'],
        'modelVersion': f'mobilenetv3small-{checkpoint_sha[:16]}', 'checkpointSha256': checkpoint_sha,
        'imageSha256': hashlib.sha256(raw).hexdigest(),
        'imageWidth': image.width, 'imageHeight': image.height,
        'inferredAtUtc': datetime.now(timezone.utc).isoformat(),
    }

class Handler(BaseHTTPRequestHandler):
    def respond(self, status, body):
        data = json.dumps(body).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def allowed_origin(self):
        return self.headers.get('Origin') in (None, os.environ.get('HARVESTSHIELD_PUBLIC_ORIGIN'), 'http://127.0.0.1:4173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://localhost:5173')

    def do_GET(self):
        if not self.allowed_origin():
            return self.respond(403, {'error': 'Origin not allowed'})
        if self.path == '/api/inference/health':
            return self.respond(200, {'ready': MODEL is not None, 'sourceType': 'REAL_TOMATO_MODEL', 'checkpointSha256': MODEL_SHA, 'error': MODEL_ERROR})
        self.respond(404, {'error': 'Unknown endpoint'})

    def do_POST(self):
        if not self.allowed_origin():
            # Consume only a bounded declared body before closing the HTTP/1.0
            # connection, so clients receive the complete rejection response.
            try:
                self.connection.settimeout(5)
                length = int(self.headers.get('Content-Length', '0'))
                if 0 < length <= MAX_BODY:
                    self.rfile.read(length)
            except (ValueError, OSError):
                pass
            return self.respond(403, {'error': 'Origin not allowed'})
        if self.path not in ('/api/inference/tomato', '/api/inference/legacy-plan'):
            return self.respond(404, {'error': 'Unknown endpoint'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= MAX_BODY:
                return self.respond(413, {'error': 'Image request exceeds the size limit'})
            if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                return self.respond(415, {'error': 'Expected a JSON image request'})
            self.connection.settimeout(30)
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict):
                raise ValueError('Expected a JSON object')
            if self.path == '/api/inference/legacy-plan':
                sys.path.insert(0, str(ROOT))
                from backend.risk_engine import calculate_risk
                from backend.decision_engine import generate_action_plan
                batches = payload.get('batches')
                capacities = [payload.get('storageKg'), payload.get('truckKg')]
                if not isinstance(batches, list) or not 1 <= len(batches) <= 100 or any(not isinstance(v, (int, float)) or not math.isfinite(v) or not 0 <= v <= 1e6 for v in capacities):
                    raise ValueError('Invalid original-planner inputs')
                prepared = []
                for batch in batches:
                    if not isinstance(batch, dict) or not isinstance(batch.get('quantityKg'), (int, float)) or not math.isfinite(batch['quantityKg']) or not 0 < batch['quantityKg'] <= 1e6:
                        raise ValueError('Invalid original batch quantity')
                    values = [batch.get(k) for k in ('confidence','temperatureC','humidityPct','daysSinceHarvest')]
                    if any(not isinstance(v, (int, float)) or not math.isfinite(v) for v in values):
                        raise ValueError('Known original risk inputs are required')
                    risk = calculate_risk(batch['sourceLabel'], *values)
                    prepared.append({'batch_id':batch['batchId'], 'quantity':batch['quantityKg'], 'risk':risk['risk'], 'risk_score':risk['score'], 'source_label':batch['sourceLabel'], 'days_since_harvest':batch['daysSinceHarvest']})
                self.respond(200, {'source':'UNCHANGED_PYTHON_V0.1', 'plan':generate_action_plan(prepared, *capacities), 'meaning':'Original whole-batch intervention plan; transport does not imply market approval'})
            else:
                self.respond(200, predict(payload))
        except (ValueError, TypeError) as exc:
            self.respond(400, {'error': str(exc)})
        except RuntimeError as exc:
            self.respond(503, {'error': str(exc)})
        except Exception:
            self.respond(500, {'error': 'Model inference failed; no prediction was substituted'})

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=4174)
    args = parser.parse_args()
    initialize()
    print(f'Inference API: http://127.0.0.1:{args.port}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
