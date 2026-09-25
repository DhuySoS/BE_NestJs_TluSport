export interface AuthUser {
  id: number;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  roles: string[];
  height?: number | null;
  weight?: number | null;
}
