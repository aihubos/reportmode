#!/usr/bin/env python3
"""Check whether PyTorch can run a small tensor on Apple's MPS device."""

import torch


is_built = torch.backends.mps.is_built()
is_available = torch.backends.mps.is_available()

print(f"MPS built: {is_built}")
print(f"MPS available: {is_available}")

if not is_available:
    raise SystemExit("MPS is unavailable. Check macOS, Apple silicon, and the PyTorch build.")

tensor = torch.ones(1, device="mps")
print(f"MPS tensor test: {tensor}")
