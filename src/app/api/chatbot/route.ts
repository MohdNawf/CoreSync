import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { api } from "../../../../convex/_generated/api.js";
import { getConvexClient } from "@/lib/convexClient";

const genAI = process.env.GOOGLE_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
  : null;

const convexClient = getConvexClient();

type IncomingMessage = {
  role: "assistant" | "user";
  content: string;
};

type ChatbotPayload = {
  reply?: string;
  planReady?: boolean;
  planName?: string;
  workoutPlan?: {
    schedule: string[];
    exercises: Array<{
      day: string;
      routines: Array<{
        name: string;
        sets: number;
        reps: number;
      }>;
    }>;
  } | null;
  dietPlan?: {
    dailyCalories: number;
    meals: Array<{
      name: string;
      foods: string[];
    }>;
  } | null;
};

function validateWorkoutPlan(plan: ChatbotPayload["workoutPlan"]) {
  if (!plan) return null;
  try {
    return {
      schedule: Array.isArray(plan.schedule)
        ? plan.schedule.map((day) => String(day))
        : [],
      exercises: Array.isArray(plan.exercises)
        ? plan.exercises.map((exercise) => ({
            day: String(exercise.day ?? "Day"),
            routines: Array.isArray(exercise.routines)
              ? exercise.routines.map((routine) => ({
                  name: String(routine.name ?? "Exercise"),
                  sets:
                    typeof routine.sets === "number"
                      ? routine.sets
                      : parseInt(String(routine.sets), 10) || 1,
                  reps:
                    typeof routine.reps === "number"
                      ? routine.reps
                      : parseInt(String(routine.reps), 10) || 10,
                }))
              : [],
          }))
        : [],
    };
  } catch {
    return null;
  }
}

function validateDietPlan(plan: ChatbotPayload["dietPlan"]) {
  if (!plan) return null;
  try {
    return {
      dailyCalories:
        typeof plan.dailyCalories === "number"
          ? plan.dailyCalories
          : parseInt(String(plan.dailyCalories), 10) || 0,
      meals: Array.isArray(plan.meals)
        ? plan.meals.map((meal) => ({
            name: String(meal.name ?? "Meal"),
            foods: Array.isArray(meal.foods)
              ? meal.foods.map((food) => String(food))
              : [],
          }))
        : [],
    };
  } catch {
    return null;
  }
}

function sanitizeReply(
  reply: string | undefined,
  options: { planReady: boolean }
) {
  const trimmed = reply?.trim() ?? "";
  const defaultPlanReady =
    "Thanks for sharing everything! Your personalized program is ready. Head to your profile page to review every exercise and meal.";
  const defaultCollecting =
    "I'm just collecting your goals right now. Tell me more about your schedule, injuries, equipment, and nutrition preferences.";
  const fallback = options.planReady ? defaultPlanReady : defaultCollecting;

  if (!trimmed) {
    return fallback;
  }

  const blockedPatterns = [
    /\b\d+\s*x\s*\d+\b/i,
    /\b\d+\s*(sets?|reps?)\b/i,
    /\b\d+\s*(kcal|calories?)\b/i,
    /\b(meal|breakfast|lunch|dinner|snack)\b.*\b\d+\b/i,
  ];

  const containsBlocked = blockedPatterns.some((pattern) =>
    pattern.test(trimmed)
  );

  if (containsBlocked) {
    return fallback;
  }

  return trimmed;
}

