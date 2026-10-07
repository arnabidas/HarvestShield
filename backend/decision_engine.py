
# ============================================================
# HARVESTSHIELD V0.1
# Explainable Batch Prioritization / Decision Engine
# ============================================================

"""
IMPORTANT

This is a PROTOTYPE HEURISTIC.

It is NOT:
- a mathematically optimal allocation algorithm
- a validated logistics optimizer
- a guarantee of economic-loss minimization

The purpose is to demonstrate:

CONDITION
    ->
RISK
    ->
RESOURCE-AWARE DECISION
    ->
INTERVENTION PRIORITY

Prototype assumptions:
1. Higher deterioration risk receives higher priority.
2. Older batches receive higher priority when risk is similar.
3. Batch quantity is a secondary operational tie-break.
4. High-risk batches generally receive transport/intervention
   priority before medium/low-risk batches.
5. Cold storage is treated as more appropriate for at-risk batches
   that do not already show strong visible deterioration.
"""


RISK_RANK = {
    "HIGH": 3,
    "MEDIUM": 2,
    "LOW": 1
}


def _validate_resources(
    cold_storage_capacity,
    transport_capacity
):

    if cold_storage_capacity < 0:
        raise ValueError(
            "cold_storage_capacity cannot be negative."
        )

    if transport_capacity < 0:
        raise ValueError(
            "transport_capacity cannot be negative."
        )


def _validate_batch(batch):

    required = [
        "batch_id",
        "quantity",
        "risk",
        "risk_score"
    ]

    for key in required:
        if key not in batch:
            raise ValueError(
                f"Missing batch field: {key}"
            )

    if batch["quantity"] <= 0:
        raise ValueError(
            "Batch quantity must be positive."
        )

    if batch["risk"] not in [
        "LOW",
        "MEDIUM",
        "HIGH"
    ]:
        raise ValueError(
            "Risk must be LOW, MEDIUM or HIGH."
        )

    if not 0 <= batch["risk_score"] <= 100:
        raise ValueError(
            "risk_score must be between 0 and 100."
        )


def _priority_key(batch):
    """
    Prototype ranking heuristic:

    1. Risk category
    2. Risk score
    3. Days since harvest
    4. Quantity

    Higher values rank first.
    """

    return (
        RISK_RANK[batch["risk"]],
        batch["risk_score"],
        batch.get("days_since_harvest", 0),
        batch["quantity"]
    )


