import { useSupabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

interface ChatTurn {
    role: "user" | "assistant";
    content: string;
}

const SUGGESTIONS = [
    "How much should I offer for a deep clean?",
    "Help me describe a leaking kitchen pipe",
    "How do offers and counters work?",
    "What should I prepare before a provider arrives?",
];

export default function AssistantScreen() {
    const router = useRouter();
    const supabase = useSupabase();
    const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

    // Kept on the device for this visit only.
    const [turns, setTurns] = useState<ChatTurn[]>([]);
    const [draft, setDraft] = useState("");
    const [thinking, setThinking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const ask = async (text: string) => {
        const content = text.trim();
        if (!content || thinking) return;
        const next: ChatTurn[] = [...turns, { role: "user", content }];
        setTurns(next);
        setDraft("");
        setError(null);
        setThinking(true);

        const { data, error: fnErr } = await supabase.functions.invoke("qwikhelp-ai", { body: { messages: next } });
        setThinking(false);

        if (fnErr || !data?.reply) {
            let message = "QwikHelp AI is unavailable right now.";
            try {
                const body = await (fnErr as any)?.context?.json?.();
                if (body?.error) message = body.error;
            } catch {}
            setError(message);
            return;
        }
        setTurns([...next, { role: "assistant", content: data.reply }]);
    };

    return (
        <SafeAreaView className="flex-1 bg-[#F9FAFB]">
            <KeyboardAvoidingView behavior="padding" className="flex-1">
                <View className="flex-row items-center px-4 py-3 bg-white">
                    <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-2">
                        <Ionicons name="arrow-back" size={24} color="#111827" />
                    </TouchableOpacity>
                    <View className="w-10 h-10 rounded-full bg-blue-600 items-center justify-center mr-3">
                        <Ionicons name="sparkles" size={18} color="white" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-base font-bold text-gray-900">QwikHelp AI</Text>
                        <Text className="text-xs text-gray-500">Answers can be wrong. Check prices before you book.</Text>
                    </View>
                    {turns.length > 0 && (
                        <TouchableOpacity onPress={() => { setTurns([]); setError(null); }} className="p-2 -mr-2">
                            <Ionicons name="refresh" size={20} color="#6B7280" />
                        </TouchableOpacity>
                    )}
                </View>

                <ScrollView
                    ref={scrollRef}
                    className="flex-1 px-4"
                    contentContainerStyle={{ paddingVertical: 16 }}
                    keyboardShouldPersistTaps="handled"
                    onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                >
                    {turns.length === 0 && (
                        <View className="items-center mt-6">
                            <View className="w-16 h-16 rounded-full bg-blue-50 items-center justify-center">
                                <Ionicons name="sparkles" size={28} color="#2563EB" />
                            </View>
                            <Text className="text-lg font-bold text-gray-900 mt-4">How can I help?</Text>
                            <Text className="text-sm text-gray-500 text-center mt-1 mb-6 px-6">
                                Ask about pricing, describing a job, or how QwikHelp works.
                            </Text>
                            {SUGGESTIONS.map((s) => (
                                <TouchableOpacity
                                    key={s}
                                    onPress={() => ask(s)}
                                    className="w-full bg-white rounded-2xl px-4 py-3.5 mb-2.5 flex-row items-center"
                                >
                                    <Text className="flex-1 text-sm text-gray-800">{s}</Text>
                                    <Ionicons name="arrow-forward" size={16} color="#2563EB" />
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {turns.map((t, i) => {
                        const mine = t.role === "user";
                        return (
                            <View key={i} className={`mb-3 max-w-[85%] ${mine ? "self-end" : "self-start"}`}>
                                <View className={`rounded-2xl px-4 py-3 ${mine ? "bg-blue-600 rounded-br-md" : "bg-white rounded-bl-md"}`}>
                                    <Text className={`text-sm leading-5 ${mine ? "text-white" : "text-gray-800"}`}>{t.content}</Text>
                                </View>
                            </View>
                        );
                    })}

                    {thinking && (
                        <View className="self-start bg-white rounded-2xl rounded-bl-md px-4 py-3 flex-row items-center">
                            <ActivityIndicator size="small" color="#2563EB" />
                            <Text className="text-sm text-gray-500 ml-2">Thinking...</Text>
                        </View>
                    )}

                    {error && (
                        <View className="self-stretch bg-rose-50 rounded-2xl px-4 py-3 mt-1">
                            <Text className="text-sm text-rose-700">{error}</Text>
                        </View>
                    )}
                </ScrollView>

                <View className="flex-row items-end px-4 py-3 bg-white">
                    <TextInput
                        value={draft}
                        onChangeText={setDraft}
                        placeholder="Ask QwikHelp AI..."
                        placeholderTextColor="#9CA3AF"
                        multiline
                        maxLength={2000}
                        className="flex-1 bg-gray-100 rounded-2xl px-4 py-3 text-gray-900 text-sm max-h-28"
                    />
                    <TouchableOpacity
                        onPress={() => ask(draft)}
                        disabled={!draft.trim() || thinking}
                        className={`ml-2 w-11 h-11 rounded-full items-center justify-center ${draft.trim() && !thinking ? "bg-blue-600" : "bg-gray-200"}`}
                    >
                        <Ionicons name="send" size={18} color="white" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
