
# ============================================================
# HARVESTSHIELD V0.1
# Explainable Prototype Risk Engine
# ============================================================

"""
IMPORTANT SCIENTIFIC NOTE

This module generates a PROTOTYPE OPERATIONAL RISK SCORE.

The score:
    - is NOT probability of spoilage
    - is NOT remaining shelf life
    - is NOT a validated biological model

Evidence-supported relationships:
    1. Visual deterioration is operationally relevant.
    2. Temperature influences tomato post-harvest deterioration.
    3. Tomatoes are chilling-sensitive.
    4. Recommended temperatures depend on maturity stage.
    5. Approx. 90–95% RH is recommended for tomato quality.
    6. Excessive humidity/condensation can encourage molds.
    7. Longer elapsed post-harvest time can increase concern,
       but time alone cannot determine remaining shelf life.

Prototype assumptions:
    - component weights
    - numerical risk score
    - LOW/MEDIUM/HIGH boundaries
    - days-since-harvest bands
    - operational warning weights

These assumptions are used ONLY for prototype prioritization.
"""


def _validate_inputs(
    source_label,
    confidence,
    temperature,
    humidity,
    days_since_harvest
):

    if source_label not in ["Fresh", "Rotten"]:
        raise ValueError(
            "source_label must be 'Fresh' or 'Rotten'."
        )

    if not 0 <= confidence <= 1:
        raise ValueError(
            "confidence must be between 0 and 1."
        )

    if not -10 <= temperature <= 60:
        raise ValueError(
            "temperature appears outside plausible prototype range."
        )

    if not 0 <= humidity <= 100:
        raise ValueError(
            "humidity must be between 0 and 100."
        )

    if days_since_harvest < 0:
        raise ValueError(
            "days_since_harvest cannot be negative."
        )


