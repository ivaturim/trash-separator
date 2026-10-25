# Trash Separator — Image Classification Project Guide

A step-by-step plan for building an image classifier that sorts trash images into **plain trash** vs **recyclable material**.

---

## Phase 1 — Define the Problem

**1.1 Decide your classes.** Start simple, expand later.

- *Binary (easiest):* `trash` vs `recyclable`
- *Multi-class (better real-world utility):* `plastic`, `paper`, `metal`, `glass`, `cardboard`, `organic`, `trash`

A binary model is great for a first version. Multi-class gives more useful output (you can tell users *which* recycling bin), but needs more data.

**1.2 Choose your approach.**

- **Path A — No-code (Google Teachable Machine):** fastest path to a working demo. Browser-based, drag-and-drop training, exports a model you can embed in a webpage. Best if you want a working prototype today.
- **Path B — Custom (Python + TensorFlow/Keras):** more control, better accuracy, deployable anywhere. Uses *transfer learning* on a pretrained model (MobileNetV2 or ResNet50) so you don't need millions of images.

Recommendation: build Path A first to validate the idea, then move to Path B for the final version.

---

## Phase 2 — Collect Your Dataset

Image classifiers learn from examples. The dataset is the most important part of the project.

**2.1 Use existing datasets to bootstrap.**

- **TrashNet** (Stanford) — ~2,500 images across 6 classes (glass, paper, cardboard, plastic, metal, trash). Free on GitHub.
- **TACO (Trash Annotations in Context)** — larger, real-world trash images in natural settings.
- **Waste Classification Data** (Kaggle) — ~25,000 images split into organic vs recyclable.

**2.2 Augment with your own photos.** Real images from your environment improve real-world performance. Aim for at least 100 images per class to start, 500+ for production quality.

- Vary backgrounds, lighting, angles, distances.
- Include "messy" examples (crumpled, dirty, partially obscured).
- Keep classes roughly balanced — within 2× of each other.

**2.3 Organize folders like this:**

```
dataset/
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

Split roughly 70% train / 15% validation / 15% test.

---

## Phase 3 — Train the Model

### Path A — Google Teachable Machine

1. Go to teachablemachine.withgoogle.com and pick **Image Project → Standard image model**.
2. Create a class for each category. Upload your images (or use the webcam).
3. Click **Train Model**. Training takes 1–3 minutes in the browser.
4. Preview accuracy with the live webcam. If results look bad, add more/better images and retrain.
5. **Export Model → TensorFlow.js → Download.** You'll get a `model.json` + weights file.

### Path B — Custom training with Transfer Learning

The high-level workflow in Python:

1. Load a pretrained base model (e.g., `MobileNetV2(weights="imagenet", include_top=False)`).
2. Freeze the base model's weights — you're reusing its learned visual features.
3. Add a small head: `GlobalAveragePooling2D → Dense(128, relu) → Dropout → Dense(num_classes, softmax)`.
4. Compile with Adam optimizer and categorical crossentropy loss.
5. Use `ImageDataGenerator` for augmentation: rotations, flips, zoom, brightness shifts.
6. Train for ~10–20 epochs at low learning rate (1e-3).
7. **Fine-tune:** unfreeze the top few layers of the base model and train another 5–10 epochs at a very low learning rate (1e-5).

Expect 85–95% accuracy on a clean binary dataset, 75–90% on multi-class.

---

## Phase 4 — Evaluate the Model

**4.1 Test on held-out images** the model has never seen.

**4.2 Build a confusion matrix.** Which classes get confused with which? This tells you where to add more training data.

**4.3 Test on real-world examples.** Models often look great on clean datasets and fail on messy real photos. Take pictures of trash in your actual kitchen/office and test those.

**4.4 Common failure modes to check for:**

- Background bias (the model learned "white background = recyclable" instead of learning the object).
- Lighting sensitivity.
- Items it's never seen (out-of-distribution).

---

## Phase 5 — Build the Interface

Once you have a trained model, you need a way for users to use it.

**Option 1 — Web app (recommended for first version).** Single HTML page that loads the model with TensorFlow.js, lets the user upload or webcam-capture an image, and shows the prediction. No backend needed — runs entirely in the browser. Teachable Machine even gives you starter code.

**Option 2 — Mobile app.** Use TensorFlow Lite for Android/iOS, or React Native with a TF.js wrapper. Good if you want a phone-camera-based sorter.

**Option 3 — Hardware integration.** A Raspberry Pi with a camera + servo motor can physically sort trash into bins. The Pi runs the model on each captured image and triggers the appropriate servo.

---

## Phase 6 — Deploy & Iterate

**6.1 Host the web app** on GitHub Pages, Netlify, or Vercel (all free).

**6.2 Collect failure cases.** Add a "this is wrong" button so users can flag misclassifications. Save those images and retrain periodically.

**6.3 Version your model.** Keep old versions so you can roll back if a retrain makes things worse.

---

## Suggested Timeline

| Week | Focus |
|------|-------|
| 1 | Phase 1–2: choose classes, gather a starter dataset |
| 2 | Phase 3 Path A: train in Teachable Machine, get a working demo |
| 3 | Phase 4: evaluate, identify weaknesses, collect more data |
| 4 | Phase 3 Path B: custom Python training for better accuracy |
| 5 | Phase 5: build the web/mobile interface |
| 6 | Phase 6: deploy, gather feedback, iterate |

---

## What You'll Need

- A computer (any modern laptop works for Path A; a GPU helps for Path B but isn't required if you use Google Colab's free GPU).
- A smartphone or camera for collecting your own images.
- Free accounts: Google (for Teachable Machine / Colab), GitHub (to host code & web app).
- Optional for Path B: Python 3.10+, TensorFlow 2.x, Jupyter or VS Code.

---

## Next Step

Tell me which path you want to start with and I'll walk you through it in detail — including the actual code/setup for the Python version, or a step-by-step Teachable Machine walkthrough with a starter web page you can deploy.
