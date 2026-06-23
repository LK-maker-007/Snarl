"""Efficient on-device ball-tracking heatmap model (PyTorch).

Multi-frame in, multi-frame out: takes ``num_frames`` consecutive RGB frames stacked on the
channel axis and predicts one ball heatmap per frame. Built for on-device latency — an early
stride-2 stem and depthwise-separable convolutions do the work at reduced resolution, and the
heatmap is upsampled back to the input size. Nearest-neighbour upsampling (no transposed
convolutions) keeps LiteRT/TFLite conversion clean. Input height and width must be multiples of
eight (three stride-2 stages).
"""

from __future__ import annotations

import torch
from torch import Tensor, nn


class _DepthwiseSeparable(nn.Module):
    """Depthwise 3x3 + pointwise 1x1 convolution (MobileNet-style), far cheaper than a full conv."""

    def __init__(self, in_channels: int, out_channels: int, stride: int = 1) -> None:
        super().__init__()
        self.depthwise = nn.Conv2d(
            in_channels, in_channels, kernel_size=3, stride=stride, padding=1,
            groups=in_channels, bias=False,
        )
        self.bn1 = nn.BatchNorm2d(in_channels)
        self.pointwise = nn.Conv2d(in_channels, out_channels, kernel_size=1, bias=False)
        self.bn2 = nn.BatchNorm2d(out_channels)
        self.act = nn.ReLU(inplace=True)

    def forward(self, x: Tensor) -> Tensor:
        x = self.act(self.bn1(self.depthwise(x)))
        out: Tensor = self.act(self.bn2(self.pointwise(x)))
        return out


class LightTrackNet(nn.Module):
    """Efficient encoder-decoder regressing per-frame ball heatmaps in ``[0, 1]``."""

    def __init__(self, num_frames: int = 3, width: int = 16) -> None:
        super().__init__()
        if num_frames <= 0:
            raise ValueError(f"num_frames must be positive, got {num_frames}")
        if width <= 0:
            raise ValueError(f"width must be positive, got {width}")

        self.num_frames = num_frames
        c1, c2, c3 = width, width * 2, width * 4

        self.stem = nn.Sequential(
            nn.Conv2d(3 * num_frames, c1, kernel_size=3, stride=2, padding=1, bias=False),
            nn.BatchNorm2d(c1),
            nn.ReLU(inplace=True),
        )
        self.enc1 = _DepthwiseSeparable(c1, c1)
        self.down1 = _DepthwiseSeparable(c1, c2, stride=2)
        self.enc2 = _DepthwiseSeparable(c2, c2)
        self.down2 = _DepthwiseSeparable(c2, c3, stride=2)
        self.bottleneck = _DepthwiseSeparable(c3, c3)
        self.up = nn.Upsample(scale_factor=2, mode="nearest")
        self.dec2 = _DepthwiseSeparable(c3 + c2, c2)
        self.dec1 = _DepthwiseSeparable(c2 + c1, c1)
        self.head = nn.Conv2d(c1, num_frames, kernel_size=1)

    def forward(self, frames: Tensor) -> Tensor:
        expected_channels = 3 * self.num_frames
        if frames.ndim != 4 or frames.shape[1] != expected_channels:
            raise ValueError(
                f"expected input (B, {expected_channels}, H, W) for {self.num_frames} RGB "
                f"frames, got {tuple(frames.shape)}"
            )
        if frames.shape[2] % 8 != 0 or frames.shape[3] % 8 != 0:
            raise ValueError(
                f"height and width must be multiples of 8, got {tuple(frames.shape[2:])}"
            )

        stem = self.stem(frames)
        e1 = self.enc1(stem)
        e2 = self.enc2(self.down1(e1))
        bottleneck = self.bottleneck(self.down2(e2))
        d2 = self.dec2(torch.cat([self.up(bottleneck), e2], dim=1))
        d1 = self.dec1(torch.cat([self.up(d2), e1], dim=1))
        heatmaps = torch.sigmoid(self.head(d1))
        full_res: Tensor = self.up(heatmaps)
        return full_res


def sample_input(num_frames: int = 3, height: int = 160, width: int = 256) -> Tensor:
    """A single-batch zero tensor matching the model's expected input, for conversion."""
    return torch.zeros(1, 3 * num_frames, height, width, dtype=torch.float32)
