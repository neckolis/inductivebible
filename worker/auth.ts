import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/auth-schema";
import { sendEmail } from "./email";

interface AuthEnv {
  DB: D1Database;
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
        void sendEmail(env.RESEND_API_KEY, {
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
