#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Two-Alternative Forced Choice (2AFC) Room Comparison Task
=========================================================

Implements the 2AFC experiment for room image comparison with:
- Transition screen (from VR or previous task)
- General instructions
- Practice block (configurable trials with neutral images)
- 3 experimental blocks: Preference, Spaciousness, Anxiety
- 32 trials per block with mid-block break after trial 16
- F/J keyboard response for Left/Right image choice
- Reaction time measurement with sub-ms precision
- CSV data output

Setup:
    1. Install PsychoPy: pip install psychopy
    2. Place room images in ./images/practice/ and ./images/experimental/
    3. Edit conditions CSV files in ./conditions/
    4. Run: python two_afc_task.py

Optional CLI arguments (for experiment platform integration):
    python two_afc_task.py --participant P001 --session 001 --output-dir ./data

Conditions CSV format:
    pair_id,image_a,image_b
    1,room_01.png,room_02.png
"""

from psychopy import visual, core, event, gui
import os
import csv
import random
import argparse
from datetime import datetime

# ============================================================
# CONFIGURATION
# ============================================================

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Paths (relative to this script)
PRACTICE_CONDITIONS = os.path.join(SCRIPT_DIR, 'conditions', 'practice_pairs.csv')
EXPERIMENTAL_CONDITIONS = os.path.join(SCRIPT_DIR, 'conditions', 'experimental_pairs.csv')
PRACTICE_IMAGE_DIR = os.path.join(SCRIPT_DIR, 'images', 'practice')
EXPERIMENTAL_IMAGE_DIR = os.path.join(SCRIPT_DIR, 'images', 'experimental')
DEFAULT_DATA_DIR = os.path.join(SCRIPT_DIR, 'data')

# Timing
FIXATION_DURATION = 0.5       # seconds
POST_RESPONSE_BLANK = 0.2     # brief blank after each response

# Trial structure
TRIALS_PER_BLOCK = 32          # Set to 32 for full experiment; 4 for quick testing
MID_BREAK_AFTER_TRIAL = 16     # Set to 16 for full experiment; 2 for quick testing
NUM_PRACTICE_TRIALS = 6       # Set to 6 for full experiment; 2 for quick testing

# Response keys
KEY_LEFT = 'f'
KEY_RIGHT = 'j'
KEY_ADVANCE = 'space'
KEY_QUIT = 'escape'

# Display settings (units = 'height': screen height = 1.0)
BACKGROUND_COLOR = [0.5, 0.5, 0.5]   # light gray
TEXT_COLOR = [-1, -1, -1]             # black
IMAGE_SIZE = (0.45, 0.35)             # width, height in 'height' units
IMAGE_POS_LEFT = (-0.3, -0.05)
IMAGE_POS_RIGHT = (0.3, -0.05)

# Block definitions matching the 2AFC design procedure
BLOCKS = [
    {
        'name': 'Preference',
        'number': 1,
        'question': 'Which room do you prefer overall?',
        'intro_body': (
            'Choose the image you personally prefer.\n'
            'Respond quickly based on your impression.'
        ),
        'end_body': 'Next, you will judge spaciousness.',
    },
    {
        'name': 'Spaciousness',
        'number': 2,
        'question': 'Which room feels more spacious?',
        'intro_body': (
            'Choose the room that seems to have more open space.\n'
            'Respond quickly based on your impression.'
        ),
        'end_body': 'Next, you will judge anxiety.',
    },
    {
        'name': 'Stimulation',
        'number': 3,
        'question': 'Which room feels more stimulating?',
        'intro_body': (
            'Choose the room that would make you feel more stimulating\n'
            'or activating.\n'
            'Respond quickly based on your impression.'
        ),
        'end_body': None,
    },
]


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def parse_args():
    """Parse optional CLI arguments for platform integration."""
    parser = argparse.ArgumentParser(description='2AFC Room Comparison Task')
    parser.add_argument('--participant', '-p', type=str, default=None,
                        help='Participant ID (skips dialog if provided)')
    parser.add_argument('--session', '-s', type=str, default='001',
                        help='Session number (default: 001)')
    parser.add_argument('--output-dir', '-o', type=str, default=None,
                        help='Output directory for data files')
    return parser.parse_args()


def load_pairs(csv_path):
    """Load image pairs from a CSV conditions file."""
    if not os.path.exists(csv_path):
        raise FileNotFoundError(
            f"Conditions file not found: {csv_path}\n"
            f"Please create it with columns: pair_id, image_a, image_b"
        )
    pairs = []
    with open(csv_path, 'r', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            pairs.append({
                'pair_id': row['pair_id'].strip(),
                'image_a': row['image_a'].strip(),
                'image_b': row['image_b'].strip(),
            })
    return pairs


def get_participant_info(cli_args):
    """Collect participant info from CLI args or GUI dialog."""
    if cli_args.participant:
        return {
            'participant_id': cli_args.participant,
            'session': cli_args.session,
        }

    info = {
        'participant_id': '',
        'session': '001',
    }
    dlg = gui.DlgFromDict(
        dictionary=info,
        title='2AFC Room Comparison Task',
        order=['participant_id', 'session'],
    )
    if not dlg.OK:
        core.quit()
    return info


def create_data_file(participant_info, data_dir):
    """Create a timestamped CSV data file and return writer, handle, path."""
    os.makedirs(data_dir, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    pid = participant_info['participant_id']
    sess = participant_info['session']
    filename = f"2afc_{pid}_{sess}_{timestamp}.csv"
    filepath = os.path.join(data_dir, filename)

    f = open(filepath, 'w', newline='')
    writer = csv.writer(f)
    writer.writerow([
        'participant_id', 'session', 'date', 'time',
        'block_name', 'block_number', 'trial_in_block', 'trial_overall',
        'pair_id', 'image_a', 'image_b',
        'image_left', 'image_right', 'position_swapped',
        'question', 'response_key', 'choice_side', 'chosen_image', 'rt',
    ])
    return writer, f, filepath


def check_quit(keys=None):
    """Check if escape was pressed and quit gracefully."""
    if keys and KEY_QUIT in [k[0] if isinstance(k, tuple) else k for k in keys]:
        core.quit()
    if event.getKeys(keyList=[KEY_QUIT]):
        core.quit()


def show_text_screen(win, stims, title='', body='', footer=''):
    """
    Display an instruction/transition screen and wait for SPACE.

    Parameters
    ----------
    stims : dict with keys 'title', 'body', 'footer' (TextStim objects)
    """
    stims['title'].text = title
    stims['body'].text = body
    stims['footer'].text = footer

    stims['title'].draw()
    stims['body'].draw()
    stims['footer'].draw()
    win.flip()

    keys = event.waitKeys(keyList=[KEY_ADVANCE, KEY_QUIT])
    if KEY_QUIT in keys:
        core.quit()


def run_trial(win, pair, question, image_dir, trial_clock, stims):
    """
    Run a single 2AFC trial: fixation -> stimulus -> response.

    Returns a dict with trial data including choice and RT.
    """
    # Randomly assign left/right positions
    swapped = random.random() < 0.5
    if swapped:
        left_img_name = pair['image_b']
        right_img_name = pair['image_a']
    else:
        left_img_name = pair['image_a']
        right_img_name = pair['image_b']

    left_img_path = os.path.join(image_dir, left_img_name)
    right_img_path = os.path.join(image_dir, right_img_name)

    # --- Fixation cross ---
    stims['fixation'].draw()
    win.flip()
    core.wait(FIXATION_DURATION)

    # --- Stimulus display ---
    stims['img_left'].image = left_img_path
    stims['img_right'].image = right_img_path
    stims['prompt'].text = question
    stims['hint'].text = 'F = Left     J = Right'

    stims['prompt'].draw()
    stims['hint'].draw()
    stims['img_left'].draw()
    stims['img_right'].draw()
    win.flip()

    # --- Collect response ---
    event.clearEvents()
    trial_clock.reset()
    keys = event.waitKeys(
        keyList=[KEY_LEFT, KEY_RIGHT, KEY_QUIT],
        timeStamped=trial_clock,
    )

    key, rt = keys[0]
    if key == KEY_QUIT:
        core.quit()

    choice_side = 'left' if key == KEY_LEFT else 'right'
    chosen_image = left_img_name if choice_side == 'left' else right_img_name

    # Brief blank between trials
    win.flip()
    core.wait(POST_RESPONSE_BLANK)

    return {
        'pair_id': pair['pair_id'],
        'image_a': pair['image_a'],
        'image_b': pair['image_b'],
        'image_left': left_img_name,
        'image_right': right_img_name,
        'position_swapped': swapped,
        'question': question,
        'response_key': key,
        'choice_side': choice_side,
        'chosen_image': chosen_image,
        'rt': round(rt, 6),
    }


def prepare_block_pairs(experimental_pairs, trials_needed):
    """Prepare a shuffled list of pairs for one block, recycling if needed."""
    block_pairs = experimental_pairs.copy()
    random.shuffle(block_pairs)

    if len(block_pairs) >= trials_needed:
        return block_pairs[:trials_needed]

    # Recycle pairs if fewer than needed
    while len(block_pairs) < trials_needed:
        extra = experimental_pairs.copy()
        random.shuffle(extra)
        block_pairs.extend(extra)
    return block_pairs[:trials_needed]


# ============================================================
# MAIN EXPERIMENT
# ============================================================

def main():
    args = parse_args()

    # --- Participant info ---
    participant_info = get_participant_info(args)
    date_str = datetime.now().strftime('%Y-%m-%d')
    time_str = datetime.now().strftime('%H:%M:%S')

    # --- Data file ---
    data_dir = args.output_dir if args.output_dir else DEFAULT_DATA_DIR
    csv_writer, csv_file, data_filepath = create_data_file(participant_info, data_dir)
    print(f"Data will be saved to: {data_filepath}")

    # --- Load conditions ---
    practice_pairs = load_pairs(PRACTICE_CONDITIONS)
    experimental_pairs = load_pairs(EXPERIMENTAL_CONDITIONS)

    if len(experimental_pairs) < TRIALS_PER_BLOCK:
        print(
            f"Note: {len(experimental_pairs)} experimental pairs found, "
            f"{TRIALS_PER_BLOCK} needed per block. Pairs will be recycled."
        )

    # --- Window ---
    win = visual.Window(
        fullscr=True,
        color=BACKGROUND_COLOR,
        units='height',
        allowGUI=False,
    )

    # --- Create reusable stimuli ---
    stims = {
        'title': visual.TextStim(
            win, pos=(0, 0.35), height=0.05, color=TEXT_COLOR,
            bold=True, wrapWidth=1.5,
        ),
        'body': visual.TextStim(
            win, pos=(0, 0.05), height=0.035, color=TEXT_COLOR,
            wrapWidth=1.2, alignText='center',
        ),
        'footer': visual.TextStim(
            win, pos=(0, -0.35), height=0.03, color=TEXT_COLOR,
            italic=True, wrapWidth=1.2,
        ),
        'fixation': visual.TextStim(
            win, text='+', pos=(0, 0), height=0.08, color=TEXT_COLOR,
            bold=True,
        ),
        'prompt': visual.TextStim(
            win, pos=(0, 0.38), height=0.04, color=TEXT_COLOR,
            bold=True, wrapWidth=1.5,
        ),
        'hint': visual.TextStim(
            win, pos=(0, 0.30), height=0.03, color=TEXT_COLOR,
            wrapWidth=1.5,
        ),
        'img_left': visual.ImageStim(
            win, pos=IMAGE_POS_LEFT, size=IMAGE_SIZE,
        ),
        'img_right': visual.ImageStim(
            win, pos=IMAGE_POS_RIGHT, size=IMAGE_SIZE,
        ),
    }

    trial_clock = core.Clock()
    trial_counter = 0

    # ========================================
    # SCREEN 0 — Transition from VR
    # ========================================
    show_text_screen(
        win, stims,
        title='Next: Quick Choices Task',
        body=(
            'You will now complete a short decision task.\n\n'
            'On each trial, you will see two room images side by side.\n'
            'Your job is to choose the option that best fits the question.\n\n'
            'Please respond quickly and accurately.\n'
            'There are no right or wrong answers.'
        ),
        footer='Press SPACE to begin.',
    )

    # ========================================
    # SCREEN 1 — General instructions
    # ========================================
    show_text_screen(
        win, stims,
        title='How to respond',
        body=(
            'On each trial, choose Left or Right.\n\n'
            '\u25cf  Press F to choose the LEFT image\n'
            '\u25cf  Press J to choose the RIGHT image\n\n'
            'Keep your index fingers resting on F and J.'
        ),
        footer='Press SPACE to start practice.',
    )

    # ========================================
    # PRACTICE BLOCK
    # ========================================
    num_practice = min(NUM_PRACTICE_TRIALS, len(practice_pairs))

    show_text_screen(
        win, stims,
        title='Practice',
        body=(
            'Practice a few trials to get used to the timing and keys.\n'
            'Respond as soon as you know your choice.'
        ),
        footer='Press SPACE to begin practice.',
    )

    practice_selection = practice_pairs[:num_practice]
    random.shuffle(practice_selection)

    for pair in practice_selection:
        run_trial(
            win, pair, 'Which room do you prefer?',
            PRACTICE_IMAGE_DIR, trial_clock, stims,
        )

    # Practice complete
    show_text_screen(
        win, stims,
        title='Practice complete',
        body=(
            'Great. Now the real task will begin.\n\n'
            'Remember: F = Left and J = Right.'
        ),
        footer='Press SPACE to continue.',
    )

    # ========================================
    # EXPERIMENTAL BLOCKS (3 blocks, randomized order)
    # ========================================
    blocks = [b.copy() for b in BLOCKS]
    random.shuffle(blocks)
    for i, block in enumerate(blocks, start=1):
        block['number'] = i
        if i < len(blocks):
            block['end_body'] = f"Next, you will judge {blocks[i]['name'].lower()}."
        else:
            block['end_body'] = None

    for block in blocks:
        # --- Block intro ---
        show_text_screen(
            win, stims,
            title=f"Block {block['number']} of {len(blocks)}",
            body=f"{block['question']}\n\n{block['intro_body']}",
            footer=f"Press SPACE to start Block {block['number']}.",
        )

        block_pairs = prepare_block_pairs(experimental_pairs, TRIALS_PER_BLOCK)

        # --- Run trials ---
        for trial_idx, pair in enumerate(block_pairs, start=1):
            trial_counter += 1

            trial_data = run_trial(
                win, pair, block['question'],
                EXPERIMENTAL_IMAGE_DIR, trial_clock, stims,
            )

            # Write row to CSV
            csv_writer.writerow([
                participant_info['participant_id'],
                participant_info['session'],
                date_str, time_str,
                block['name'], block['number'],
                trial_idx, trial_counter,
                trial_data['pair_id'],
                trial_data['image_a'], trial_data['image_b'],
                trial_data['image_left'], trial_data['image_right'],
                trial_data['position_swapped'],
                trial_data['question'],
                trial_data['response_key'],
                trial_data['choice_side'],
                trial_data['chosen_image'],
                trial_data['rt'],
            ])
            csv_file.flush()

            # --- Mid-block break ---
            if trial_idx == MID_BREAK_AFTER_TRIAL:
                show_text_screen(
                    win, stims,
                    title='Quick break',
                    body=(
                        'You are halfway through this block.\n\n'
                        'Relax your hands briefly, then continue when ready.'
                    ),
                    footer='Press SPACE to continue.',
                )

        # --- Block end screen ---
        if block['end_body']:
            show_text_screen(
                win, stims,
                title=f"Block {block['number']} complete",
                body=block['end_body'],
                footer='Press SPACE to continue.',
            )

    # ========================================
    # TASK COMPLETE
    # ========================================
    show_text_screen(
        win, stims,
        title='Choices task complete',
        body=(
            'Thank you. You have finished this section.\n\n'
            'Please tell the experimenter you are ready for the next step.'
        ),
        footer='Press SPACE to finish.',
    )

    # --- Cleanup ---
    csv_file.close()
    win.close()
    print(f"Task complete. Data saved to: {data_filepath}")
    core.quit()


if __name__ == '__main__':
    main()
