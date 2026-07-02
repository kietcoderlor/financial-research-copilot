export const SESSION_COOKIE = "frc_session";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  image_url: string | null;
  email_verified: boolean;
  created_at: string;
};

export type SessionPayload = {
  user: AuthUser;
};
