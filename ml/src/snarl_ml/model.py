"""Lightweight TrackNet-style heatmap ball tracker (PyTorch).

Multi-frame in, multi-frame out: the model takes ``num_frames`` consecutive RGB frames stacked
on the channel axis and predicts one ball-position heatmap per frame. It is deliberately small
and uses nearest-neighbour upsampling (not transposed convolutions) to stay within an on-device
latency budget and to convert cleanly to LiteRT/TFLite. Input height and width must be multiples
of four (two pooling stages).
"""

from __future__ import annotations

import torch
from torch import Tensor, nn


def _conv_block(in_channels: int, out_channels: int) -> nn.Sequential:
    return nn.Sequential(
        nn.Conv2d(in_channels, out_channels, kernel_size=3, padding=1, bias=False),
        nn.BatchNorm2d(out_channels),
        nn.ReLU(inplace=True),
        nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1, bias=False),
        nn.BatchNorm2d(out_channels),
        nn.ReLU(inplace=True),
    )


class LightTrackNet(nn.Module):
    """Small encoder-decoder that regresses per-frame ball heatmaps in ``[0, 1]``."""

    def __init__(self, num_frames: int = 3, base_channels: int = 16) -> None:
        super().__init__()
        if num_frames <= 0:
            raise ValueError(f"num_frames must be positive, got {num_frames}")
        if base_channels <= 0:
            raise ValueError(f"base_channels must be positive, got {base_channels}")

        self.num_frames = num_frames
        c1, c2, c3 = base_channels, base_channels * 2, base_channels * 4

        self.enc1 = _conv_block(3 * num_frames, c1)
        self.enc2 = _conv_block(c1, c2)
        self.bottleneck = _conv_block(c2, c3)
        self.pool = nn.MaxPool2d(2)
        self.up = nn.Upsample(scale_factor=2, mode="nearest")
        self.dec2 = _conv_block(c3 + c2, c2)
        self.dec1 = _conv_block(c2 + c1, c1)
        self.head = nn.Conv2d(c1, num_frames, kernel_size=1)

    def forward(self, frames: Tensor) -> Tensor:
        expected_channels = 3 * self.num_frames
        if frames.ndim != 4 or frames.shape[1] != expected_channels:
            raise ValueError(
                f"expected input (B, {expected_channels}, H, W) for {self.num_frames} RGB "
                f"frames, got {tuple(frames.shape)}"
            )
        e1 = self.enc1(frames)
        e2 = self.enc2(self.pool(e1))
        bottleneck = self.bottleneck(self.pool(e2))
        d2 = self.dec2(torch.cat([self.up(bottleneck), e2], dim=1))
        d1 = self.dec1(torch.cat([self.up(d2), e1], dim=1))
        return torch.sigmoid(self.head(d1))


def sample_input(num_frames: int = 3, height: int = 288, width: int = 512) -> Tensor:
    """A single-batch zero tensor matching the model's expected input, for conversion."""
    return torch.zeros(1, 3 * num_frames, height, width, dtype=torch.float32)
