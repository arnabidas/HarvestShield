import unittest
import types
from pathlib import Path
from unittest.mock import patch

from streamlit.testing.v1 import AppTest

ROOT = Path(__file__).resolve().parents[1]


def batch(batch_id, days, quantity=100):
    return dict(
        batch_id=batch_id, quantity=quantity, temperature=30.0,
        humidity=70.0, days_since_harvest=days, source_label='Fresh',
        model_confidence=0.9, risk='HIGH', risk_score=70,
        preliminary_action='PRIORITIZE FOR OPERATOR REVIEW', risk_reasons=[],
    )


class DashboardIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.app = AppTest.from_file(str(ROOT / 'app.py'), default_timeout=60).run()
        self.app.session_state['batches'] = [
            batch('young', 2), batch('older-small', 6, 50), batch('older-large', 6, 100)
        ]

    def page(self, name):
        self.app.sidebar.radio[0].set_value(name).run()
        self.assertFalse(self.app.exception)

    def click(self, label):
        next(b for b in self.app.button if b.label == label).click().run()
        self.assertFalse(self.app.exception)
        self.assertFalse(self.app.error)

    def simulate(self):
        self.page('Capacity Simulator')
        self.click('Compare capacity scenarios')
        self.assertIn('simulation_results', self.app.session_state)

    def test_dashboard_ranking_matches_planner_ties(self):
        self.page('Batch Intelligence')
        displayed = list(self.app.dataframe[0].value['Batch'])
        self.page('Resource Planner')
        self.click('Generate Action Plan')
        planned = [b['batch_id'] for b in self.app.session_state['action_plan']['plan']]
        self.assertEqual(displayed, planned)
        self.page('Overview')
        # Before allocation, the overview must use the same priority order.
        self.app.session_state['action_plan'] = None
        self.app.run()
        cards = [m.value for m in self.app.markdown if '<div class="hs-priority-head">' in m.value]
        self.assertEqual(len(cards), 3)
        for card, expected in zip(cards, planned):
            self.assertIn(expected, card)

    def test_clear_batches_invalidates_simulator(self):
        self.simulate()
        self.click('Clear all batches')
        self.assertNotIn('simulation_results', self.app.session_state)

    def test_scenario_changes_invalidate_results(self):
        self.simulate()
        self.app.number_input(key='sim_transport').set_value(0.0).run()
        self.assertNotIn('simulation_results', self.app.session_state)
        self.click('Compare capacity scenarios')
        self.assertEqual(self.app.session_state['simulation_results'][1]['remaining_transport'], 0)

    def test_planner_changes_invalidate_simulator(self):
        self.simulate()
        self.page('Resource Planner')
        next(n for n in self.app.number_input if n.label == 'Available transport (kg)').set_value(0.0)
        self.click('Generate Action Plan')
        self.page('Capacity Simulator')
        self.assertNotIn('simulation_results', self.app.session_state)

    def test_batch_replacement_invalidates_simulator(self):
        self.simulate()
        self.app.session_state['batches'] = [batch('replacement', 10)]
        self.app.run()
        self.assertNotIn('simulation_results', self.app.session_state)

    def test_all_pages_with_no_batches(self):
        self.app.session_state['batches'] = []
        for name in self.app.sidebar.radio[0].options:
            with self.subTest(page=name):
                self.page(name)
                self.assertFalse(self.app.error)
        self.page('Analyze Batch')
        next(b for b in self.app.button if b.label == 'Analyze Batch').click().run()
        self.assertFalse(self.app.exception)
        self.assertEqual(self.app.error[0].value, 'Please upload a tomato image.')


class ImportCompatibilityTests(unittest.TestCase):
    def test_dashboard_ignores_cached_legacy_decision_module(self):
        # A long-running server may retain the module from before rank_batches
        # existed. Package imports must not resolve to that bare module.
        legacy = types.ModuleType('decision_engine')
        with patch.dict('sys.modules', {'decision_engine': legacy}):
            app = AppTest.from_file(str(ROOT / 'app.py'), default_timeout=60).run()
            self.assertFalse(app.exception, [e.message for e in app.exception])
            self.assertFalse(app.error)
            from backend.harvestshield_backend import HarvestShieldBackend
            from backend.decision_engine import generate_action_plan
            backend = HarvestShieldBackend(ROOT)
            self.assertIs(backend.generate_action_plan_engine, generate_action_plan)


if __name__ == '__main__':
    unittest.main()
