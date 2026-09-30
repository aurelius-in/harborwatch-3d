import jwt from "jsonwebtoken";
import type { Role, UserSession } from "@harborwatch/contracts";

export interface TokenUser extends UserSession {
  adapter: "local" | "oidc";
}

export function signSession(
  session: UserSession,
  secret: string,
  ttlSeconds = 12 * 60 * 60,
): string {
  return jwt.sign({ ...session, adapter: "local" }, secret, {
    algorithm: "HS256",
    expiresIn: ttlSeconds,
  });
}

export function verifySession(token: string, secret: string): TokenUser {
  const decoded = jwt.verify(token, secret);
  if (!decoded || typeof decoded !== "object") {
    throw new Error("invalid token");
  }
  const raw = decoded as TokenUser;
  if (!raw.user_id || !raw.email || !raw.role || !Array.isArray(raw.site_ids)) {
    throw new Error("token missing session fields");
  }
  return raw;
}

export function canAckAlerts(role: Role): boolean {
  return role === "operator" || role === "admin";
}

export function canManageConfig(role: Role): boolean {
  return role === "admin";
}

export function canQueryHistory(role: Role): boolean {
  return role === "operator" || role === "admin";
}

export function siteAllowed(session: UserSession, siteId: string): boolean {
  return session.site_ids.includes(siteId);
}
