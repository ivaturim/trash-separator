/**
 * Website-only photo capture for Voice Mode.
 *
 * Browsers only open the camera/file picker in direct response to a tap, so a
 * spoken "take photo" cannot use expo-image-picker there. Instead:
 *  - "camera": shows a live camera view in the page, counts down 3-2-1 and
 *    takes the picture automatically (fully hands-free).
 *  - "library": shows one large "Tap to choose a photo" button, because
 *    choosing a file always needs a tap.
 * Resolves with the photo, or null if the user cancels or the camera fails.
 */
export type WebPhoto = { uri: string; fileName: string; mimeType: string };

const COUNTDOWN_SECONDS = 3;

function makeOverlay(): { root: HTMLDivElement; close: () => void } {
  const root = document.createElement("div");
  Object.assign(root.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    background: "rgba(10,15,20,0.92)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    padding: "16px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#fff",
  } as CSSStyleDeclaration);
  document.body.appendChild(root);
  return { root, close: () => root.remove() };
}

function makeButton(label: string, primary: boolean): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  Object.assign(button.style, {
    fontSize: primary ? "20px" : "16px",
    fontWeight: "700",
    padding: primary ? "18px 32px" : "12px 24px",
    borderRadius: "14px",
    border: primary ? "none" : "1px solid rgba(255,255,255,0.5)",
    background: primary ? "#2f7d5b" : "transparent",
    color: "#fff",
    cursor: "pointer",
  } as CSSStyleDeclaration);
  return button;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function chooseFromLibrary(): Promise<WebPhoto | null> {
  return new Promise((resolve) => {
    const { root, close } = makeOverlay();
    let settled = false;
    const finish = (photo: WebPhoto | null) => {
      if (settled) return;
      settled = true;
      close();
      resolve(photo);
    };

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return finish(null);
      try {
        const uri = await readFileAsDataUrl(file);
        finish({
          uri,
          fileName: file.name || "photo.jpg",
          mimeType: file.type || "image/jpeg",
        });
      } catch {
        finish(null);
      }
    };

    const choose = makeButton("Tap to choose a photo", true);
    choose.onclick = () => input.click();
    const cancel = makeButton("Cancel", false);
    cancel.onclick = () => finish(null);

    root.append(input, choose, cancel);
  });
}

function captureFromCamera(): Promise<WebPhoto | null> {
  return new Promise(async (resolve) => {
    const { root, close } = makeOverlay();
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let settled = false;

    const finish = (photo: WebPhoto | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
      close();
      resolve(photo);
    };

    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "true");
    Object.assign(video.style, {
      width: "min(92vw, 520px)",
      maxHeight: "60vh",
      borderRadius: "16px",
      background: "#000",
      objectFit: "cover",
    } as CSSStyleDeclaration);

    const label = document.createElement("div");
    Object.assign(label.style, {
      fontSize: "22px",
      fontWeight: "800",
    } as CSSStyleDeclaration);
    label.textContent = "Starting camera…";

    const snapNow = makeButton("Take it now", true);
    const cancel = makeButton("Cancel", false);
    cancel.onclick = () => finish(null);
    root.append(video, label, snapNow, cancel);

    const snap = () => {
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return finish(null);
      ctx.drawImage(video, 0, 0, width, height);
      const uri = canvas.toDataURL("image/jpeg", 0.85);
      finish({ uri, fileName: "waste-photo.jpg", mimeType: "image/jpeg" });
    };
    snapNow.onclick = snap;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
    } catch {
      return finish(null);
    }
    if (settled) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      // autoplay of a muted inline video is allowed; ignore odd browsers
    }

    let remaining = COUNTDOWN_SECONDS;
    label.textContent = `Hold the item steady… ${remaining}`;
    timer = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        label.textContent = `Hold the item steady… ${remaining}`;
        return;
      }
      if (timer) clearInterval(timer);
      timer = null;
      snap();
    }, 1000);
  });
}

export function captureOnWeb(source: "camera" | "library"): Promise<WebPhoto | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  return source === "camera" ? captureFromCamera() : chooseFromLibrary();
}
