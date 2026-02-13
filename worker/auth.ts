import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/auth-schema";
import { sendEmail } from "./email";

interface AuthEnv {
  DB: D1Database;
  CACHE: KVNamespace;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  RESEND_API_KEY: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

export function createAuth(env: AuthEnv) {
  const db = drizzle(env.DB, { schema });

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
    }),
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,

      sendResetPassword: async ({ user, url }) => {
        // Rate limit: 1 reset email per 60 seconds per email
        const rateKey = `reset-rate:${user.email}`;
        const existing = await env.CACHE.get(rateKey);
        if (existing) {
          console.log("Rate limited reset for:", user.email);
          return;
        }
        await env.CACHE.put(rateKey, "1", { expirationTtl: 60 });

        await sendEmail(env.RESEND_API_KEY, {
          to: user.email,
          subject: "Reset your password",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
              <h2 style="color: #1a1a1a; font-size: 20px; margin-bottom: 16px;">Reset your password</h2>
              <p style="color: #4a4a4a; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
                Hi${user.name ? ` ${user.name}` : ''}, we received a request to reset your password. Click the button below to choose a new one.
              </p>
              <a href="${url}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">
                Reset Password
              </a>
              <p style="color: #9a9a9a; font-size: 13px; margin-top: 32px; line-height: 1.5;">
                If you didn't request this, you can safely ignore this email. This link expires in 1 hour.
              </p>
            </div>
          `,
        });
      },
    },

    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await sendEmail(env.RESEND_API_KEY, {
              to: user.email,
              subject: "Welcome to Inductive Bible",
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
                  <h2 style="color: #1a1a1a; font-size: 20px; margin-bottom: 16px;">Welcome to Inductive Bible!</h2>
                  <p style="color: #4a4a4a; font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
                    Hi${user.name ? ` ${user.name}` : ''},
                  </p>
                  <p style="color: #4a4a4a; font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
                    Thank you for joining Inductive Bible! I'm so glad you're here. This app was built to help you dig deeper into God's Word through inductive Bible study — highlighting, annotating, and taking notes as you read.
                  </p>
                  <p style="color: #4a4a4a; font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
                    After you've had a chance to use it, I'd love to hear your feedback. What's working well? What could be better? Just reply to this email — I read every message.
                  </p>
                  <p style="color: #4a4a4a; font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
                    I'm praying for you as you spend time in the Word. May God richly bless your study!
                  </p>
                  <p style="color: #4a4a4a; font-size: 15px; line-height: 1.6; margin-bottom: 4px;">
                    In Christ,
                  </p>
                  <p style="color: #1a1a1a; font-size: 15px; font-weight: 600;">
                    The Inductive Bible Team
                  </p>
                  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
                  <p style="color: #9a9a9a; font-size: 13px; line-height: 1.5;">
                    <a href="https://inductivebible.ai" style="color: #2563eb; text-decoration: none;">inductivebible.ai</a>
                  </p>
                </div>
              `,
            });
          },
        },
      },
    },

    socialProviders: {
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {}),
    },

    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24,       // refresh after 1 day
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minute cookie cache to reduce D1 reads
      },
    },

    trustedOrigins: [
      "https://inductivebible.ai",
      "https://www.inductivebible.ai",
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
