import type { Browser, BrowserContext } from "@playwright/test";
import { encode } from "next-auth/jwt";
import type { CreatedTestUser } from "./db";
import { loadTestEnv } from "./env";

loadTestEnv();

const SESSION_COOKIE_NAME = "authjs.session-token";

export async function mintSessionCookieValue(user: CreatedTestUser): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET must be set to mint NextAuth JWT session cookies.");
  }

  return encode({
    secret,
    salt: SESSION_COOKIE_NAME,
    token: {
      sub: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isLocked: user.isLocked,
      image: null,
    },
  });
}

export async function createAuthenticatedContext(
  browser: Browser,
  user: CreatedTestUser,
  options?: { baseURL?: string; locale?: "ar" | "en" }
): Promise<BrowserContext> {
  const baseURL = options?.baseURL ?? "http://localhost:3000";
  const token = await mintSessionCookieValue(user);

  const context = await browser.newContext({ baseURL });
  const cookies: Array<{
    name: string;
    value: string;
    url: string;
    httpOnly?: boolean;
    sameSite: "Lax" | "Strict" | "None";
  }> = [
    {
      name: SESSION_COOKIE_NAME,
      value: token,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ];

  if (options?.locale) {
    cookies.push({
      name: "eduplay_locale",
      value: options.locale,
      url: baseURL,
      sameSite: "Lax",
    });
  }

  await context.addCookies(cookies);

  if (options?.locale) {
    await context.addInitScript((loc: string) => {
      window.localStorage.setItem("eduplay_locale", loc);
    }, options.locale);
  }

  return context;
}
