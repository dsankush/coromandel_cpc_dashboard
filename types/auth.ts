export type UserRole = "admin" | "client";

export interface AuthUser {
  username: string;
  role: UserRole;
  name: string;
  loginTime: string;
}
