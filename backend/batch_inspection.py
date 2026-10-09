
# ============================================================
# HARVESTSHIELD V0.2 — MULTI-IMAGE CRATE INSPECTION
# Uses the existing trained model through the existing backend.
# ============================================================

VALID_POSITIONS = {"Bottom", "Middle", "Top"}


def inspect_crate(
    hs,
    batch_id,
    samples,
    temperature,
    humidity,
    days_since_harvest,
    quantity
):
    """
    samples = [
        {"position": "Bottom", "image": pil_image_1},
        {"position": "Middle", "image": pil_image_2},
        {"position": "Top", "image": pil_image_3}
    ]

    Images represent sampled tomatoes captured during
    existing sorting or crate filling, not after unpacking.
    """

    if not str(batch_id).strip():
        raise ValueError("Batch ID is required.")

    if not samples:
        raise ValueError("Upload at least one sample image.")

    results = []

    for index, sample in enumerate(samples, start=1):

        position = str(
            sample["position"]
        ).strip().title()

        if position not in VALID_POSITIONS:
            raise ValueError(
                f"Invalid sample position: {position}"
            )

        prediction = hs.analyze_batch(
            image=sample["image"],
            batch_id=f"{batch_id}-S{index}",
            temperature=temperature,
            humidity=humidity,
            days_since_harvest=days_since_harvest,
            quantity=quantity
        )

        results.append({
            "sample_id": f"S{index}",
            "position": position,
            "source_label": prediction["source_label"],
            "visual_condition": prediction["visual_condition"],
            "model_confidence": prediction["model_confidence"]
        })

    deterioration_flags = sum(
        result["source_label"] == "Rotten"
        for result in results
    )

    observed_positions = {
        result["position"]
        for result in results
    }

    missing_positions = sorted(
        VALID_POSITIONS - observed_positions
    )

    if deterioration_flags > 0:
        status = "REQUIRES_OPERATOR_REVIEW"

    elif missing_positions:
        status = "INCOMPLETE_SAMPLING"

    else:
        status = "NO_DETERIORATION_FLAG_IN_SAMPLES"

    return {
        "batch_id": batch_id,
        "sample_count": len(results),
        "sample_results": results,
        "sampled_positions": sorted(observed_positions),
        "missing_positions": missing_positions,
        "deterioration_flags": deterioration_flags,
        "inspection_status": status,
        "quantity": quantity,
        "temperature": temperature,
        "humidity": humidity,
        "days_since_harvest": days_since_harvest,
        "inspection_notice": (
            "Findings apply only to inspected samples. "
            "They do not prove the condition of every "
            "tomato in the crate. Further quality and "
            "safety checks may be required."
        )
    }
