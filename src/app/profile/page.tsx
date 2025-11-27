import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { getConvexClient } from "@/lib/convexClient";

type PlanDoc = Doc<"plans">;

const formatDate = (timestamp: number) =>
  new Date(timestamp).toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const ProfilePage = async () => {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in?redirect_url=/profile");
  }

  let plan: PlanDoc | null = null;
  let planError: string | null = null;

  try {
    plan = (await getConvexClient().query(api.plans.getActivePlan, {
      userId: user.id,
    })) as PlanDoc | null;
  } catch (error) {
    console.error("Failed to load plan from Convex", error);
    planError =
      error instanceof Error
        ? error.message
        : "Plan service unavailable. Please try again shortly.";
  }

  return (
    <div className="min-h-screen bg-background py-10">
      <div className="max-w-5xl mx-auto px-4 space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Profile</h1>
          <p className="text-muted-foreground">
            Your collected training info and personalized program live here.
          </p>
        </div>

        <Card className="border border-border bg-card/90">
          <CardHeader>
            <CardTitle className="text-2xl">
              Welcome back, {user.firstName || user.username || "athlete"}!
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Signed in as {user.emailAddresses?.[0]?.emailAddress || "—"}
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-1">
            <div className="rounded-lg border border-border bg-background/70 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Last updated
              </p>
              <p className="text-lg mt-1">
                {plan ? formatDate(plan._creationTime) : "Awaiting plan"}
              </p>
            </div>
          </CardContent>
        </Card>

        {planError && (
          <Card className="border border-amber-500/60 bg-amber-500/10">
            <CardContent className="py-4 text-sm text-amber-900 dark:text-amber-100">
              {planError.includes("Could not find public function")
                ? "Convex backend is offline. Run `npx convex dev` locally or deploy your Convex functions before viewing saved plans."
                : planError}
            </CardContent>
          </Card>
        )}

        {plan ? (
          <div className="space-y-6">
            <Card className="border border-border bg-card/90">
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  This plan comes from the information you provided in the chat.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <section>
                  <h3 className="text-sm uppercase tracking-wide text-muted-foreground mb-2">
                    Weekly Schedule
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {plan.workoutPlan.schedule.map((day) => (
                      <span
                        key={day}
                        className="rounded-full border border-border px-3 py-1 text-sm bg-background/70"
                      >
                        {day}
                      </span>
                    ))}
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-sm uppercase tracking-wide text-muted-foreground">
                    Workout Breakdown
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {plan.workoutPlan.exercises.map((session) => (
                      <div
                        key={session.day}
                        className="rounded-lg border border-border bg-background/70 p-4"
                      >
                        <p className="font-semibold text-foreground">
                          {session.day}
                        </p>
                        <ul className="mt-2 space-y-2 text-sm">
                          {session.routines.map((routine, index) => (
                            <li
                              key={`${routine.name}-${index}`}
                              className="flex items-center justify-between"
                            >
                              <span>{routine.name}</span>
                              <span className="text-muted-foreground">
                                {routine.sets} x {routine.reps}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-sm uppercase tracking-wide text-muted-foreground">
                    Nutrition Overview
                  </h3>
                  <div className="rounded-lg border border-border bg-background/70 p-4">
                    <p className="text-sm text-muted-foreground">
                      Daily calories target
                    </p>
                    <p className="text-2xl font-semibold">
                      {plan.dietPlan.dailyCalories.toLocaleString()} kcal
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {plan.dietPlan.meals.map((meal, index) => (
                      <div
                        key={`${meal.name}-${index}`}
                        className="rounded-lg border border-border bg-background/70 p-4"
                      >
                        <p className="font-semibold">{meal.name}</p>
                        <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground space-y-1">
                          {meal.foods.map((food) => (
                            <li key={food}>{food}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="border border-dashed border-border bg-card/60">
            <CardContent className="py-12 text-center space-y-3">
              <p className="text-lg font-semibold">
                No program has been saved yet.
              </p>
              <p className="text-muted-foreground">
                Share your goals with the CoreSync chat assistant on the Generate
                Program page. Once the intake is complete, your workouts and
                diet plan will appear here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
