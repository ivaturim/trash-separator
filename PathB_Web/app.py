import json
import base64
import os
from io import BytesIO
from pathlib import Path
from datetime import datetime, timezone

import numpy as np
import tensorflow as tf
from flask import Flask, jsonify, render_template, request
from tensorflow import keras


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = PROJECT_ROOT / "Models" / "trash_separator_final.keras"
LABELS_PATH = PROJECT_ROOT / "Models" / "labels.json"
IMAGE_SIZE = (224, 224)
MAX_IMAGE_BYTES = 8 * 1024 * 1024
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
API_KEY = os.environ.get("TRASH_SEPARATOR_API_KEY")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_IMAGE_BYTES


def load_labels() -> list[str]:
    if not LABELS_PATH.exists():
        raise FileNotFoundError(f"Missing labels file: {LABELS_PATH}")
    return json.loads(LABELS_PATH.read_text(encoding="utf-8"))


def load_trained_model() -> keras.Model:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Missing trained model: {MODEL_PATH}")
    return keras.models.load_model(MODEL_PATH)


class_names = load_labels()
model = load_trained_model()


def error_response(message: str, status_code: int):
    response = jsonify({"error": {"message": message, "statusCode": status_code}})
    response.status_code = status_code
    return response


def request_has_valid_api_key() -> bool:
    if not API_KEY:
        return True

    header_key = request.headers.get("x-api-key")
    auth_header = request.headers.get("Authorization", "")
    bearer_key = auth_header.removeprefix("Bearer ").strip()
    return header_key == API_KEY or bearer_key == API_KEY


@app.before_request
def require_api_key():
    if request.method == "OPTIONS":
        return None

    if request.path.startswith("/api/") and request.path != "/api/v1/health":
        if not request_has_valid_api_key():
            return error_response("Missing or invalid API key.", 401)

    return None


@app.after_request
def add_api_headers(response):
    # Helpful for local mobile/web testing. Restrict this before public deployment.
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, x-api-key, Authorization"
    return response


def validate_upload(file_storage) -> None:
    if file_storage.filename:
        suffix = Path(file_storage.filename).suffix.lower()
        if suffix and suffix not in ALLOWED_EXTENSIONS:
            allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
            raise ValueError(f"Unsupported image type. Allowed: {allowed}")


def image_bytes_to_batch(image_bytes: bytes) -> np.ndarray:
    if not image_bytes:
        raise ValueError("Image is empty.")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise ValueError("Image is too large. Maximum size is 8 MB.")

    image = keras.utils.load_img(BytesIO(image_bytes), target_size=IMAGE_SIZE)
    image_array = keras.utils.img_to_array(image)
    return np.expand_dims(image_array, axis=0)


def image_file_to_batch(file_storage) -> np.ndarray:
    validate_upload(file_storage)
    return image_bytes_to_batch(file_storage.read())


def format_prediction(raw_prediction: np.ndarray) -> dict:
    positive_probability = float(raw_prediction[0][0])
    probabilities = {
        class_names[0]: round(1.0 - positive_probability, 6),
        class_names[1]: round(positive_probability, 6),
    }
    top_class = max(probabilities, key=probabilities.get)
    confidence = probabilities[top_class]
    is_recyclable = "recycl" in top_class.lower()

    return {
        "topClass": top_class,
        "confidence": confidence,
        "probabilities": probabilities,
        "disposal": {
            "bin": "recycling" if is_recyclable else "trash",
            "instruction": (
                "Put it in the recycling bin."
                if is_recyclable
                else "Put it in the regular trash."
            ),
        },
        "message": (
            "Recyclable - put it in the recycling bin"
            if is_recyclable
            else "Trash - put it in the regular trash"
        ),
    }


def predict_batch(image_batch: np.ndarray) -> dict:
    raw_prediction = model.predict(image_batch, verbose=0)
    return format_prediction(raw_prediction)


