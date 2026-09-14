import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatClockTime } from "../lib/formatDate";
import {
  buildSystemPrompt,
  hasApiKey,
  requestAssistantReply,
  type ChatMessage,
} from "../lib/openaiClient";
import type { RootStackParamList } from "../navigation/types";
import {
  clearConversation,
  loadConversation,
  saveConversation,
} from "../storage/chat";

type Props = NativeStackScreenProps<RootStackParamList, "Chat">;

const SUGGESTIONS = [
  "How should I dispose of this?",
  "What is this made of?",
  "What is the environmental impact?",
];

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ChatScreen({ navigation, route }: Props) {
  const { classification } = route.params;
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const isRecyclable = classification.segregation.toLowerCase().includes("recycl");
  const keyMissing = !hasApiKey();

  const systemPrompt = useMemo(
    () =>
      buildSystemPrompt(
        classification.segregation,
        classification.confidencePercent,
      ),
    [classification.segregation, classification.confidencePercent],
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      loadConversation(classification.id)
        .then((stored) => {
          if (isActive) setMessages(stored);
        })
        .catch(() => undefined)
        .finally(() => {
          if (isActive) setIsHydrated(true);
        });
      return () => {
        isActive = false;
      };
    }, [classification.id]),
  );

  // Writing before hydration completes would overwrite the stored conversation
  // with the empty initial state.
  useEffect(() => {
    if (!isHydrated) return;
    saveConversation(classification.id, messages).catch(() => undefined);
  }, [classification.id, isHydrated, messages]);

  useEffect(() => {
    if (messages.length === 0 && !isSending) return;
    const frame = requestAnimationFrame(() =>
      listRef.current?.scrollToEnd({ animated: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [messages, isSending]);

  const clearChat = useCallback(() => {
    Alert.alert("Clear chat", "This deletes the conversation for this item.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          setMessages([]);
          setError(null);
          clearConversation(classification.id).catch(() => undefined);
        },
      },
    ]);
  }, [classification.id]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        messages.length > 0 ? (
          <TouchableOpacity onPress={clearChat} hitSlop={8}>
            <Text style={styles.headerButton}>Clear chat</Text>
          </TouchableOpacity>
        ) : null,
    });
  }, [clearChat, messages.length, navigation]);

  async function requestReply(conversation: ChatMessage[]) {
    setError(null);
    setIsSending(true);
    try {
      const reply = await requestAssistantReply(systemPrompt, conversation);
      setMessages([
        ...conversation,
        {
          id: createId(),
          role: "assistant",
          content: reply,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSending(false);
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const conversation: ChatMessage[] = [
      ...messages,
      {
        id: createId(),
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      },
    ];

    setMessages(conversation);
    setDraft("");
    await requestReply(conversation);
  }

  const canSend = draft.trim().length > 0 && !isSending && !keyMissing;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 44 : 0}
    >
      <FlatList
        ref={listRef}
        style={styles.flex}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        keyboardDismissMode="interactive"
        onContentSizeChange={() =>
          listRef.current?.scrollToEnd({ animated: false })
        }
        ListHeaderComponent={
          <View>
            <View style={styles.summaryCard}>
              <Image
                source={{ uri: classification.imageUri }}
                style={styles.summaryImage}
              />
              <View style={styles.summaryTextWrap}>
                <Text style={styles.summaryLabel}>Segregation</Text>
                <Text style={styles.summaryTitle}>
                  {classification.segregation}
                </Text>
                <View
                  style={[
                    styles.summaryBadge,
                    isRecyclable ? styles.recyclableBadge : styles.trashBadge,
                  ]}
                >
                  <Text style={styles.summaryBadgeText}>
                    {classification.confidencePercent.toFixed(1)}% confidence
                  </Text>
                </View>
              </View>
            </View>

            {keyMissing && (
              <View style={styles.noticeCard}>
                <Feather name="key" size={16} color="#92400e" />
                <Text style={styles.noticeText}>
                  Add EXPO_PUBLIC_OPENAI_API_KEY to a .env file and restart the
                  dev server to enable the assistant.
                </Text>
              </View>
            )}

            {messages.length === 0 && !keyMissing && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>
                  Ask anything about this item
                </Text>
                <View style={styles.suggestionWrap}>
                  {SUGGESTIONS.map((suggestion) => (
                    <TouchableOpacity
                      key={suggestion}
                      style={styles.suggestionChip}
                      onPress={() => send(suggestion)}
                    >
                      <Text style={styles.suggestionText}>{suggestion}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const isUser = item.role === "user";
          return (
            <View style={isUser ? styles.userRow : styles.assistantRow}>
              <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
                <Text style={isUser ? styles.userText : styles.assistantText}>
                  {item.content}
                </Text>
              </View>
              <Text style={[styles.timestamp, isUser && styles.timestampRight]}>
                {formatClockTime(item.createdAt)}
              </Text>
            </View>
          );
        }}
        ListFooterComponent={
          <View>
            {isSending && (
              <View style={styles.assistantRow}>
                <View style={[styles.bubble, styles.assistantBubble, styles.thinkingBubble]}>
                  <ActivityIndicator size="small" color="#065f46" />
                  <Text style={styles.assistantText}>thinking...</Text>
                </View>
              </View>
            )}

            {error && (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={styles.errorRetry}
                  onPress={() => requestReply(messages)}
                >
                  <Text style={styles.errorRetryText}>Try again</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
      />

      <View style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}>
        <View style={styles.inputPill}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={keyMissing ? "Add an API key to chat" : "Ask a follow-up..."}
            placeholderTextColor="#9ca3af"
            editable={!keyMissing}
            multiline
            onSubmitEditing={() => send(draft)}
          />
          <TouchableOpacity
            style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
            onPress={() => send(draft)}
            disabled={!canSend}
          >
            <Feather name="arrow-up" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
        <Text style={styles.disclaimer}>
          AI responses may be inaccurate. Verify with your local recycling
          authority for definitive guidance.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: "#f5f6f8",
  },
  headerButton: {
    color: "#ef4444",
    fontWeight: "700",
    fontSize: 15,
  },
  listContent: {
    padding: 16,
    paddingBottom: 8,
  },
  summaryCard: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  summaryImage: {
    width: 82,
    height: 82,
    borderRadius: 16,
    backgroundColor: "#e5e7eb",
  },
  summaryTextWrap: {
    flex: 1,
    justifyContent: "center",
  },
  summaryLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  summaryTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
    textTransform: "capitalize",
    marginTop: 2,
  },
  summaryBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 6,
  },
  recyclableBadge: {
    backgroundColor: "#d1fae5",
  },
  trashBadge: {
    backgroundColor: "#ffedd5",
  },
  summaryBadgeText: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 12,
  },
  noticeCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#fef3c7",
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
  },
  noticeText: {
    flex: 1,
    color: "#92400e",
    lineHeight: 19,
  },
  emptyState: {
    marginTop: 22,
  },
  emptyTitle: {
    color: "#6b7280",
    fontWeight: "600",
    textAlign: "center",
  },
  suggestionWrap: {
    gap: 8,
    marginTop: 12,
  },
  suggestionChip: {
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: "center",
  },
  suggestionText: {
    color: "#374151",
    fontWeight: "600",
  },
  userRow: {
    alignItems: "flex-end",
    marginTop: 14,
  },
  assistantRow: {
    alignItems: "flex-start",
    marginTop: 14,
  },
  bubble: {
    maxWidth: "84%",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  userBubble: {
    backgroundColor: "#1e293b",
    borderBottomRightRadius: 6,
  },
  assistantBubble: {
    backgroundColor: "#d1fae5",
    borderBottomLeftRadius: 6,
  },
  thinkingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userText: {
    color: "#ffffff",
    fontSize: 16,
    lineHeight: 22,
  },
  assistantText: {
    color: "#064e3b",
    fontSize: 16,
    lineHeight: 22,
  },
  timestamp: {
    color: "#9ca3af",
    fontSize: 11,
    marginTop: 4,
    marginHorizontal: 6,
  },
  timestampRight: {
    textAlign: "right",
  },
  errorCard: {
    backgroundColor: "#fee2e2",
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
  },
  errorText: {
    color: "#7f1d1d",
    lineHeight: 20,
  },
  errorRetry: {
    alignSelf: "flex-start",
    backgroundColor: "#991b1b",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 10,
  },
  errorRetryText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  composer: {
    backgroundColor: "#f5f6f8",
    borderTopColor: "#e5e7eb",
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  inputPill: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    backgroundColor: "#ffffff",
    borderColor: "#e5e7eb",
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    color: "#111827",
    fontSize: 16,
    maxHeight: 120,
    paddingTop: 8,
    paddingBottom: 8,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  disclaimer: {
    color: "#9ca3af",
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
    marginTop: 8,
  },
});
