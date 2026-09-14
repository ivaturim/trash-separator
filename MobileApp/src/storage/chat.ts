import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ChatMessage } from "../lib/openaiClient";

const CHAT_KEY_PREFIX = "trash-separator-chat:";

function chatKey(classificationId: string): string {
  return `${CHAT_KEY_PREFIX}${classificationId}`;
}

export async function loadConversation(
  classificationId: string,
): Promise<ChatMessage[]> {
  const raw = await AsyncStorage.getItem(chatKey(classificationId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

export async function saveConversation(
  classificationId: string,
  messages: ChatMessage[],
): Promise<void> {
  await AsyncStorage.setItem(chatKey(classificationId), JSON.stringify(messages));
}

export async function clearConversation(
  classificationId: string,
): Promise<void> {
  await AsyncStorage.removeItem(chatKey(classificationId));
}

/** Keeps conversations from outliving the classifications they belong to. */
export async function clearAllConversations(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const chatKeys = keys.filter((key) => key.startsWith(CHAT_KEY_PREFIX));
  if (chatKeys.length > 0) {
    await AsyncStorage.multiRemove(chatKeys);
  }
}
