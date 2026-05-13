import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { verifyLocalSession } from "./localAuth";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    // First try local session (email+password auth)
    const { COOKIE_NAME } = await import("@shared/const");
    const cookieHeader = opts.req.headers.cookie ?? "";
    const cookieMap = Object.fromEntries(
      cookieHeader.split("; ").filter(Boolean).map(c => {
        const idx = c.indexOf("=");
        return [c.slice(0, idx), c.slice(idx + 1)];
      })
    );
    const sessionToken = cookieMap[COOKIE_NAME];
    const localSession = await verifyLocalSession(sessionToken);

    if (localSession) {
      const dbUser = await db.getUserByOpenId(localSession.openId);
      if (dbUser) {
        user = dbUser;
      }
    }

    // Fall back to Manus OAuth session if local session not found
    if (!user) {
      user = await sdk.authenticateRequest(opts.req);
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
