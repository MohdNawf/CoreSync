import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import type { WebhookEvent } from "@clerk/backend";
import { Webhook } from "svix";
import { api } from "./_generated/api";
import { GoogleGenerativeAI } from "@google/generative-ai";

const http = httpRouter();

http.route({
    path: "/clerk-webhook",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
      const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
      if (!webhookSecret) {
        return new Response("CLERK_WEBHOOK_SECRET is not set", { status: 500 });
      }
      const svix_id = request.headers.get("svix-id");
      const svix_timestamp = request.headers.get("svix-timestamp");
      const svix_signature = request.headers.get("svix-signature");

      if (!svix_id || !svix_timestamp || !svix_signature) {
        return new Response("No svix headers found", { status: 400 });
      }
      const payload = await request.json();
      const body = JSON.stringify(payload);

      const wh = new Webhook(webhookSecret);
      let evt: WebhookEvent;
      try {
        evt = wh.verify(body, {
          "svix-id": svix_id,
          "svix-timestamp": svix_timestamp,
          "svix-signature": svix_signature,
        }) as WebhookEvent;
      } catch (err) {
        console.error("Error verifying webhook", err);
        return new Response("Error occurred", { status: 400 });
      }

      // Handle relevant Clerk events and sync to Convex
      const eventType = evt.type;
      if (eventType === "user.created" || eventType === "user.updated") {
        const user = evt.data;
        const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
        const primaryEmail = (user.email_addresses || []).find(
          (e) => e.id === user.primary_email_address_id
        )?.email_address || user.email_addresses?.[0]?.email_address || "";
        const imageUrl = user.image_url || undefined;

        await ctx.runMutation(api.users.syncUser, {
          name,
          email: primaryEmail,
          clerkId: user.id,
          image: imageUrl,
        });
      }

      return new Response("ok", { status: 200 });
    })
});
// validate and fix workout plan to ensure it has proper numeric types
function validateWorkoutPlan(plan: any) {
  const schedule = Array.isArray(plan.schedule)
    ? plan.schedule.map((day: any) => String(day))
    : [];
  const exercises = Array.isArray(plan.exercises)
    ? plan.exercises.map((exercise: any) => ({
        day: String(exercise.day ?? "Unknown"),
        routines: Array.isArray(exercise.routines)
          ? exercise.routines.map((routine: any) => ({
              name: String(routine.name ?? "Exercise"),
              sets:
                typeof routine.sets === "number"
                  ? routine.sets
                  : parseInt(routine.sets, 10) || 1,
              reps:
                typeof routine.reps === "number"
                  ? routine.reps
                  : parseInt(routine.reps, 10) || 10,
            }))
          : [],
      }))
    : [];
  return { schedule, exercises };
}

// validate diet plan to ensure it strictly follows schema
function validateDietPlan(plan: any) {
  const dailyCalories =
    typeof plan.dailyCalories === "number"
      ? plan.dailyCalories
      : parseInt(plan.dailyCalories, 10) || 0;
  const meals = Array.isArray(plan.meals)
    ? plan.meals.map((meal: any) => ({
        name: String(meal.name ?? "Meal"),
        foods: Array.isArray(meal.foods)
          ? meal.foods.map((food: any) => String(food))
          : [],
      }))
    : [];
  return { dailyCalories, meals };
}