def generate_action_plan(
    batches,
    cold_storage_capacity,
    transport_capacity
):
    """
    Generate explainable prioritized actions.

    Parameters
    ----------
    batches : list[dict]

    Expected batch fields:
        batch_id
        quantity
        risk
        risk_score

    Optional:
        source_label
        confidence
        days_since_harvest
        risk_reasons

    cold_storage_capacity : float
        Available capacity in kg.

    transport_capacity : float
        Available capacity in kg.

    Returns
    -------
    dict
        Ranked action plan and remaining resources.
    """

    _validate_resources(
        cold_storage_capacity,
        transport_capacity
    )

    if not batches:
        return {
            "plan": [],
            "remaining_cold_storage":
                cold_storage_capacity,
            "remaining_transport":
                transport_capacity,
            "notice":
                "No batches supplied."
        }

    for batch in batches:
        _validate_batch(batch)

    remaining_cold = float(
        cold_storage_capacity
    )

    remaining_transport = float(
        transport_capacity
    )

    # --------------------------------------------------------
    # RANK FIRST
    # --------------------------------------------------------

    ranked = sorted(
        batches,
        key=_priority_key,
        reverse=True
    )

    plan = []

    # --------------------------------------------------------
    # RESOURCE ALLOCATION
    # --------------------------------------------------------

    for priority, batch in enumerate(
        ranked,
        start=1
    ):

        batch_id = batch["batch_id"]
        quantity = float(
            batch["quantity"]
        )

        risk = batch["risk"]
        score = batch["risk_score"]

        source_label = batch.get(
            "source_label"
        )

        days = batch.get(
            "days_since_harvest"
        )

        reasons = []
        resource_used = "None"

        # ====================================================
        # HIGH RISK
        # ====================================================

        if risk == "HIGH":

            # -----------------------------------------------
            # Visible deterioration:
            # rapid action preferred.
            # -----------------------------------------------

            if source_label == "Rotten":

                if remaining_transport >= quantity:

                    action = (
                        "PRIORITIZE TRANSPORT / "
                        "IMMEDIATE OPERATOR REVIEW"
                    )

                    remaining_transport -= quantity

                    resource_used = (
                        f"Transport: {quantity:.0f} kg"
                    )

                    reasons.append(
                        "High deterioration risk with visible "
                        "deterioration detected."
                    )

                    reasons.append(
                        "Available transport capacity was assigned "
                        "to move this high-priority batch."
                    )

                else:

                    action = (
                        "IMMEDIATE INTERVENTION"
                    )

                    reasons.append(
                        "High deterioration risk with visible "
                        "deterioration detected."
                    )

                    reasons.append(
                        "Insufficient transport capacity is available "
                        "for the complete batch."
                    )

                    reasons.append(
                        "Operator should rapidly inspect for dispatch, "
                        "diversion, processing or rejection according "
                        "to local procedures."
                    )

            # -----------------------------------------------
            # High risk without strong visual deterioration
            # -----------------------------------------------

            else:

                if remaining_transport >= quantity:

                    action = (
                        "PRIORITIZE TRANSPORT"
                    )

                    remaining_transport -= quantity

                    resource_used = (
                        f"Transport: {quantity:.0f} kg"
                    )

                    reasons.append(
                        "High deterioration risk makes this batch "
                        "a priority for movement."
                    )

                elif remaining_cold >= quantity:

                    action = (
                        "CONSIDER COLD STORAGE"
                    )

                    remaining_cold -= quantity

                    resource_used = (
                        f"Cold storage: {quantity:.0f} kg"
                    )

                    reasons.append(
                        "Transport capacity was insufficient, but "
                        "cold-storage capacity was available."
                    )

                    reasons.append(
                        "Storage suitability still depends on tomato "
                        "maturity and operating conditions."
                    )

                else:

                    action = (
                        "IMMEDIATE OPERATOR REVIEW"
                    )

                    reasons.append(
                        "High deterioration risk was detected."
                    )

                    reasons.append(
                        "Available transport and cold-storage capacity "
                        "cannot accommodate the complete batch."
                    )


        # ====================================================
        # MEDIUM RISK
        # ====================================================

        elif risk == "MEDIUM":

            if remaining_cold >= quantity:

                action = (
                    "CONSIDER COLD STORAGE"
                )

                remaining_cold -= quantity

                resource_used = (
                    f"Cold storage: {quantity:.0f} kg"
                )

                reasons.append(
                    "Medium-risk batch received available "
                    "cold-storage capacity."
                )

                reasons.append(
                    "Actual storage suitability depends on maturity "
                    "stage and storage conditions."
                )

            elif remaining_transport >= quantity:

                action = (
                    "CONSIDER PRIORITY TRANSPORT"
                )

                remaining_transport -= quantity

                resource_used = (
                    f"Transport: {quantity:.0f} kg"
                )

                reasons.append(
                    "Cold-storage capacity was insufficient."
                )

                reasons.append(
                    "Remaining transport capacity was available for "
                    "this medium-risk batch."
                )

            else:

                action = (
                    "REVIEW / MONITOR CLOSELY"
                )

                reasons.append(
                    "Medium deterioration risk detected."
                )

                reasons.append(
                    "No sufficient configured storage or transport "
                    "capacity remains for the complete batch."
                )


        # ====================================================
        # LOW RISK
        # ====================================================

        else:

            action = "MONITOR"

            reasons.append(
                "Current prototype assessment places this batch "
                "in the low-risk category."
            )

            reasons.append(
                "Higher-risk batches receive scarce resources first."
            )


        # ----------------------------------------------------
        # Add ranking explanation
        # ----------------------------------------------------

        reasons.insert(
            0,
            (
                f"Ranked #{priority} using risk category "
                f"and prototype risk score ({score}/100)."
            )
        )

        if days is not None:

            reasons.append(
                f"Days since harvest: {days}."
            )


        plan.append({

            "priority":
                priority,

            "batch_id":
                batch_id,

            "risk":
                risk,

            "risk_score":
                score,

            "quantity":
                quantity,

            "action":
                action,

            "resource_used":
                resource_used,

            "reason":
                " ".join(reasons)
        })


    return {

        "plan":
            plan,

        "starting_cold_storage":
            float(cold_storage_capacity),

        "starting_transport":
            float(transport_capacity),

        "remaining_cold_storage":
            round(remaining_cold, 2),

        "remaining_transport":
            round(remaining_transport, 2),

        "prototype_notice":
            (
                "This action plan uses an explainable prototype "
                "heuristic. It is not a mathematically optimal "
                "logistics allocation and has not been field-validated."
            )
    }
