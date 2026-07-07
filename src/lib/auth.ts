import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema } from "./db";
import { eq } from "drizzle-orm";

export type SessionData = {
  userId?: string;
  householdId?: string;
};

const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? "hearth-dev-only-secret-change-me-in-production!!",
  cookieName: "hearth_session",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.ALLOW_HTTP !== "1",
  },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function currentUser() {
  const session = await getSession();
  if (!session.userId || !session.householdId) return null;
  const user = db.select().from(schema.users).where(eq(schema.users.id, session.userId)).all()[0];
  if (!user) return null;
  return { user, householdId: session.householdId };
}

export async function requireUser() {
  const ctx = await currentUser();
  if (!ctx) redirect("/login");
  return ctx;
}