def calculate_risk(
    source_label,
    confidence,
    temperature,
    humidity,
    days_since_harvest
):
    """
    Returns an explainable HarvestShield prototype risk assessment.

    Parameters
    ----------
    source_label : str
        'Fresh' or 'Rotten' from the image classifier.

    confidence : float
        Classification confidence from 0 to 1.
        This is NOT spoilage probability.

    temperature : float
        Current / operator-entered temperature in °C.

    humidity : float
        Current / operator-entered relative humidity (%).

    days_since_harvest : int or float
        Operator-entered elapsed days since harvest.

    Returns
    -------
    dict
        Prototype risk score, risk band, component scores,
        explanations, assumptions and warnings.
    """

    _validate_inputs(
        source_label,
        confidence,
        temperature,
        humidity,
        days_since_harvest
    )

    reasons = []
    cautions = []

    # ========================================================
    # 1. VISUAL COMPONENT — MAX 55
    # ========================================================

    # Convert classifier result into a continuous
    # deterioration-evidence signal.
    #
    # Example:
    # Rotten @ 0.90 confidence -> signal 0.90
    # Fresh  @ 0.90 confidence -> signal 0.10
    #
    # This is NOT a probability of spoilage.

    if source_label == "Rotten":

        deterioration_signal = confidence

        reasons.append(
            "The image model detected visible deterioration."
        )

        if confidence >= 0.80:
            reasons.append(
                "The visual classification had relatively strong "
                "model confidence."
            )

    else:

        deterioration_signal = 1.0 - confidence

        reasons.append(
            "No obvious visual deterioration was detected "
            "by the image model."
        )

        if confidence < 0.70:
            cautions.append(
                "Visual classification confidence is limited; "
                "manual inspection is advisable."
            )

    visual_score = round(
        deterioration_signal * 55
    )


    # ========================================================
    # 2. TEMPERATURE COMPONENT — MAX 20
    # ========================================================
    #
    # Tomato temperature requirements depend on maturity.
    # Therefore this deliberately does NOT label one narrow
    # temperature range as universally 'safe'.
    #
    # Numerical points below are PROTOTYPE ASSUMPTIONS.
    # ========================================================

    if temperature < 0:

        temperature_score = 20

        reasons.append(
            "Temperature is extremely low for tomato handling "
            "and raises freezing/chilling concern."
        )

    elif temperature < 7:

        temperature_score = 15

        reasons.append(
            "Low temperature may create chilling-injury concern "
            "depending on maturity and exposure duration."
        )

    elif temperature < 10:

        temperature_score = 7

        cautions.append(
            "This temperature may be suitable for short storage "
            "of firm-ripe tomatoes but can be unsuitable for "
            "other maturity stages or prolonged exposure."
        )

    elif temperature <= 21:

        temperature_score = 0

        cautions.append(
            "Temperature interpretation depends on tomato "
            "maturity and whether the batch is being stored "
            "or intentionally ripened."
        )

    elif temperature <= 25:

        temperature_score = 8

        reasons.append(
            "Warmer conditions can accelerate tomato ripening "
            "and physiological activity."
        )

    else:

        temperature_score = 20

        reasons.append(
            "Temperature above 25°C is an elevated-temperature "
            "condition associated with faster ripening/softening."
        )


    # ========================================================
    # 3. HUMIDITY COMPONENT — MAX 10
    # ========================================================
    #
    # Evidence:
    # UC Davis recommends approx. 90–95% RH for tomatoes.
    #
    # Numerical penalties are PROTOTYPE ASSUMPTIONS.
    # ========================================================

    if humidity < 75:

        humidity_score = 10

        reasons.append(
            "Relative humidity is well below the commonly "
            "recommended high-humidity range, increasing "
            "water-loss concern."
        )

    elif humidity < 90:

        humidity_score = 5

        reasons.append(
            "Relative humidity is below the commonly recommended "
            "90–95% range for tomato post-harvest quality."
        )

    elif humidity <= 95:

        humidity_score = 0

    else:

        humidity_score = 4

        cautions.append(
            "Very high humidity can be problematic when it causes "
            "condensation; extended wet conditions may encourage mold."
        )


    # ========================================================
    # 4. DAYS SINCE HARVEST — MAX 15
    # ========================================================
    #
    # These bands are explicitly PROTOTYPE ASSUMPTIONS.
    #
    # We do NOT claim a fixed tomato shelf life because
    # maturity, cultivar, temperature history and handling differ.
    # ========================================================

    if days_since_harvest <= 2:

        age_score = 0

    elif days_since_harvest <= 5:

        age_score = 5

        reasons.append(
            "Several days have elapsed since harvest."
        )

    elif days_since_harvest <= 8:

        age_score = 10

        reasons.append(
            "Longer elapsed post-harvest time increases "
            "operational attention priority in this prototype."
        )

    else:

        age_score = 15

        reasons.append(
            "Extended elapsed time since harvest increases "
            "operational concern in this prototype."
        )


    # ========================================================
    # 5. TOTAL PROTOTYPE SCORE
    # ========================================================

    score = (
        visual_score
        + temperature_score
        + humidity_score
        + age_score
    )

    score = min(
        100,
        max(0, int(score))
    )


    # ========================================================
    # 6. PROTOTYPE SAFETY FLOOR
    # ========================================================
    #
    # Strong visual deterioration should not be ranked LOW
    # just because current environmental readings look good.
    #
    # This is an operational prototype assumption.
    # ========================================================

    visual_floor_applied = False

    if (
        source_label == "Rotten"
        and confidence >= 0.80
        and score < 60
    ):

        score = 60
        visual_floor_applied = True

        reasons.append(
            "Prototype priority floor applied because strong "
            "visible deterioration was detected."
        )


    # ========================================================
    # 7. RISK BAND
    # ========================================================

    if score >= 60:
        risk = "HIGH"

    elif score >= 30:
        risk = "MEDIUM"

    else:
        risk = "LOW"


    # ========================================================
    # 8. SIMPLE RECOMMENDED NEXT STEP
    #
    # Final resource allocation happens later in
    # the Decision Engine.
    # ========================================================

    if risk == "HIGH":

        preliminary_action = (
            "PRIORITIZE FOR OPERATOR REVIEW"
        )

    elif risk == "MEDIUM":

        preliminary_action = (
            "REVIEW / MONITOR CLOSELY"
        )

    else:

        preliminary_action = (
            "MONITOR"
        )


    return {

        "risk": risk,

        "score": score,

        "score_label":
            f"{score}/100",

        "preliminary_action":
            preliminary_action,

        "components": {

            "visual":
                visual_score,

            "temperature":
                temperature_score,

            "humidity":
                humidity_score,

            "days_since_harvest":
                age_score
        },

        "reasons":
            reasons,

        "cautions":
            cautions,

        "visual_floor_applied":
            visual_floor_applied,

        "prototype_assumption_notice":
            (
                "The 0–100 score, component weights and risk "
                "bands are prototype prioritization assumptions. "
                "The score is NOT a probability of spoilage "
                "and NOT an estimate of remaining shelf life."
            )
    }
