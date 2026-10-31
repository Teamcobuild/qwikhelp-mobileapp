import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { alertService } from "@/lib/AlertService";
import { useSupabase } from "@/lib/supabase";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface SupportMessage {
    id: string;
    sender: "user" | "agent";
    body: string;
    created_at: string;
}

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export default function SupportScreen() {
    const router = useRouter();
    const { user } = useUser();
    const supabase = useSupabase();
    const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

    const [messages, setMessages] = useState<SupportMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);

    const load = useCallback(async () => {
        const { data, error } = await supabase
            .from("support_messages")
            .select("id, sender, body, created_at")
            .order("created_at", { ascending: true });
        if (error) alertService.alert("Error", error.message);
        else setMessages(data as SupportMessage[]);
        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        load();
    }, [load]);

    useRealtimeRefresh(user ? `support:${user.id}` : null, [
        { table: "support_messages", filter: `user_id=eq.${user?.id}` },
    ], load);

    const send = async () => {
        const body = draft.trim();
        if (!body || sending) return;
        setSending(true);
        const { error } = await supabase.from("support_messages").insert({ body });
        setSending(false);
        if (error) {
            alertService.alert("Error", error.message);
            return;
        }
        setDraft("");
        load();
    };

    return (
        <SafeAreaView className="flex-1 bg-[#F9FAFB]">
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
                <View className="flex-row items-center px-4 py-3 bg-white">
                    <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-2">
                        <Ionicons name="arrow-back" size={24} color="#111827" />
                    </TouchableOpacity>
                    <View className="w-10 h-10 rounded-full bg-emerald-50 items-center justify-center mr-3">
                        <Ionicons name="headset" size={20} color="#10B981" />
                    </View>
                    <View>
                        <Text className="text-base font-bold text-gray-900">QwikHelp Support</Text>
                        <Text className="text-xs text-gray-500">We usually reply within a few hours</Text>
                    </View>
                </View>

                <ScrollView
                    ref={scrollRef}
                    className="flex-1 px-4"
                    contentContainerStyle={{ paddingVertical: 16 }}
                    onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                >
                    <View className="bg-white rounded-2xl p-4 mb-4 self-start max-w-[85%]">
                        <Text className="text-sm text-gray-800 leading-5">
                            Hi {user?.firstName || "there"} 👋 Tell us what you need help with: a booking, a payment, a
                            provider or your account. A member of our team will reply here.
                        </Text>
                    </View>

                    {loading && <ActivityIndicator color="#2563EB" className="mt-6" />}

                    {messages.map((m) => {
                        const mine = m.sender === "user";
                        return (
                            <View key={m.id} className={`mb-3 max-w-[85%] ${mine ? "self-end items-end" : "self-start items-start"}`}>
                                <View className={`rounded-2xl px-4 py-3 ${mine ? "bg-blue-600 rounded-br-md" : "bg-white rounded-bl-md"}`}>
                                    <Text className={`text-sm leading-5 ${mine ? "text-white" : "text-gray-800"}`}>{m.body}</Text>
                                </View>
                                <Text className="text-[10px] text-gray-400 mt-1">
                                    {mine ? "You" : "Support"} · {formatTime(m.created_at)}
                                </Text>
                            </View>
                        );
                    })}
                </ScrollView>

                <View className="flex-row items-end px-4 py-3 bg-white">
                    <TextInput
                        value={draft}
                        onChangeText={setDraft}
                        placeholder="Type your message..."
                        placeholderTextColor="#9CA3AF"
                        multiline
                        maxLength={2000}
                        className="flex-1 bg-gray-100 rounded-2xl px-4 py-3 text-gray-900 text-sm max-h-28"
                    />
                    <TouchableOpacity
                        onPress={send}
                        disabled={!draft.trim() || sending}
                        className={`ml-2 w-11 h-11 rounded-full items-center justify-center ${draft.trim() ? "bg-blue-600" : "bg-gray-200"}`}
                    >
                        {sending ? <ActivityIndicator color="white" size="small" /> : <Ionicons name="send" size={18} color="white" />}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
