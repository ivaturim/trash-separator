# Trash Separator Mobile App

Expo + React Native + TypeScript app for classifying waste items using the hosted Flask model API.

## API Used

```text
https://ivaturim-trash-separator-api.hf.space/api/v1/segregate
```

The app sends a photo as `multipart/form-data` with field name `image`.

## Run

```bash
cd "/Users/ivaturim/Desktop/Imaki/Studies/Mayukha_Assignments/Trash Separator/MobileApp"
npm install
npm run start
```

Then open the **Expo Go** app on your iPhone and scan the QR code from inside Expo Go.

### Expo Go says "The request timed out"

The phone cannot reach the Metro server at `exp://<laptop-ip>:8081`. On this laptop:

- Tunnel mode (`npm run start:tunnel`) does **not** work. A Zscaler-style security client on
  `utun4` blocks outbound connections to ngrok, so the tunnel never finishes connecting.
- The macOS firewall is on but already allows incoming connections for Node, so it is not
  the blocker.

To confirm where it breaks, start `npm run start:lan`, then open Safari on the phone and
visit `http://<laptop-ip>:8081/status`. It should print `packager-status:running`.

If that page does not load, the phone and laptop cannot reach each other over Wi-Fi. The
most reliable fix on a managed or guest network is to turn on Personal Hotspot on the phone
and connect the laptop to it, which puts both devices on the same private network. Then
restart `npm run start:lan` so Metro picks up the new IP.

### Expo Go says "You need to be signed in to Expo Go and Expo CLI"

Expo Go on the phone is signed in to an Expo account but the CLI on the laptop is not, so
Expo Go refuses to open a dev server it cannot attribute to that account. Check the account
name under the Profile tab in Expo Go, then sign in with the same one:

```bash
npx expo login
npx expo whoami   # confirm
```

If `npx expo login` reports "Your username, email, or password was incorrect" even with the
right password, the account was most likely created through Google or GitHub sign-in and has
no password. Use browser login instead, which supports those providers:

```bash
npx expo login --browser
```

Restart the dev server afterwards so the manifest picks up the new identity.

Signing out of Expo Go on the phone instead also works, and needs no credentials.

### Other QR issues

If the iPhone Camera app says "no usable data", do one of these:

1. Open Expo Go first, then use Expo Go's QR scanner.
2. Type the Metro URL shown in the terminal into Safari on your phone, for example:

```text
exp://192.168.1.227:8081
```

3. If your phone and laptop are not on the same Wi-Fi, use tunnel mode:

```bash
npm run start:tunnel
```

You can also force LAN mode:

```bash
npm run start:lan
```

## Features

- Take a photo with the phone camera
- Choose a photo from gallery
- Send image to hosted API
- Show segregation result
- Show confidence percentage and confidence bar
- Show disposal instruction
- Retry failed classification
- Save recent classifications locally
- Ask an AI assistant follow-up questions about a classified item
- Track cumulative environmental impact on the Impact screen
- Scan barcodes on packaged goods for packaging and Eco-Score data

## Barcode Scanning

"Scan Barcode" on the home screen opens a full-screen scanner and looks the
code up in Open Food Facts, which needs no API key:

```text
https://world.openfoodfacts.org/api/v2/product/{barcode}.json
```

Scanning uses `expo-camera`'s `CameraView`, not `expo-barcode-scanner`. That
package was removed after SDK 50 and its native module is not in Expo Go, so it
cannot work on this SDK.

Packaging components come from the `packagings` array, whose entries are
partial: some list only a shape with no material, and those are skipped.
Material and recycling values are taxonomy ids such as `en:clear-glass` and
`en:recycle-in-glass-bin`, which `src/lib/ecoscore.ts` humanizes and maps to a
recyclable/trash/unknown verdict. The API's `recycling` field wins when present;
otherwise the material decides, and ambiguous cases such as generic plastic stay
"unknown" rather than guessing.

`ecoscore_grade` is often `unknown` or `not-applicable` even for well-known
products, so the badge shows "?" with a gray colour in those cases.

Scans are saved to the same `classificationHistory` key as photo classifications
with `type: "barcode"`, so they count towards the Impact screen. A product whose
packaging is only partly recyclable is stored as recyclable, since some of its
packaging genuinely is recycled.

## Impact Screen

Reached from the "Your impact" row on the home screen. It aggregates everything
stored under the `classificationHistory` AsyncStorage key: total items, a
recycled-vs-trashed donut, estimated CO2 and water savings, a day streak, the
top three materials, and a Monday-to-Sunday chart for the current week.
"Share My Impact" captures the cards as a PNG and opens the system share sheet.

CO2 and water figures come from the per-material table in
`src/lib/impactCalculator.ts`. The current model only reports recyclable or
trash rather than a material, so those entries are credited with
`MIXED_RECYCLABLE_IMPACT`, the mean of the five known recyclable materials.
When the model gains material classes, `inferMaterial` in
`src/lib/historyStore.ts` picks them up automatically from `probabilities` and
the exact per-material coefficients apply.

## AI Chat Setup

The "Ask AI" button opens a chat backed by OpenAI's Chat Completions API
(`gpt-4o-mini`). It needs a key before it will respond:

```bash
cp .env.example .env         # then paste your key into .env
npx expo start --clear       # .env is only read at server startup
```

Get a key at https://platform.openai.com/api-keys. Until a key is present, the
chat screen explains what is missing instead of failing on send.

Conversations are stored in AsyncStorage under `trash-separator-chat:<id>`, keyed
by classification, so reopening an item restores its chat. Clearing the history
list on the home screen also deletes the stored conversations.

Note that `EXPO_PUBLIC_` variables are compiled into the JavaScript bundle, so
the key is readable by anyone with the built app. That is fine for coursework
with a spending limit set, but a public release should proxy these calls through
a backend that holds the key.

## API Config

Edit this file if the API URL or key changes:

```text
src/config.ts
```

For a real production app, do not treat an API key embedded in a mobile app as fully secret. Use it as basic access control for a demo, and add stronger auth if the app becomes public.
