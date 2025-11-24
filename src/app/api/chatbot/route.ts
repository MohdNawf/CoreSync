import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = process.env.GOOGLE_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
  : null;

type IncomingMessage = {
  role: "assistant" | "user";
  content: string;
};

export async function POST(req: Request) {
  try {
    if (!genAI) {
      return NextResponse.json(
        { error: "GOOGLE_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const messages: IncomingMessage[] | undefined = body?.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages must be a non-empty array" },
        { status: 400 }
      );
    }

    const conversation = messages
      .map((msg) => {
        const speaker = msg.role === "assistant" ? "Coach" : "User";
        return `${speaker}: ${msg.content}`;
      })
      .join("\n");

    const systemPrompt = `
You are CoreSync, an elite fitness and nutrition coach.
- Ask clarifying questions to understand the user's goals, schedule, equipment, and restrictions.
- Provide actionable, concise responses with numbered or bulleted recommendations.
- When enough info is collected, outline a workout and diet plan summary.
- Encourage the user to save the plan by mentioning the profile page.
- Keep responses under 180 words and avoid markdown tables.

Conversation so far:
${conversation}

Respond as CoreSync AI Coach:
`;

    const model = genAI.getGenerativeModel({
      model: "gemini-1.0-pro-latest",
    });

    const result = await model.generateContent(systemPrompt);
    const reply = result.response.text();

    if (!reply) {
      throw new Error("Gemini returned an empty response");
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chatbot API error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to contact Gemini",
      },
      { status: 500 }
    );
  }
}