http.route({
  path: "/vapi/generate-program",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const googleApiKey = process.env.GOOGLE_API_KEY;
    if (!googleApiKey) {
      console.error("GOOGLE_API_KEY is not set in Convex environment");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Server misconfiguration: GOOGLE_API_KEY missing",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const genAI = new GoogleGenerativeAI(googleApiKey);
    try {
      const payload = await request.json();
      const {
        user_Id,
        age,
        height,
        weight,
        fitness_level,
        fitness_goal,
        workout_days,
        equipment_access,
        dietary_restrictions,
        workout_plan,
        diet_plan,
        injuries,
      } = payload;

      console.log("Payload is here", payload);

      const model = genAI.getGenerativeModel({ 
        model: "gemini-pro-latest",
        generationConfig: {
          temperature: 0.4,
          topP: 0.9,
          responseMimeType: "application/json",
        }
      });
     
      const workoutPrompt = `You are an experienced fitness coach creating a personalized workout plan based on:
      Age: ${age}
      Height: ${height}
      Weight: ${weight}
      Injuries or limitations: ${injuries || "None"}
      Available days for workout: ${workout_days}
      Fitness goal: ${fitness_goal}
      Fitness level: ${fitness_level}
      
      As a professional coach:
      - Consider muscle group splits to avoid overtraining the same muscles on consecutive days
      - Design exercises that match the fitness level and account for any injuries
      - Structure the workouts to specifically target the user's fitness goal
      
      CRITICAL SCHEMA INSTRUCTIONS:
      - Your output MUST contain ONLY the fields specified below, NO ADDITIONAL FIELDS
      - "sets" and "reps" MUST ALWAYS be NUMBERS, never strings
      - For example: "sets": 3, "reps": 10
      - Do NOT use text like "reps": "As many as possible" or "reps": "To failure"
      - Instead use specific numbers like "reps": 12 or "reps": 15
      - For cardio, use "sets": 1, "reps": 1 or another appropriate number
      - NEVER include strings for numerical fields
      - NEVER add extra fields not shown in the example below
      
      Return a JSON object with this EXACT structure:
      {
        "schedule": ["Monday", "Wednesday", "Friday"],
        "exercises": [
          {
            "day": "Monday",
            "routines": [
              {
                "name": "Exercise Name",
                "sets": 3,
                "reps": 10
              }
            ]
          }
        ]
      }
      
      DO NOT add any fields that are not in this example. Your response must be a valid JSON object with no additional text.`;

      const workoutResult = await model.generateContent(workoutPrompt);
      const workoutPlanText = workoutResult.response.text();

      // validate the input from ai
      let workoutPlan = JSON.parse(workoutPlanText);
      workoutPlan = validateWorkoutPlan(workoutPlan);

      const dietPrompt = `You are an experienced nutrition coach creating a personalized diet plan based on:
        Age: ${age}
        Height: ${height}
        Weight: ${weight}
        Fitness goal: ${fitness_goal}
        Dietary restrictions: ${dietary_restrictions}
        
        As a professional nutrition coach:
        - Calculate appropriate daily calorie intake based on the person's stats and goals
        - Create a balanced meal plan with proper macronutrient distribution
        - Include a variety of nutrient-dense foods while respecting dietary restrictions
        - Consider meal timing around workouts for optimal performance and recovery
        
        CRITICAL SCHEMA INSTRUCTIONS:
        - Your output MUST contain ONLY the fields specified below, NO ADDITIONAL FIELDS
        - "dailyCalories" MUST be a NUMBER, not a string
        - DO NOT add fields like "supplements", "macros", "notes", or ANYTHING else
        - ONLY include the EXACT fields shown in the example below
        - Each meal should include ONLY a "name" and "foods" array

        Return a JSON object with this EXACT structure and no other fields:
        {
          "dailyCalories": 2000,
          "meals": [
            {
              "name": "Breakfast",
              "foods": ["Oatmeal with berries", "Greek yogurt", "Black coffee"]
            },
            {
              "name": "Lunch",
              "foods": ["Grilled chicken salad", "Whole grain bread", "Water"]
            }
          ]
        }
        
        DO NOT add any fields that are not in this example. Your response must be a valid JSON object with no additional text.`;

      const dietResult = await model.generateContent(dietPrompt);
      const dietPlanText = dietResult.response.text();
      let dietPlan = JSON.parse(dietPlanText);
      dietPlan = validateDietPlan(dietPlan);

      // save to our convex db

     const planId = await ctx.runMutation(api.plans.createPlan, {
        userId: user_Id,
        dietPlan,
        isActive: true,
        workoutPlan,
        name: `${fitness_goal} Plan - ${new Date().toLocaleDateString()}`
      });
      console.log("Created Convex plan", { planId, userId: user_Id });

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            planId,
            workoutPlan,
            dietPlan,
          },
        }),
        { 
          status: 200,
        headers: { "Content-Type": "application/json"},
        }
      );

      const response = await model.generateContent(workoutPrompt);
      console.log(response.response.text());
      return new Response(response.response.text(), { status: 200 });
    
    
    
    } catch (error) {
      console.error("Error generating program", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json"},
        }
      );
    }
  })
})

export default http;
