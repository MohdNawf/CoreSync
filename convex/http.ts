import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import type { WebhookEvent } from "@clerk/backend";
import { Webhook } from "svix";
import { api } from "./_generated/api";

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
})

export default http;
