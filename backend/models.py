from __future__ import annotations

import base64
import io
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, Tuple

import numpy as np
from PIL import Image

try:
    import torch
    import torch.nn.functional as F
except ImportError:
    torch = None  # type: ignore[assignment]
    F = None  # type: ignore[assignment]


@dataclass(frozen=True)
class ModelSpec:
    model_id: str
    name: str
    architecture: str
    default_checkpoint: str
    env_var: str
    pad_multiple: int


MODEL_SPECS: Dict[str, ModelSpec] = {
    "gan": ModelSpec(
        model_id="gan",
        name="DeblurGAN-v2 (GAN)",
        architecture="Feature Pyramid Network + RaGAN-LS",
        default_checkpoint="checkpoints/deblurgan_v2.pth",
        env_var="DEBLURGAN_CHECKPOINT_PATH",
        pad_multiple=32,
    ),
    "diffusion": ModelSpec(
        model_id="diffusion",
        name="Conditional DDPM (Diffusion)",
        architecture="Conditional Denoising Diffusion Probabilistic Model",
        default_checkpoint="checkpoints/conditional_ddpm.pt",
        env_var="DDPM_CHECKPOINT_PATH",
        pad_multiple=16,
    ),
    "transformer": ModelSpec(
        model_id="transformer",
        name="Restormer (Transformer)",
        architecture="Multi-Dconv Head Transposed Attention",
        default_checkpoint="checkpoints/restormer.pth",
        env_var="RESTORMER_CHECKPOINT_PATH",
        pad_multiple=8,
    ),
}


class CheckpointRegistry:
    """
    Loads trained PyTorch model checkpoints for DeblurGAN-v2, Conditional DDPM, and Restormer.
    Never simulates output or applies image filters when checkpoints are missing.
    """

    def __init__(self, base_dir: Optional[Path] = None) -> None:
        self.base_dir = base_dir or Path(__file__).resolve().parent
        self.device = self._resolve_device()
        self.loaded_models: Dict[str, object] = {}
        self.load_errors: Dict[str, str] = {}
        self._load_available_checkpoints()

    def _resolve_device(self) -> str:
        if torch is None:
            return "unavailable"
        return "cuda" if torch.cuda.is_available() else "cpu"

    def resolve_checkpoint_path(self, model_id: str) -> Path:
        spec = MODEL_SPECS[model_id]
        override = os.getenv(spec.env_var)
        if override:
            return Path(override)
        return self.base_dir / spec.default_checkpoint

    def _load_available_checkpoints(self) -> None:
        if torch is None:
            for model_id in MODEL_SPECS:
                self.load_errors[model_id] = "PyTorch is not installed in the Python environment."
            return

        for model_id, spec in MODEL_SPECS.items():
            ckpt_path = self.resolve_checkpoint_path(model_id)
            if not ckpt_path.exists():
                self.load_errors[model_id] = (
                    f"Checkpoint file not found at {ckpt_path}."
                )
                continue

            try:
                # Supports TorchScript exported models (.pt / .pth) out of the box,
                # or replace _build_architecture() with your PyTorch nn.Module state_dict loader.
                try:
                    model = torch.jit.load(str(ckpt_path), map_location=self.device)
                except RuntimeError:
                    model = self._load_state_dict_model(model_id, ckpt_path)
                model.eval()
                self.loaded_models[model_id] = model
            except Exception as exc:  # pragma: no cover - hardware/checkpoint dependent
                self.load_errors[model_id] = f"Failed to load checkpoint {ckpt_path.name}: {exc}"

    def _load_state_dict_model(self, model_id: str, ckpt_path: Path):
        """
        Hook for loading nn.Module state_dict checkpoints when not exported as TorchScript.
        Instantiate your DeblurGANv2 / ConditionalDDPM / Restormer architecture here,
        load torch.load(ckpt_path, map_location=self.device, weights_only=True), and return it.
        """
        raise RuntimeError(
            f"State-dict architecture loader for '{model_id}' must be wired in models.py "
            f"or exported as TorchScript ({ckpt_path.name})."
        )

    def get_status(self) -> Dict[str, dict]:
        status: Dict[str, dict] = {}
        for model_id, spec in MODEL_SPECS.items():
            ckpt_path = self.resolve_checkpoint_path(model_id)
            is_loaded = model_id in self.loaded_models
            reason = (
                f"Checkpoint loaded on {self.device}."
                if is_loaded
                else self.load_errors.get(model_id, "Checkpoint not loaded.")
            )
            status[model_id] = {
                "id": model_id,
                "name": spec.name,
                "available": is_loaded,
                "checkpointLoaded": is_loaded,
                "checkpointPath": str(ckpt_path),
                "device": self.device if is_loaded else None,
                "reason": reason,
            }
        return status

    def _image_to_tensor(self, image: Image.Image, pad_multiple: int) -> Tuple["torch.Tensor", Tuple[int, int]]:
        rgb = image.convert("RGB")
        width, height = rgb.size
        arr = np.asarray(rgb, dtype=np.float32) / 255.0
        tensor = torch.from_numpy(arr).permute(2, 0, 1).unsqueeze(0).to(self.device)

        pad_h = (pad_multiple - height % pad_multiple) % pad_multiple
        pad_w = (pad_multiple - width % pad_multiple) % pad_multiple
        if pad_h or pad_w:
            tensor = F.pad(tensor, (0, pad_w, 0, pad_h), mode="reflect")
        return tensor, (height, width)

    def _tensor_to_png_base64(self, tensor: "torch.Tensor", original_hw: Tuple[int, int]) -> str:
        orig_h, orig_w = original_hw
        cropped = tensor[:, :, :orig_h, :orig_w].clamp(0.0, 1.0)
        arr = (cropped.squeeze(0).permute(1, 2, 0).detach().cpu().numpy() * 255.0).round().astype(np.uint8)
        out_image = Image.fromarray(arr, mode="RGB")
        buf = io.BytesIO()
        out_image.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode("ascii")

    def run_inference(self, model_id: str, image: Image.Image) -> dict:
        if model_id not in MODEL_SPECS:
            raise KeyError(f"Unknown model id: {model_id}")
        if model_id not in self.loaded_models or torch is None:
            raise RuntimeError(self.load_errors.get(model_id, "Model checkpoint is not loaded."))

        spec = MODEL_SPECS[model_id]
        model = self.loaded_models[model_id]

        tensor, orig_hw = self._image_to_tensor(image, spec.pad_multiple)

        if self.device == "cuda":
            torch.cuda.synchronize()
        start = time.perf_counter()

        with torch.no_grad():
            output = model(tensor)  # type: ignore[operator]

        if self.device == "cuda":
            torch.cuda.synchronize()
        elapsed_ms = (time.perf_counter() - start) * 1000.0

        encoded_png = self._tensor_to_png_base64(output, orig_hw)
        return {
            "modelId": model_id,
            "modelName": spec.name,
            "architecture": spec.architecture,
            "imageBase64": encoded_png,
            "mimeType": "image/png",
            "inferenceTimeMs": round(elapsed_ms, 2),
            "width": orig_hw[1],
            "height": orig_hw[0],
        }
