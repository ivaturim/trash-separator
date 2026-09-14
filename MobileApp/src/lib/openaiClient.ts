const CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const REQUEST_TIMEOUT_MS = 30000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 800;

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

type OpenAiMessage = {
  role: "system" | ChatRole;
  content: string;
};

export function buildSystemPrompt(
  segregation: string,
  confidencePercent: number,
): string {
  return (
    "You are a recycling and waste disposal expert. The user just photographed " +
    `an item that was classified as ${segregation} with ` +
    `${confidencePercent.toFixed(0)}% confidence. Answer their follow-up ` +
    "questions concisely (under 3 sentences unless they ask for more detail). " +
    "Focus on practical disposal advice, material composition, and environmental impact."
  );
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}

function getApiKey(): string {
  return (process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? "").trim();
}

/** Errors carrying a message that is safe to show directly to the user. */
export class ChatRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatRequestError";
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * `Retry-After` is either a delay in seconds or an HTTP date. Only the former
 * is worth honouring here; anything longer than a few seconds is better
 * handled by letting the user retry manually.
 */
function retryDelayFromResponse(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  const seconds = header ? Number(header) : NaN;
  if (Number.isFinite(seconds) && seconds > 0 && seconds <= 10) {
    return seconds * 1000;
  }
  return RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
}

function messageForStatus(status: number, payload: any): string {
  const apiMessage: string | undefined = payload?.error?.message;
  const apiCode: string | undefined = payload?.error?.code;

  if (status === 401 || status === 403) {
    return "Your OpenAI API key was rejected. Check EXPO_PUBLIC_OPENAI_API_KEY in your .env file.";
  }
  if (status === 404) {
    return `Your OpenAI account cannot access the ${MODEL} model.`;
  }
  if (status === 429) {
    return apiCode === "insufficient_quota"
      ? "Your OpenAI account is out of credit. Add billing details to continue."
      : "Too many requests to OpenAI. Wait a few seconds and try again.";
  }
  if (status >= 500) {
    return "OpenAI is having trouble right now. Please try again in a moment.";
  }
  return apiMessage || `OpenAI request failed (${status}).`;
}

async function readPayload(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Sends the conversation to OpenAI and resolves with the assistant's reply.
 * Transient failures are retried; every rejection is a `ChatRequestError`
 * whose message can be rendered as-is.
 */
export async function requestAssistantReply(
  systemPrompt: string,
  history: ChatMessage[],
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new ChatRequestError(
      "No OpenAI API key found. Copy .env.example to .env, add your key, then restart the dev server.",
    );
  }

  const messages: OpenAiMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.map(({ role, content }) => ({ role, content })),
  ];

  let lastError: ChatRequestError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature: 0.4,
          max_tokens: 400,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = await readPayload(response);
        const error = new ChatRequestError(
          messageForStatus(response.status, payload),
        );

        if (isRetryableStatus(response.status) && attempt < MAX_ATTEMPTS) {
          lastError = error;
          await delay(retryDelayFromResponse(response, attempt));
          continue;
        }
        throw error;
      }

      const payload = await readPayload(response);
      const reply: string | undefined =
        payload?.choices?.[0]?.message?.content?.trim();

      if (!reply) {
        throw new ChatRequestError("OpenAI returned an empty response.");
      }
      return reply;
    } catch (err) {
      if (err instanceof ChatRequestError) throw err;

      const isTimeout = controller.signal.aborted;
      lastError = new ChatRequestError(
        isTimeout
          ? "The request to OpenAI timed out. Please try again."
          : "Could not reach OpenAI. Check your internet connection and try again.",
      );

      if (attempt < MAX_ATTEMPTS) {
        await delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new ChatRequestError("Could not reach OpenAI.");
}
