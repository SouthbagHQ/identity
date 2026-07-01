import { env } from "$env/dynamic/private";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { jwt, twoFactor } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import { getRequestEvent } from "$app/server";
import { getDb } from "$lib/server/db";
import { openAPI } from "better-auth/plugins";

const authConfig = {
  appName: "Southbag Identity™",
  baseURL: env.ORIGIN,
  secret: env.BETTER_AUTH_SECRET,
  emailAndPassword: { enabled: true },
  user: {
    deleteUser: {
      enabled: true,
    },
  },
  plugins: [
    jwt({
      jwt: {
        issuer: env.ORIGIN,
      },
    }),
    oauthProvider({
      loginPage: "/login",
      consentPage: "/consent",
      allowDynamicClientRegistration: false,
      allowPlainCodeChallengeMethod: true,
      scopes: [
        "openid",
        "profile",
        "email",
        "money",
        "accounts",
        "transfer_everything",
        "offline_access",
      ],
      silenceWarnings: {
        oauthAuthServerConfig: true,
        openidConfig: true,
      },
    }),
    twoFactor({
      issuer: "Southbag Identity™",
    }),
    openAPI(),
    sveltekitCookies(getRequestEvent), // make sure this is the last plugin in the array
  ],
} satisfies Omit<Parameters<typeof betterAuth>[0], "database">;

export const createAuth = (d1: D1Database) =>
  betterAuth({
    ...authConfig,
    database: drizzleAdapter(getDb(d1), { provider: "sqlite" }),
  });

/**
 * DO NOT USE!
 *
 * This instance is used by the `better-auth` CLI for schema generation ONLY.
 * To access `auth` at runtime, use `event.locals.auth`.
 */
export const auth = createAuth(null!);
