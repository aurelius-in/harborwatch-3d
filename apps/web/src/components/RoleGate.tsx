import type { Role } from "@harborwatch/contracts";
import type { ReactNode } from "react";

export function RoleGate({
  role,
  allow,
  children,
}: {
  role: Role | undefined;
  allow: Role[];
  children: ReactNode;
}) {
  if (!role || !allow.includes(role)) return null;
  return <>{children}</>;
}
