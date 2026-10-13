"""Streamlit transport for the uploaded simulator, using the existing model."""
import hashlib
import math
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components

from scripts.inference_server import predict

ROOT = Path(__file__).resolve().parents[1]
machine = components.declare_component('harvestshield_machine', path=str(ROOT / 'simulator' / 'dist'))


@st.cache_data
def checkpoint_sha():
    return hashlib.sha256((ROOT / 'models' / 'harvestshield_mobilenetv3small_best.pth').read_bytes()).hexdigest()


def handle_request(request, backend):
    """Allow only simulator inference/legacy comparison, never arbitrary URLs."""
    reply = {'id': request.get('id'), 'status': 200, 'body': None}
    try:
        method, path = request.get('method'), request.get('path')
        body = request.get('body')
        if method == 'GET' and path == '/api/session':
            result = {'mode': 'LOCAL_DEMO', 'authenticated': True, 'role': 'operator'}
        elif method == 'GET' and path == '/api/inference/health':
            result = {'ready': True, 'sourceType': 'REAL_TOMATO_MODEL', 'checkpointSha256': checkpoint_sha()}
        elif method == 'POST' and path == '/api/inference/tomato':
            if not isinstance(body, dict):
                raise ValueError('Expected an image request')
            result = predict(body, model=backend.condition_model, model_sha=checkpoint_sha())
        elif method == 'POST' and path == '/api/inference/legacy-plan':
            if not isinstance(body, dict):
                raise ValueError('Expected planner inputs')
            batches = body.get('batches')
            capacities = [body.get('storageKg'), body.get('truckKg')]
            if not isinstance(batches, list) or not 1 <= len(batches) <= 100:
                raise ValueError('Supply 1–100 batches')
            def valid_number(value, low, high):
                return type(value) in (int, float) and math.isfinite(value) and low <= value <= high
            if not all(valid_number(v, 0, 1e6) for v in capacities):
                raise ValueError('Invalid resource capacities')
            prepared = []
            for batch in batches:
                if not isinstance(batch, dict) or not valid_number(batch.get('quantityKg'), 0.001, 1e6):
                    raise ValueError('Invalid batch quantity')
                values = [batch.get(k) for k in ('confidence', 'temperatureC', 'humidityPct', 'daysSinceHarvest')]
                if not all(type(v) in (int, float) and math.isfinite(v) for v in values):
                    raise ValueError('Known finite risk inputs are required')
                risk = backend.calculate_risk(batch['sourceLabel'], *values)
                prepared.append({
                    'batch_id': batch['batchId'], 'quantity': batch['quantityKg'],
                    'risk': risk['risk'], 'risk_score': risk['score'],
                    'source_label': batch['sourceLabel'], 'days_since_harvest': batch['daysSinceHarvest'],
                })
            result = {
                'source': 'UNCHANGED_PYTHON_V0.1',
                'plan': backend.generate_action_plan_engine(prepared, *capacities),
                'meaning': 'Original whole-batch intervention plan; transport does not imply market approval',
            }
        else:
            reply.update(status=404, body={'error': 'Unsupported simulator endpoint'})
            return reply
        reply['body'] = result
    except (ValueError, TypeError, KeyError) as exc:
        reply.update(status=400, body={'error': str(exc)})
    except RuntimeError:
        reply.update(status=503, body={'error': 'Model is busy or unavailable; no prediction was substituted'})
    except Exception:
        reply.update(status=500, body={'error': 'Simulator request failed; no prediction was substituted'})
    return reply


def render_simulator(backend):
    state = st.session_state
    request = machine(reply=state.get('machine_reply'), key='machine_simulator', default=None)
    if isinstance(request, dict) and isinstance(request.get('id'), str):
        if state.get('machine_reply', {}).get('id') != request['id']:
            state.machine_reply = handle_request(request, backend)
            st.rerun()
