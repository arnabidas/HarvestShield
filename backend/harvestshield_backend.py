
from pathlib import Path
import sys


class HarvestShieldBackend:

    def __init__(self, base_dir):

        self.base_dir = Path(base_dir)

        self.ml_dir = (
            self.base_dir / "ml"
        )

        self.backend_dir = (
            self.base_dir / "backend"
        )

        self.model_path = (
            self.base_dir
            / "models"
            / "harvestshield_mobilenetv3small_best.pth"
        )

        # Make project modules importable
        if str(self.ml_dir) not in sys.path:
            sys.path.insert(
                0,
                str(self.ml_dir)
            )

        if str(self.backend_dir) not in sys.path:
            sys.path.insert(
                0,
                str(self.backend_dir)
            )

        from inference import (
            HarvestShieldConditionModel
        )

        from risk_engine import (
            calculate_risk
        )

        from decision_engine import (
            generate_action_plan
        )

        self.calculate_risk = (
            calculate_risk
        )

        self.generate_action_plan_engine = (
            generate_action_plan
        )

        self.condition_model = (
            HarvestShieldConditionModel(
                self.model_path
            )
        )


    # ========================================================
    # ANALYZE ONE BATCH
    # ========================================================

    def analyze_batch(
        self,
        image,
        batch_id,
        temperature,
        humidity,
        days_since_harvest,
        quantity
    ):

        # ------------------------
        # INPUT VALIDATION
        # ------------------------

        if not str(batch_id).strip():
            raise ValueError(
                "batch_id cannot be empty."
            )

        if quantity <= 0:
            raise ValueError(
                "quantity must be greater than 0."
            )

        if days_since_harvest < 0:
            raise ValueError(
                "days_since_harvest cannot be negative."
            )


        # ------------------------
        # STEP 1 — IMAGE MODEL
        # ------------------------

        visual = (
            self.condition_model
            .predict_condition(image)
        )


        # ------------------------
        # STEP 2 — RISK ENGINE
        # ------------------------

        risk = self.calculate_risk(

            source_label=
                visual["source_label"],

            confidence=
                visual["confidence"],

            temperature=
                float(temperature),

            humidity=
                float(humidity),

            days_since_harvest=
                float(days_since_harvest)
        )


        # ------------------------
        # COMPLETE BATCH RECORD
        # ------------------------

        batch = {

            "batch_id":
                str(batch_id),

            "quantity":
                float(quantity),

            "temperature":
                float(temperature),

            "humidity":
                float(humidity),

            "days_since_harvest":
                float(days_since_harvest),

            # ML
            "visual_condition":
                visual["condition"],

            "source_label":
                visual["source_label"],

            "model_confidence":
                visual["confidence"],

            "fresh_score":
                visual["fresh_score"],

            "deterioration_score":
                visual[
                    "deterioration_score"
                ],

            # Risk Engine
            "risk":
                risk["risk"],

            "risk_score":
                risk["score"],

            "risk_components":
                risk["components"],

            "risk_reasons":
                risk["reasons"],

            "risk_cautions":
                risk["cautions"],

            "preliminary_action":
                risk[
                    "preliminary_action"
                ],

            # Scientific disclaimers
            "model_disclaimer":
                visual["disclaimer"],

            "risk_disclaimer":
                risk[
                    "prototype_assumption_notice"
                ]
        }

        return batch


    # ========================================================
    # GENERATE MULTI-BATCH ACTION PLAN
    # ========================================================

    def generate_action_plan(
        self,
        batches,
        cold_storage_capacity,
        transport_capacity
    ):

        decision_batches = []

        for batch in batches:

            decision_batches.append({

                "batch_id":
                    batch["batch_id"],

                "quantity":
                    batch["quantity"],

                "risk":
                    batch["risk"],

                "risk_score":
                    batch["risk_score"],

                "source_label":
                    batch["source_label"],

                "confidence":
                    batch[
                        "model_confidence"
                    ],

                "days_since_harvest":
                    batch[
                        "days_since_harvest"
                    ],

                "risk_reasons":
                    batch[
                        "risk_reasons"
                    ]
            })


        result = (
            self.generate_action_plan_engine(

                batches=
                    decision_batches,

                cold_storage_capacity=
                    float(
                        cold_storage_capacity
                    ),

                transport_capacity=
                    float(
                        transport_capacity
                    )
            )
        )

        return result
