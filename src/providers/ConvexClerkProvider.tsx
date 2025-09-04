'use client';

import { ClerkProvider } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";

const convexUrl = "https://whimsical-greyhound-498.convex.cloud";
if (!convexUrl) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL. Set it in .env.local to your Convex deployment URL.");
}
const convex = new ConvexReactClient(convexUrl);

function ConvexClerkProvider({ children }: { children: React.ReactNode }) {

    return (
        <ClerkProvider publishableKey={"pk_test_Y29vbC1sZW9wYXJkLTAuY2xlcmsuYWNjb3VudHMuZGV2JA"}>
            <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
                {children}
            </ConvexProviderWithClerk>
        </ClerkProvider>
    )
}

export default ConvexClerkProvider;
