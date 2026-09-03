export type UserRole =
  | "admin"
  | "ims_manager"
  | "department_head"
  | "department_contributor";

export interface MockUser {
  id: string;
  identifier: string;
  password: string;
  name: string;
  role: UserRole;
}

export interface AuthResult {
  success: boolean;
  user?: Omit<MockUser, "password">;
  error?: string;
}

// Local mock users
const MOCK_USERS: MockUser[] = [
  {
    id: "user-001",
    identifier: "admin@mmcy.com",
    password: "Admin123!",
    name: "System Administrator",
    role: "admin",
  },
  {
    id: "user-002",
    identifier: "ims@mmcy.com",
    password: "IMS123!",
    name: "IMS Manager",
    role: "ims_manager",
  },
  {
    id: "user-003",
    identifier: "head@mmcy.com",
    password: "Head123!",
    name: "Department Head",
    role: "department_head",
  },
  {
    id: "user-004",
    identifier: "contributor@mmcy.com",
    password: "Contrib123!",
    name: "Department Contributor",
    role: "department_contributor",
  },
];

export async function mockLogin(
  identifier: string,
  password: string
): Promise<AuthResult> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 900));

  const normalizedIdentifier = identifier.trim().toLowerCase();

  const user = MOCK_USERS.find(
    (user) => user.identifier.toLowerCase() === normalizedIdentifier
  );

  if (!user) {
    return {
      success: false,
      error: "Invalid identifier or password.",
    };
  }

  if (user.password !== password) {
    return {
      success: false,
      error: "Invalid identifier or password.",
    };
  }

  const { password: _, ...safeUser } = user;

  return {
    success: true,
    user: safeUser,
  };
}