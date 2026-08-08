#!/usr/bin/env python3
"""Verify that PyTorch can use Apple's Metal Performance Shaders (MPS) backend.

Run inside the same Python environment used by ComfyUI:
    python verify_mps.py
"""
from __future__ import annotations

import platform
import sys


def main() -> int:
    print(f"Python: {sys.version.split()[0]}")
    print(f"Platform: {platform.platform()}")

    try:
        import torch
    except ImportError:
        print("ERROR: PyTorch is not installed in this environment.")
        print("Activate your ComfyUI virtual environment, then run this script again.")
        return 2

    print(f"PyTorch: {torch.__version__}")
    mps = getattr(torch.backends, "mps", None)
    built = bool(mps and mps.is_built())
    available = bool(mps and mps.is_available())
    print(f"MPS built: {built}")
    print(f"MPS available: {available}")

    if not available:
        print("RESULT: MPS is not available. Check Apple Silicon, macOS, PyTorch build, and the active environment.")
        return 1

    try:
        tensor = torch.tensor([1.0], device="mps")
        print(f"MPS tensor test: {tensor}")
        print("RESULT: PASS — PyTorch can execute on the MPS device.")
        return 0
    except Exception as exc:  # pragma: no cover - hardware/runtime dependent
        print(f"RESULT: FAIL — MPS exists but the tensor test failed: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
