import { env } from "$env/dynamic/private";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { jwt, twoFactor } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import { getRequestEvent } from "$app/server";
import { getDb } from "$lib/server/db";
import { openAPI } from "better-auth/plugins";
import { TRUSTED_ORIGINS } from "$lib/server/cors";
import { hashPassword, verifyPassword } from "$lib/server/password";
import { southbagTrustPlugin } from "$lib/server/plugins/southbag-trust";
import { southbagId } from "$lib/server/plugins/southbag-id";

const COOKIE_DOMAIN = "southbag.cc";

/**
 * Cookies scoped to `southbag.cc` are rejected outright by the browser when you
 * are on localhost, which silently breaks every login on the dev server. Only
 * share cookies across subdomains when we are actually on one.
 */
const isSouthbagOrigin = (() => {
  try {
    const { hostname } = new URL(env.ORIGIN);
    return hostname === COOKIE_DOMAIN || hostname.endsWith(`.${COOKIE_DOMAIN}`);
  } catch {
    return false;
  }
})();

const authConfig = {
  appName: "Southbag Identity™",
  baseURL: env.ORIGIN,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [...TRUSTED_ORIGINS],
  advanced: {
    crossSubDomainCookies: {
      enabled: isSouthbagOrigin,
      domain: COOKIE_DOMAIN,
    },
  },
  emailAndPassword: {
    enabled: true,
    password: { hash: hashPassword, verify: verifyPassword },
  },
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
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
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
    southbagId(),
    openAPI(),
  ],
} satisfies Omit<Parameters<typeof betterAuth>[0], "database" | "plugins"> & {
  plugins: Exclude<
    Parameters<typeof betterAuth>[0]["plugins"],
    undefined
  >;
};

export const createAuth = (d1: D1Database) =>
  betterAuth({
    ...authConfig,
    database: drizzleAdapter(getDb(d1), { provider: "sqlite" }),
    plugins: [
      ...authConfig.plugins,
      southbagTrustPlugin(d1),
      sveltekitCookies(getRequestEvent), // keep this last
    ],
  });

/**
 * DO NOT USE!
 *
 * This instance is used by the `better-auth` CLI for schema generation ONLY.
 * To access `auth` at runtime, use `event.locals.auth`.
 */
export const auth = createAuth(null!);
