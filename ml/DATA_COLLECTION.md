# Capturing cricket data for training

Short answer to "can I just film anything?": **No.** The ball tracker is only as good as the
footage it learns from, and a fast ball in low-quality video is literally untrackable. Follow
the rules below. (More variety helps the model generalise, but every clip still has to meet the
quality bar, and the footage you fine-tune the deployed model on must resemble how the app will
actually film.)

## Rule 0 — consent first (non-negotiable)
Get informed consent before filming anyone, and **verifiable parental consent for minors**, with
a written record. Only train on consented footage. This is gate zero — fix it before a single
clip.

## What the model needs
- For the **ball tracker**: short **video clips** (consecutive frames) where the ball is visible
  and trackable, with the ball position marked **per frame**. Not loose photos — trajectories.
- For the **object detector** (bat / stumps / player): individual **images with boxes** — photos
  are fine here.
- For **pose/biomechanics**: we don't train it (pretrained), so footage is for validation only.

## Capture rules for good ball-tracking clips

- **Frame rate:** 240 fps if the phone supports it, **120 fps minimum.** A 145 km/h ball moves
  ~1.3 m between frames at 30 fps — unusable. High fps is the single most important setting.
- **Shutter:** as fast as the light allows (aim ≤ 1/1000 s) so the ball is a dot, not a long
  smear.
- **Resolution:** 1080p (720p floor). The ball must be at least a few pixels wide.
- **Camera:** on a **tripod** (never handheld), ~4–6 m behind the bowler's stumps, ~1.8 m high,
  with focus and exposure **locked**.
- **Framing:** the stumps in view (needed for calibration), a **clean, static background** (a net
  or wall — no moving people/objects behind the action).
- **Light:** bright daylight or well-lit nets (this is what lets you use a fast shutter).
- **Clips:** record continuous deliveries; keep the **setup identical** across sessions.

## The golden rule
**Train on footage that looks like what the app will capture.** If you film from random angles
and lighting but the app deploys with the fixed behind-the-bowler setup, the model won't
transfer. Consistency between training capture and deployment capture matters as much as
quantity.

## Good clip vs bad clip
| Good | Bad (don't use) |
|---|---|
| 120–240 fps, fast shutter, ball is a crisp dot | 30 fps / slow shutter, ball is a blurry streak or gone |
| Tripod, fixed angle, stumps in frame | Handheld, swinging, zooming, no stumps |
| Clean static background | Crowd / moving people behind the action |
| Good light | Dim indoor light, heavy noise |

## From footage to a trainable dataset
1. **Film** per the rules above (consent recorded).
2. **Extract frames** from each clip (one folder per clip):
   ```
   mkdir clip0 && ffmpeg -i clip0.mp4 -qscale:v 2 clip0/%05d.png
   ```
3. **Label the ball** per frame in **CVAT or Label Studio** (self-hosted, free): mark a single
   point on the ball in each frame; mark frames where the ball isn't visible as not-visible.
4. **Export to `labels.csv`** per clip, with header `frame,visibility,x,y` (one row per frame;
   `visibility` 0 when the ball is absent, then x,y are ignored). Map your tool's keypoint export
   to this; it is the one format the training code reads.
5. **Train**: point the loader at the folder of clips —
   ```
   python -m snarl_ml.train --image-dir <clips-root> --epochs 50
   ```
   (`ImageClipDataset` reads each clip's images + `labels.csv`.)

## Dataset format (the contract)
```
clips-root/
  clip0/  00001.png 00002.png ...  labels.csv   # frame,visibility,x,y
  clip1/  ...                       labels.csv
```
Frames within a clip must share one resolution. Same format whether the frames came from your
video or a public dataset.

## Bootstrapping while you collect
You won't have much cricket data at first. Until then:
- **Pretrain** the tracker on public small-fast-ball trajectory data (tennis/badminton TrackNet
  sets), then **fine-tune** on your cricket clips. Get the datasets from the TrackNet/WASB project
  repos (they link the tennis/badminton sets), extract the frames, convert their per-frame label
  CSVs to our schema with `python -m snarl_ml.prepare <dataset-root>`, then train with
  `python -m snarl_ml.train --image-dir <dataset-root>`.
- Use the **synthetic** dataset to develop/validate the pipeline.
Your own consented cricket footage is what ultimately makes the model good — and it is your moat.
