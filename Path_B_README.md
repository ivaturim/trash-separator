# Path B — Custom TensorFlow/Keras Model

This is the custom Python version from `Project_Guide.md`. It trains a binary classifier for:

- `recyclable`
- `trash`

The training script uses transfer learning with MobileNetV2, then fine-tunes the top layers.

## 1. Install Dependencies

Your Mac has two Python installs:

- `python` -> Anaconda Python 3.12
- `python3` -> Homebrew Python 3.14

Use `python`, not `python3`, for Path B. TensorFlow is not installed in your Homebrew Python, and Homebrew blocks global `pip install`.

Recommended setup:

```bash
cd "/Users/ivaturim/Desktop/Imaki/Studies/Mayukha_Assignments/Trash Separator"
./setup_path_b.sh
source .venv-path-b/bin/activate
```

## 2. Confirm Dataset Layout

The scripts expect:

```text
Dataset/Kaggle Dataset/classified_data/
  train/
    recyclable/
    trash/
  validation/
    recyclable/
    trash/
  test/
    recyclable/
    trash/
```

If that folder is missing, run:

```bash
cd "/Users/ivaturim/Desktop/Imaki/Studies/Mayukha_Assignments/Trash Separator/Dataset"
python prepare_dataset.py
```

## 3. Train Path B

```bash
cd "/Users/ivaturim/Desktop/Imaki/Studies/Mayukha_Assignments/Trash Separator/Dataset"
source ../.venv-path-b/bin/activate
python train_path_b.py
```

The first run downloads pretrained MobileNetV2 weights. Training on CPU can take a while.

Outputs are saved to `Models/`:

```text
Models/
  best_trash_separator.keras
  trash_separator_final.keras
  labels.json
  metrics.json
  confusion_matrix.csv
```

## 4. Predict One Image

```bash
cd "/Users/ivaturim/Desktop/Imaki/Studies/Mayukha_Assignments/Trash Separator/Dataset"
source ../.venv-path-b/bin/activate
python predict_path_b.py "../banana_peel.jpg"
```

## 5. Run the Path B Web App

The trained `.keras` model runs through a small Python backend. The browser sends an image to Flask, Flask loads `Models/trash_separator_final.keras`, and the page displays the prediction.

```bash
cd "/Users/ivaturim/Desktop/Imaki/Studies/Mayukha_Assignments/Trash Separator"
source .venv-path-b/bin/activate
python PathB_Web/app.py
```

Then open:

```text
http://127.0.0.1:5000
```

The page supports image upload and webcam capture.

For mobile app API usage, see:

```text
PathB_Web/API_README.md
```

## Optional Faster Test Run

Use fewer epochs when checking that the pipeline works:

```bash
source ../.venv-path-b/bin/activate
python train_path_b.py --initial-epochs 1 --fine-tune-epochs 1
```
