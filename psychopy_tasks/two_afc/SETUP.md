# 2AFC Room Comparison Task — Setup Guide

## Overview

The Two-Alternative Forced Choice (2AFC) task presents participants with pairs of room images side by side. On each trial, they choose the image that best answers a question (e.g., "Which room do you prefer overall?") by pressing **F** (left) or **J** (right). The task measures both the choice and the reaction time.

**Task structure:**

| Phase | Trials | Description |
|---|---|---|
| Practice | 6 | Neutral image pairs to familiarize with keys and timing |
| Block 1 — Preference | 32 | "Which room do you prefer overall?" |
| Block 2 — Spaciousness | 32 | "Which room feels more spacious?" |
| Block 3 — Anxiety | 32 | "Which room feels more anxiety-inducing?" |

Each block includes a mid-block break after trial 16. Total task time is approximately 15–20 minutes.

---

## Prerequisites

- **Python 3.9+** (tested with 3.11)
- **macOS, Windows, or Linux** with a display capable of full-screen rendering
- The experiment platform repository cloned locally

---

## 1. Environment Setup

### Using the project's existing virtual environment

If you already set up the experiment platform's virtual environment:

```bash
cd /path/to/experiment_platform
source venv/bin/activate        # macOS / Linux
# venv\Scripts\activate          # Windows
pip install psychopy
```

### Creating a standalone virtual environment (optional)

If you prefer a separate environment for PsychoPy:

```bash
cd /path/to/experiment_platform/psychopy_tasks/two_afc
python3 -m venv venv
source venv/bin/activate
pip install psychopy
```

### Verify the installation

```bash
python -c "from psychopy import visual, core, event, gui; print('PsychoPy OK')"
```

You may see harmless warnings about fonts or monitor specifications — these can be ignored.

---

## 2. Directory Structure

After setup, the task directory should look like this:

```
psychopy_tasks/two_afc/
├── two_afc_task.py                  # Main task script
├── conditions/
│   ├── experimental_pairs.csv       # Image pairs for the 3 experimental blocks
│   └── practice_pairs.csv           # Image pairs for the practice block
├── images/
│   ├── experimental/                # Room images for the real task
│   │   ├── A-H_img.png
│   │   ├── A-L_img.png
│   │   ├── B-H_img.png
│   │   ├── ...
│   │   └── (your room images here)
│   └── practice/                    # Neutral images for practice trials
│       └── (practice images here)
├── data/                            # Output CSV files (auto-created)
└── SETUP.md                         # This file
```

---

## 3. Prepare Your Images

### Experimental images

Place your room images in `images/experimental/`. Supported formats: `.png`, `.jpg`, `.bmp`.

For best results:
- Use a **consistent resolution** across all images (e.g., 1920x1080 or 1024x768)
- Use a **consistent aspect ratio** so images display evenly side by side
- Avoid images with text or labels that could bias responses

### Practice images

Place neutral (non-experimental) images in `images/practice/`. These should be room images that are not part of the experimental set. For initial testing, you can copy some experimental images here — but for the real experiment, use separate neutral images to avoid priming effects.

---

## 4. Configure Image Pairs

### `conditions/experimental_pairs.csv`

Each row defines one pair. The columns are:

| Column | Description |
|---|---|
| `pair_id` | Unique identifier for the pair (e.g., `1`, `2`, ...) |
| `image_a` | Filename of the first image (must exist in `images/experimental/`) |
| `image_b` | Filename of the second image (must exist in `images/experimental/`) |

Example with 4 rooms (A–D), each with High/Low variants:

```csv
pair_id,image_a,image_b
1,A-H_img.png,A-L_img.png
2,B-H_img.png,B-L_img.png
3,C-H_img.png,C-L_img.png
4,D-H_img.png,D-L_img.png
```

**Left/right positioning is randomized automatically** on each trial — you only need to define which two images form a pair.

**Recycling:** If you have fewer pairs than trials per block (default 32), the script automatically shuffles and repeats pairs to fill the block. For example, 4 pairs with 32 trials means each pair appears ~8 times per block.

### `conditions/practice_pairs.csv`

Same format. Uses images from `images/practice/`.

```csv
pair_id,image_a,image_b
P1,neutral_01.png,neutral_02.png
P2,neutral_03.png,neutral_04.png
```

---

## 5. Configure Task Parameters

Open `two_afc_task.py` and adjust the constants near the top of the file:

### Trial counts

```python
TRIALS_PER_BLOCK = 32          # Trials per experimental block
MID_BREAK_AFTER_TRIAL = 16    # Show a break screen after this many trials
NUM_PRACTICE_TRIALS = 6       # Number of practice trials
```

For quick testing, reduce these (e.g., `4`, `2`, `2`). Restore to the values above for the real experiment.

### Timing

```python
FIXATION_DURATION = 0.5        # Fixation cross duration (seconds)
POST_RESPONSE_BLANK = 0.2     # Blank screen after each response (seconds)
```

