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
