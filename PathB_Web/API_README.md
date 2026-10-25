# Trash Separator Mobile API

This API serves the trained Path B model from:

```text
Models/trash_separator_final.keras
Models/labels.json
```

Run the API:

```bash
cd "/Users/ivaturim/Desktop/Imaki/Studies/Mayukha_Assignments/Trash Separator"
source .venv-path-b/bin/activate
python PathB_Web/app.py
```

The server listens on:

```text
http://0.0.0.0:5000
```

From the same laptop, use:

```text
http://127.0.0.1:5000
```

From a phone on the same Wi-Fi, use the laptop's local IP address:

```text
http://<laptop-local-ip>:5000
```

On macOS, find it with:

```bash
ipconfig getifaddr en0
```

## Endpoints

### GET `/api/v1/health`

Checks that the API is running.

Example response:

```json
{
  "status": "ok",
  "service": "trash-separator-api",
  "timestamp": "2026-08-20T03:00:00+00:00"
}
```

### GET `/api/v1/model`

Returns model metadata.

Example response:

```json
{
  "modelName": "trash_separator_final.keras",
  "modelPath": ".../Models/trash_separator_final.keras",
  "labels": ["recyclable", "trash"],
  "imageSize": { "width": 224, "height": 224 },
  "maxImageBytes": 8388608,
  "allowedExtensions": [".jpeg", ".jpg", ".png", ".webp"],
  "tensorflow": "2.21.0"
}
```

### GET `/api/v1/labels`

Returns the possible classes.

Example response:

```json
{
  "labels": ["recyclable", "trash"]
}
```

### POST `/api/v1/predict`

Best endpoint for a mobile app. Send the image as `multipart/form-data` with field name `image`.

Example using curl:

```bash
curl -X POST \
  -F "image=@banana_peel.jpg" \
  http://127.0.0.1:5000/api/v1/predict
```

Example response:

```json
{
  "prediction": {
    "topClass": "trash",
    "confidence": 0.787192,
    "probabilities": {
      "recyclable": 0.212808,
      "trash": 0.787192
    },
    "disposal": {
      "bin": "trash",
      "instruction": "Put it in the regular trash."
    },
    "message": "Trash - put it in the regular trash"
  }
}
```

### POST `/api/v1/predict-base64`

Alternative endpoint if your mobile app prefers JSON. Send a base64 image.

Request body:

```json
{
  "imageBase64": "/9j/4AAQSkZJRgABAQ..."
}
```

Data URLs also work:

```json
{
  "imageBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ..."
}
```

### POST `/api/v1/segregate`

Recommended for Thunkable. It returns flat JSON fields that are easy to display in the app.

You can call it in either of these ways:

1. Send `multipart/form-data` with image field name `image`.
2. Send JSON with an `imageBase64` field.

Example JSON request:

```json
{
  "imageBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ..."
}
```

Example response:

```json
{
  "success": true,
  "segregation": "trash",
  "bin": "trash",
  "confidence": 0.787192,
  "confidencePercent": 78.7,
  "message": "Trash - put it in the regular trash",
  "instruction": "Put it in the regular trash.",
  "probabilities": {
    "recyclable": 0.212808,
    "trash": 0.787192
  }
}
```

In Thunkable, display:

- `segregation` as the classification result.
- `confidencePercent` as the confidence score.
- `instruction` as the user-friendly disposal instruction.

## Mobile Integration Notes

- Use `/api/v1/predict` for camera images if your framework supports multipart upload.
- Use `/api/v1/predict-base64` only if multipart upload is inconvenient.
- Use `/api/v1/segregate` for Thunkable because its response is easiest to bind to UI labels.
- Resize/compress camera images before upload when possible. The API accepts up to 8 MB.
- The API currently allows all origins for local testing. Restrict CORS before deploying publicly.
- For production, run this behind a real WSGI server such as Gunicorn or deploy it as a cloud API.

## Example JavaScript Fetch

```javascript
async function classifyImage(file) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch("http://<laptop-local-ip>:5000/api/v1/predict", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Prediction failed");
  }

  return response.json();
}
```