### Display

```python
IMAGE_SIZE = (0.45, 0.35)     # Image size in PsychoPy 'height' units
IMAGE_POS_LEFT = (-0.3, -0.05)
IMAGE_POS_RIGHT = (0.3, -0.05)
```

### Response keys

```python
KEY_LEFT = 'f'                 # Choose left image
KEY_RIGHT = 'j'                # Choose right image
KEY_ADVANCE = 'space'          # Advance through instruction screens
KEY_QUIT = 'escape'            # Abort the task (partial data is saved)
```

### Block questions

The `BLOCKS` list in the script defines each block's question and instructions. Edit these to change the wording or add/remove blocks.

---

## 6. Running the Task

### Interactive mode (participant dialog)

```bash
cd /path/to/experiment_platform/psychopy_tasks/two_afc
python two_afc_task.py
```

A dialog box will prompt for `participant_id` and `session` number.

### Command-line mode (skip dialog)

```bash
python two_afc_task.py --participant P001 --session 001
```

### Custom output directory

```bash
python two_afc_task.py --participant P001 --session 001 --output-dir /path/to/save/data
```

### What the participant sees

1. **Transition screen** — "Next: Quick Choices Task" → press SPACE
2. **Instructions** — "How to respond" (F = Left, J = Right) → press SPACE
3. **Practice trials** — fixation cross → two images → press F or J
4. **Practice complete** → press SPACE
5. **Block 1 intro** (Preference) → press SPACE → 32 trials → break at 16 → block end
6. **Block 2 intro** (Spaciousness) → same structure
7. **Block 3 intro** (Anxiety) → same structure
8. **Task complete** — "Please tell the experimenter you are ready" → press SPACE

### Aborting

Press **ESC** at any time. All data collected up to that point is saved.

---

## 7. Output Data

Data files are saved to `data/` with the naming convention:

```
2afc_{participant_id}_{session}_{YYYYMMDD_HHMMSS}.csv
```

### Column reference

| Column | Description |
|---|---|
| `participant_id` | Participant identifier |
| `session` | Session number |
| `date` | Date of the session (YYYY-MM-DD) |
| `time` | Start time of the session (HH:MM:SS) |
| `block_name` | Block name: `Preference`, `Spaciousness`, or `Anxiety` |
| `block_number` | Block number (1, 2, or 3) |
| `trial_in_block` | Trial number within the current block (1–32) |
| `trial_overall` | Cumulative trial number across all blocks (1–96) |
| `pair_id` | Pair identifier from the conditions CSV |
| `image_a` | First image filename as listed in the conditions CSV |
| `image_b` | Second image filename as listed in the conditions CSV |
| `image_left` | Which image was displayed on the left |
| `image_right` | Which image was displayed on the right |
| `position_swapped` | `True` if image_a was shown on the right (positions randomized) |
| `question` | The question shown to the participant |
| `response_key` | Key pressed (`f` or `j`) |
| `choice_side` | Which side was chosen (`left` or `right`) |
| `chosen_image` | Filename of the image the participant chose |
| `rt` | Reaction time in seconds (from stimulus onset to keypress) |

---

## 8. Integration with the Experiment Platform

When using this task within the experiment platform's web interface:

1. In the **Experiment Builder**, add the "2AFC Room Comparison" procedure
2. In the wizard, check **"Perform this task in external software"** and select **PsychoPy**
3. During a session, when the participant reaches the 2AFC step:
   - The **subject's browser** shows a transition screen ("Ready to Start 2AFC Room Comparison")
   - The **experimenter** opens a terminal and launches the task:
     ```bash
     cd psychopy_tasks/two_afc
     python two_afc_task.py --participant P001 --session 001
     ```
   - The task runs full-screen on the participant's monitor
   - When the task finishes, the participant returns to the browser
   - The experimenter clicks **Next** on the experimenter interface

---

## 9. Troubleshooting

| Issue | Solution |
|---|---|
| **"Monitor specification not found"** | Harmless warning. PsychoPy creates a temporary monitor profile. |
| **"Couldn't measure consistent frame rate"** | VSync issue, common on macOS. Does not affect RT measurement (uses `core.Clock`, not frame counting). |
| **"Font Manager failed to load"** | System font inaccessible to PsychoPy. No visual impact. |
| **"Dropped frames" warnings** | Expected on instruction screens where the participant pauses to read. Not a concern during timed trials. |
| **Window doesn't go full-screen** | Ensure no other full-screen apps are active. On macOS, try disabling "Displays have separate Spaces" in System Settings > Desktop & Dock. |
| **Images not found error** | Verify image filenames in the conditions CSV exactly match the files in the corresponding `images/` directory (case-sensitive). |
| **Task crashes on launch** | Run `python -c "from psychopy import visual"` to check if PsychoPy is installed correctly. |
