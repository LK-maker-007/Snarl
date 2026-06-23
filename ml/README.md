# ml — training and conversion

Python tooling for training the app's on-device models and converting them to TFLite. Offline
only (runs on an external GPU such as Kaggle/Colab); nothing here ships in the app.

Scope:
- Train the ball-tracking (heatmap) model and the object detector on our own captured,
  consented data.
- Convert PyTorch -> TFLite (float16 for the tracker), with a PyTorch-vs-TFLite parity test as a
  gate.

Setup:
```
python3 -m venv .venv && source .venv/bin/activate
pip install ruff mypy            # add torch and training deps as needed
ruff check . && mypy .
```

Standards: permissively licensed code and data only; train only on consented footage.

## Milestone 1 — convert, parity, latency

`src/snarl_ml/`: a lightweight TrackNet-style heatmap tracker (`model.py`), Gaussian target
encode/decode (`heatmap.py`), PyTorch->LiteRT conversion (`convert.py`), a parity gate
(`parity.py`), and a host-CPU latency benchmark (`latency.py`). `milestone1.py` runs them
end-to-end.

Lint, type-check, and unit tests (no heavy deps):
```
python3 -m venv .venv && source .venv/bin/activate
pip install -e '.[dev]'
ruff check src tests && mypy && pytest
```

Full convert -> parity -> latency (needs torch + litert-torch; run on Colab/Kaggle or a machine
with them):
```
pip install -e '.[convert]'
python -m snarl_ml.milestone1
```
Parity and latency numbers are produced by that run on real input — they are not asserted in
advance. On-device latency is measured later on the Android phone, not by this host-CPU
benchmark.

Or run it in Colab: open `notebooks/milestone1.ipynb` (it clones the repo, installs the convert
deps, and runs the pipeline).

