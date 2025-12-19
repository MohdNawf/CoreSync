"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { vapi } from "@/lib/vapi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

type VoiceMessage = {
  role: string;
  content: string;
};

type VapiMessage = {
  type: string;
  transcriptType?: string;
  transcript?: string;
  role?: string;
  // Allow additional properties without using `any`
  [key: string]: unknown;
};

const INITIAL_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I'm the CoreSync intake coach. I only gather your goals, schedule, injuries, equipment, and diet preferences here. Once everything is captured, your full program will appear on your profile page.",
};

const presetPrompts = [
  "I want to gain muscle with 4 gym days and no lower back strain.",
  "Help me lose 10 pounds in 8 weeks with home workouts only.",
  "Create a lean bulk plan around a vegetarian, high-protein diet.",
];

const GenerateProgramPage = () => {
  const { user } = useUser();
  const router = useRouter();

  // Chatbot state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    INITIAL_MESSAGE,
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [planSaveNotice, setPlanSaveNotice] = useState<string | null>(null);

  // Voice assistant state
  const [callActive, setCallActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceMessages, setVoiceMessages] = useState<VoiceMessage[]>([]);
  const [callEnded, setCallEnded] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const voiceContainerRef = useRef<HTMLDivElement>(null);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    chatInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    if (voiceContainerRef.current) {
      voiceContainerRef.current.scrollTop =
        voiceContainerRef.current.scrollHeight;
    }
  }, [voiceMessages]);

  useEffect(() => {
    if (!user) return;
    setChatMessages((prev) => {
      if (prev.length === 1 && prev[0] === INITIAL_MESSAGE) {
        return [
          {
            role: "assistant",
            content: `Hey ${
              user.firstName || "there"
            }! I'm CoreSync. I only collect your training goals, schedule, injuries, equipment, and diet preferences here — you'll see the full workout on your profile page once I'm done.`,
          },
        ];
      }
      return prev;
    });
  }, [user]);

  // Voice assistant wiring
  useEffect(() => {
    const handleCallStart = () => {
      setConnecting(false);
      setCallActive(true);
      setCallEnded(false);
      setConnectionError(null);
      setVoiceMessages([]);
    };

    const handleCallEnd = () => {
      setCallActive(false);
      setConnecting(false);
      setIsSpeaking(false);
      setCallEnded(true);
    };

    const handleSpeechStart = () => setIsSpeaking(true);
    const handleSpeechEnd = () => setIsSpeaking(false);

    const handleMessage = (message: VapiMessage) => {
      if (
        message.type === "transcript" &&
        message.transcriptType === "final" &&
        typeof message.transcript === "string" &&
        typeof message.role === "string"
      ) {
        setVoiceMessages((prev) => [
          ...prev,
          { content: message.transcript, role: message.role },
        ]);
      }
    };

    const handleError = (error: unknown) => {
      console.error("Vapi Error", error);
      setConnecting(false);
      setCallActive(false);
      if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message: unknown }).message === "string" &&
        (error as { message: string }).message.includes("connection")
      ) {
        setConnectionError(
          "Connection lost. Please check your network and try again."
        );
      } else {
        setConnectionError(
          error instanceof Error ? error.message : "Voice call failed."
        );
      }
    };

    vapi
      .on("call-start", handleCallStart)
      .on("call-end", handleCallEnd)
      .on("speech-start", handleSpeechStart)
      .on("speech-end", handleSpeechEnd)
      .on("message", handleMessage)
      .on("error", handleError);

    return () => {
      vapi
        .off("call-start", handleCallStart)
        .off("call-end", handleCallEnd)
        .off("speech-start", handleSpeechStart)
        .off("speech-end", handleSpeechEnd)
        .off("message", handleMessage)
        .off("error", handleError);
    };
  }, []);

  const handleSendMessage = async (prompt?: string) => {
    const text = prompt ?? chatInput.trim();
    if (!text || chatLoading) return;

    const updatedMessages: ChatMessage[] = [
      ...chatMessages,
      { role: "user", content: text },
    ];

    setChatMessages(updatedMessages);
    if (!prompt) {
      setChatInput("");
    }
    setChatLoading(true);
    setChatError(null);
    setPlanSaveNotice(null);

    try {
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          userId: user?.id,
          userName: user
            ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
            : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Gemini could not generate a reply.");
      }

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);

      if (data.planSaved && data.planId) {
        setPlanSaveNotice(
          "Thanks! Your plan is saved. Redirecting you to the profile page…"
        );
        if (redirectTimeoutRef.current) {
          clearTimeout(redirectTimeoutRef.current);
        }
        redirectTimeoutRef.current = setTimeout(() => {
          router.push("/profile");
        }, 2000);
      }
    } catch (error) {
      console.error("Chatbot error", error);
      setChatError(
        error instanceof Error ? error.message : "Failed to reach Gemini."
      );
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  const startVoiceCall = async () => {
    if (callActive) {
      vapi.stop();
      return;
    }

    try {
      setConnecting(true);
      setConnectionError(null);
      setCallEnded(false);

      const fullName = user?.fullName || user?.firstName || "Friend";
      const assistantId =
        process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID ||
        "34caa6a5-e59f-4a2a-a0de-9642aabdfe48";

      await vapi.start(assistantId, {
        variableValues: { full_name: fullName },
      });
    } catch (error) {
      console.error("Error starting call", error);
      setConnecting(false);
      setCallActive(false);
      alert("Unable to start voice call. Check your Vapi configuration.");
    }
  };

  const voiceStatus = (() => {
    if (connecting) return "Connecting...";
    if (callActive && isSpeaking) return "Speaking";
    if (callActive) return "Listening";
    if (callEnded) return "Call finished";
    return "Idle";
  })();

  return (
    <div className="flex flex-col min-h-screen text-foreground overflow-hidden pb-12 pt-24">
      <div className="container mx-auto px-4 max-w-6xl">
        <header className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.4em] text-primary mb-3">
            CoreSync Studio
          </p>
          <h1 className="text-4xl md:text-5xl font-semibold font-mono">
            Chat Your Way To A{" "}
            <span className="text-primary">Personalized Program</span>
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
            Clicking “Generate Plan” or “Get Started” launches this Gemini
            chatbot automatically. Share your stats and goals here—the bot only
            collects information, and the finished workouts + diet plan will
            live on your profile page.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <Card className="lg:col-span-2 border border-border bg-card/90 overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-border">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-primary font-semibold">
                    Gemini Chatbot
                  </p>
                  <h2 className="text-2xl font-semibold">
                    CoreSync Fitness Strategist
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Answer a few questions and get instant program blueprints.
                  </p>
                </div>
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={chatLoading}
                  onClick={() => handleSendMessage()}
                >
                  {chatLoading ? "Thinking..." : "Generate Response"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {presetPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="text-xs px-3 py-1 rounded-full border border-border text-muted-foreground hover:text-primary hover:border-primary transition"
                    onClick={() => handleSendMessage(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div
              ref={chatContainerRef}
              className="h-[420px] overflow-y-auto px-6 py-5 space-y-4 bg-background/60"
            >
              {chatMessages.map((msg, index) => (
                <div
                  key={`${msg.role}-${index}`}
                  className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "assistant"
                      ? "bg-primary/10 border border-primary/25 text-foreground"
                      : "bg-border/50 border border-border/60 ml-auto max-w-[85%]"
                  }`}
                >
                  <p className="font-semibold text-xs uppercase tracking-wide mb-1">
                    {msg.role === "assistant" ? "CoreSync Coach" : "You"}
                  </p>
                  <p>{msg.content}</p>
                </div>
              ))}
            </div>

            {chatError && (
              <div className="px-6 py-3 text-sm text-destructive bg-destructive/10 border-t border-destructive/20">
                {chatError}
              </div>
            )}
            {planSaveNotice && (
              <div className="px-6 py-3 text-sm text-emerald-600 bg-emerald-500/10 border-t border-emerald-500/30">
                {planSaveNotice}
              </div>
            )}

            <div className="border-t border-border p-5 space-y-3">
              <textarea
                ref={chatInputRef}
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Describe your current routine, goals, available days, equipment, and dietary restrictions..."
                className="w-full min-h-[110px] resize-none rounded-xl border border-border bg-background/80 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Pro tip: include injuries, preferred training split, and
                  calorie targets.
                </span>
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90 px-6"
                  disabled={chatLoading}
                  onClick={() => handleSendMessage()}
                >
                  {chatLoading ? "Working..." : "Send"}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="border border-border bg-card/80 p-6 space-y-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-primary font-semibold">
                Prefer voice?
              </p>
              <h2 className="text-xl font-semibold mt-1">
                Voice Assistant (Optional)
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                Launch the Vapi-powered voice coach for hands-free planning.
              </p>
            </div>

            <div className="rounded-lg border border-border px-4 py-3 bg-background/70 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Status
                </p>
                <p className="font-semibold text-foreground">{voiceStatus}</p>
              </div>
              <div
                className={`w-3 h-3 rounded-full ${
                  callActive
                    ? "bg-primary animate-pulse"
                    : connecting
                    ? "bg-amber-500 animate-pulse"
                    : "bg-muted"
                }`}
              />
            </div>

            {connectionError && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {connectionError}
              </div>
            )}

            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                Transcripts
              </p>
              <div
                ref={voiceContainerRef}
                className="h-44 overflow-y-auto border border-border rounded-lg bg-background/60 px-3 py-2 space-y-2 text-sm"
              >
                {voiceMessages.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    Start a call to capture the conversation here.
                  </p>
                ) : (
                  voiceMessages.map((msg, index) => (
                    <div key={`${msg.role}-${index}`}>
                      <span className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                        {msg.role === "assistant" ? "CoreSync" : "You"}:
                      </span>{" "}
                      <span>{msg.content}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Button
              className={`w-full rounded-2xl text-white ${
                callActive
                  ? "bg-destructive hover:bg-destructive/90"
                  : "bg-primary hover:bg-primary/90"
              }`}
              disabled={connecting}
              onClick={startVoiceCall}
            >
              {callActive
                ? "End Voice Call"
                : connecting
                ? "Connecting..."
                : "Start Voice Assistant"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Tip: use headphones for best recognition quality.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default GenerateProgramPage;