function parseChatbotPayload(raw: string): ChatbotPayload | null {
  const attemptParse = (input: string) => {
    try {
      return JSON.parse(input) as ChatbotPayload;
    } catch {
      return null;
    }
  };

  const trimmed = raw.trim();

  const direct = attemptParse(trimmed);
  if (direct) {
    return direct;
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    const fromFence = attemptParse(fenceMatch[1].trim());
    if (fromFence) {
      return fromFence;
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const sliced = trimmed.slice(firstBrace, lastBrace + 1);
    const slicedParsed = attemptParse(sliced);
    if (slicedParsed) {
      return slicedParsed;
    }
  }

  return null;
}

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
    const explicitUserId: string | null = body?.userId ?? null;
    const explicitUserName: string | null = body?.userName ?? null;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages must be a non-empty array" },
        { status: 400 }
      );
    }

    const { userId: authUserId } = await auth();
    const userId = authUserId ?? explicitUserId ?? null;

    const conversation = messages
      .map((msg) => {
        const speaker = msg.role === "assistant" ? "Coach" : "User";
        return `${speaker}: ${msg.content}`;
      })
      .join("\n");

    const systemPrompt = `
You are CoreSync, an elite intake specialist. Your ONLY job inside the chat is
to collect the user's goals, schedule, injuries, equipment, and diet needs so a
separate profile view can show the finished program later.

Conversation Rules:
- Keep replies short (<=160 words), ask focused follow-ups, and NEVER reveal workout/diet details.
- Do NOT list exercise names, sets, reps, foods, or calories in the chat under any circumstance.
- If more info is still required, set "planReady" to false and set "workoutPlan" and "dietPlan" to null.
- Once you have everything, quietly build both plans (strict schema below) and set "planReady" to true,
  but your "reply" must ONLY confirm the plan is ready and tell the user to visit their profile page for details.

CRITICAL RESPONSE FORMAT (valid JSON, no markdown, no commentary):
{
  "reply": "Short conversational response",
  "planReady": true | false,
  "planName": "Concise plan title",
  "workoutPlan": {
    "schedule": ["Monday", "Wednesday"],
    "exercises": [
      {
        "day": "Monday",
        "routines": [
          { "name": "Exercise", "sets": 3, "reps": 10 }
        ]
      }
    ]
  } | null,
  "dietPlan": {
    "dailyCalories": 2000,
    "meals": [
      { "name": "Breakfast", "foods": ["Food 1", "Food 2"] }
    ]
  } | null
}

Conversation so far:
${conversation}
`;

    const model = genAI.getGenerativeModel({
      model: "gemini-pro-latest",
    });

    const result = await model.generateContent(systemPrompt);
    const rawResponse = result.response.text();

    if (!rawResponse) {
      throw new Error("Gemini returned an empty response");
    }

    const parsed = parseChatbotPayload(rawResponse);

    const reply = parsed?.reply ?? rawResponse;
    let planSaved = false;
    let planId: string | null = null;

    if (
      parsed?.planReady &&
      parsed.workoutPlan &&
      parsed.dietPlan &&
      userId
    ) {
      const workoutPlan = validateWorkoutPlan(parsed.workoutPlan);
      const dietPlan = validateDietPlan(parsed.dietPlan);
      if (workoutPlan && dietPlan) {
        const planName =
          parsed.planName?.trim() ||
          `CoreSync Plan - ${new Date().toLocaleDateString()}`;
        try {
          planId = await convexClient.mutation(api.plans.createPlan, {
            userId,
            name: planName,
            workoutPlan,
            dietPlan,
            isActive: true,
          });
          planSaved = Boolean(planId);
        } catch (convexError) {
          console.error("Failed to save plan to Convex", convexError);
        }
      }
    }

    const friendlyName =
      explicitUserName?.trim() ||
      (authUserId ? "there" : "friend");

    const baseReply = planSaved
      ? `Thanks ${friendlyName}! Your personalized program is now live on your profile page. Head there to see the workout and diet details.`
      : parsed?.planReady && !planSaved
      ? `Thanks ${friendlyName}! I gathered everything but couldn't save the plan just yet. Please try again in a moment.`
      : reply;

    const safeReply = sanitizeReply(baseReply, {
      planReady: Boolean(parsed?.planReady && planSaved),
    });

    return NextResponse.json({ reply: safeReply, planSaved, planId });
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

