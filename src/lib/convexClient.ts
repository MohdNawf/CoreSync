import { ConvexHttpClient } from "convex/browser";

let convexClient: ConvexHttpClient | null = null;

export function getConvexClient() {
  if (convexClient) return convexClient;

  const convexUrl =
    process.env.CONVEX_URL ||
    process.env.NEXT_PUBLIC_CONVEX_URL ||
    "https://whimsical-greyhound-498.convex.cloud";

  convexClient = new ConvexHttpClient(convexUrl);
  return convexClient;
}