def predict_image(file_storage) -> dict:
    return predict_batch(image_file_to_batch(file_storage))


def thunkable_response(prediction: dict) -> dict:
    return {
        "success": True,
        "segregation": prediction["topClass"],
        "bin": prediction["disposal"]["bin"],
        "confidence": prediction["confidence"],
        "confidencePercent": round(prediction["confidence"] * 100, 1),
        "message": prediction["message"],
        "instruction": prediction["disposal"]["instruction"],
        "probabilities": prediction["probabilities"],
    }


def model_metadata() -> dict:
    return {
        "modelName": MODEL_PATH.name,
        "modelPath": str(MODEL_PATH),
        "labels": class_names,
        "imageSize": {"width": IMAGE_SIZE[0], "height": IMAGE_SIZE[1]},
        "maxImageBytes": MAX_IMAGE_BYTES,
        "allowedExtensions": sorted(ALLOWED_EXTENSIONS),
        "tensorflow": tf.__version__,
    }


@app.get("/")
def home():
    return render_template("index.html")


@app.get("/health")
def health():
    return jsonify(
        {
            "status": "ok",
            **model_metadata(),
        }
    )


@app.get("/api/v1/health")
def api_health():
    return jsonify(
        {
            "status": "ok",
            "service": "trash-separator-api",
            "apiKeyEnabled": bool(API_KEY),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )


@app.get("/api/v1/model")
def api_model():
    return jsonify(model_metadata())


@app.get("/api/v1/labels")
def api_labels():
    return jsonify({"labels": class_names})


@app.route("/api/v1/predict", methods=["POST", "OPTIONS"])
def api_predict_upload():
    if request.method == "OPTIONS":
        return ("", 204)

    if "image" not in request.files:
        return error_response("Upload field must be named 'image'.", 400)

    image = request.files["image"]
    if image.filename == "":
        return error_response("No image selected.", 400)

    try:
        return jsonify({"prediction": predict_image(image)})
    except ValueError as exc:
        return error_response(str(exc), 400)
    except Exception as exc:
        return error_response(str(exc), 500)


@app.route("/api/v1/predict-base64", methods=["POST", "OPTIONS"])
def api_predict_base64():
    if request.method == "OPTIONS":
        return ("", 204)

    payload = request.get_json(silent=True) or {}
    image_base64 = payload.get("imageBase64")
    if not image_base64:
        return error_response("JSON body must include 'imageBase64'.", 400)

    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(image_base64, validate=True)
        return jsonify({"prediction": predict_batch(image_bytes_to_batch(image_bytes))})
    except ValueError as exc:
        return error_response(str(exc), 400)
    except Exception as exc:
        return error_response(str(exc), 500)


@app.route("/api/v1/segregate", methods=["POST", "OPTIONS"])
def api_segregate():
    """Thunkable-friendly endpoint with a flat response shape."""
    if request.method == "OPTIONS":
        return ("", 204)

    try:
        if "image" in request.files:
            image = request.files["image"]
            if image.filename == "":
                return error_response("No image selected.", 400)
            prediction = predict_image(image)
            return jsonify(thunkable_response(prediction))

        payload = request.get_json(silent=True) or {}
        image_base64 = payload.get("imageBase64")
        if not image_base64:
            return error_response(
                "Send multipart field 'image' or JSON field 'imageBase64'.",
                400,
            )

        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]

        image_bytes = base64.b64decode(image_base64, validate=True)
        prediction = predict_batch(image_bytes_to_batch(image_bytes))
        return jsonify(thunkable_response(prediction))
    except ValueError as exc:
        return error_response(str(exc), 400)
    except Exception as exc:
        return error_response(str(exc), 500)


@app.post("/predict")
def predict():
    if "image" not in request.files:
        return jsonify({"error": "Upload field must be named 'image'."}), 400

    image = request.files["image"]
    if image.filename == "":
        return jsonify({"error": "No image selected."}), 400

    try:
        return jsonify(predict_image(image))
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
