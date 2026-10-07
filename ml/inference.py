
from pathlib import Path

import torch
import torch.nn as nn
from PIL import Image

from torchvision import transforms
from torchvision.models import mobilenet_v3_small


class HarvestShieldConditionModel:

    def __init__(
        self,
        checkpoint_path,
        device=None
    ):

        self.checkpoint_path = Path(
            checkpoint_path
        )

        if device is None:

            self.device = torch.device(
                "cuda"
                if torch.cuda.is_available()
                else "cpu"
            )

        else:
            self.device = torch.device(device)

        checkpoint = torch.load(
            self.checkpoint_path,
            map_location=self.device
        )

        self.class_to_idx = (
            checkpoint["class_to_idx"]
        )

        self.idx_to_class = (
            checkpoint["idx_to_class"]
        )

        self.image_size = (
            checkpoint["image_size"]
        )

        self.mean = (
            checkpoint["imagenet_mean"]
        )

        self.std = (
            checkpoint["imagenet_std"]
        )

        model = mobilenet_v3_small(
            weights=None
        )

        in_features = (
            model.classifier[3].in_features
        )

        model.classifier[3] = nn.Linear(
            in_features,
            2
        )

        model.load_state_dict(
            checkpoint["model_state_dict"]
        )

        self.model = model.to(
            self.device
        )

        self.model.eval()

        self.transform = transforms.Compose([
            transforms.Resize(256),

            transforms.CenterCrop(
                self.image_size
            ),

            transforms.ToTensor(),

            transforms.Normalize(
                self.mean,
                self.std
            )
        ])


    def predict_condition(
        self,
        image_input
    ):

        """
        Predict tomato visual condition.

        Accepts:
        - image filepath
        - pathlib.Path
        - PIL Image

        IMPORTANT:
        Returned confidence is model classification
        confidence.

        It is NOT probability of future spoilage.
        """

        if isinstance(
            image_input,
            (str, Path)
        ):

            image = Image.open(
                image_input
            ).convert("RGB")

        elif isinstance(
            image_input,
            Image.Image
        ):

            image = image_input.convert(
                "RGB"
            )

        else:

            raise TypeError(
                "image_input must be a "
                "file path or PIL Image."
            )

        tensor = (
            self.transform(image)
            .unsqueeze(0)
            .to(self.device)
        )

        with torch.no_grad():

            logits = self.model(
                tensor
            )

            probabilities = (
                torch.softmax(
                    logits,
                    dim=1
                )[0]
            )

        fresh_score = float(
            probabilities[0].cpu()
        )

        deterioration_score = float(
            probabilities[1].cpu()
        )

        predicted_idx = int(
            torch.argmax(
                probabilities
            ).item()
        )

        confidence = float(
            probabilities[
                predicted_idx
            ].cpu()
        )

        if predicted_idx == 0:

            source_label = "Fresh"

            condition = (
                "NO OBVIOUS VISUAL "
                "DETERIORATION DETECTED"
            )

        else:

            source_label = "Rotten"

            condition = (
                "VISIBLE DETERIORATION "
                "DETECTED"
            )

        return {

            "condition":
                condition,

            "source_label":
                source_label,

            "confidence":
                round(
                    confidence,
                    4
                ),

            "fresh_score":
                round(
                    fresh_score,
                    4
                ),

            "deterioration_score":
                round(
                    deterioration_score,
                    4
                ),

            "disclaimer":
                (
                    "Classification confidence "
                    "is not probability of "
                    "future spoilage."
                )
        }
