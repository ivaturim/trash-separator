# Hosting the Trash Separator API

Yes, you can host this API and call it from Thunkable using a public URL plus an API key.

## What Must Be Deployed

Your deployed project must include:

```text
PathB_Web/
Models/
requirements.txt
Procfile
runtime.txt
```

The `Models/` folder must include:

```text
Models/trash_separator_final.keras
Models/labels.json
```

Do not deploy `.venv-path-b/`.

## Recommended Hosting Options

Good beginner-friendly options:

- Render
- Railway
- Fly.io

For a class/demo project, Render or Railway is usually easiest.

## API Key

Set this environment variable on your hosting platform:

```text
TRASH_SEPARATOR_API_KEY=your-long-secret-key
```

Example key:

```text
trash-separator-demo-CHANGE-THIS-12345
```

When this variable is set, API calls must include either:

```text
x-api-key: your-long-secret-key
```

or:

```text
Authorization: Bearer your-long-secret-key
```

`GET /api/v1/health` stays public so you can check if the service is running.

## Render Deployment

1. Put the required files in a GitHub repository, or upload the deployment zip.
2. Go to Render and create a new Web Service.
3. Connect the GitHub repository.
4. Set build command:

```bash
pip install -r requirements.txt
```

5. Set start command:

```bash
gunicorn PathB_Web.app:app --bind 0.0.0.0:$PORT --timeout 120
```

6. Add environment variable:

```text
TRASH_SEPARATOR_API_KEY=your-long-secret-key
```

7. Deploy.

Your public API URL will look like:

```text
https://your-service-name.onrender.com
```

Thunkable should call:

```text
https://your-service-name.onrender.com/api/v1/segregate
```

Do not give the Thunkable team a `localhost`, `127.0.0.1`, or local Wi-Fi IP URL. Those only work on your laptop or local network. They need the public hosted URL.

## Thunkable Request

Use:

```text
Method: POST
URL: https://your-service-name.onrender.com/api/v1/segregate
Header: x-api-key = your-long-secret-key
```

Send the image as either:

1. `multipart/form-data` field named `image`
2. JSON field named `imageBase64`

The API returns:

```json
{
  "success": true,
  "segregation": "trash",
  "bin": "trash",
  "confidence": 0.787192,
  "confidencePercent": 78.7,
  "message": "Trash - put it in the regular trash",
  "instruction": "Put it in the regular trash."
}
```

Display these fields in the app:

- `segregation`
- `confidencePercent`
- `instruction`

## Local Test With API Key

```bash
cd "/Users/ivaturim/Desktop/Imaki/Studies/Mayukha_Assignments/Trash Separator"
source .venv-path-b/bin/activate
export TRASH_SEPARATOR_API_KEY="test-key"
python PathB_Web/app.py
```

Then test:

```bash
curl -X POST \
  -H "x-api-key: test-key" \
  -F "image=@banana_peel.jpg" \
  http://127.0.0.1:5000/api/v1/segregate
```
