"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface LoginFormProps {
  onClose?: () => void;
  onForgotPassword?: () => void;
}

type MockUser = {
  identifier: string;
  password: string;
  role:
    | "admin"
    | "ims_manager"
    | "department_manager"
    | "department_contributor";
};

const MOCK_USERS: MockUser[] = [
  { identifier: "admin@example.com", password: "Admin123!", role: "admin" },
  { identifier: "ims@example.com", password: "Ims123!", role: "ims_manager" },
  {
    identifier: "manager@example.com",
    password: "Manager123!",
    role: "department_manager",
  },
  {
    identifier: "contributor@example.com",
    password: "Contributor123!",
    role: "department_contributor",
  },
];

async function mockLogin(
  identifier: string,
  password: string
): Promise<{
  success: boolean;
  user?: MockUser;
  message?: string;
}> {
  await new Promise((resolve) => setTimeout(resolve, 200));

  const user = MOCK_USERS.find(
    (item) =>
      item.identifier.toLowerCase() ===
      identifier.toLowerCase().trim()
  );

  if (!user) {
    return {
      success: false,
      message: "Invalid identifier or password.",
    };
  }

  if (user.password !== password) {
    return {
      success: false,
      message: "Invalid identifier or password.",
    };
  }

  return { success: true, user };
}

function getDashboardRoute(role: MockUser["role"]) {
  switch (role) {
    case "admin":
      return "/dashboard/admin";
    case "ims_manager":
      return "/dashboard/ims";
    case "department_manager":
      return "/dashboard/department";
    case "department_contributor":
      return "/dashboard/department";
    default:
      return "/dashboard";
  }
}

export default function LoginForm({
  onClose,
  onForgotPassword,
}: LoginFormProps) {
  /* FORM STATE */
  const [identifier, setIdentifier] = useState("admin@example.com");
  const [password, setPassword] = useState("");

  /* UI STATE */
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [loading, setLoading] = useState(false);

  /* ERROR STATE */
  const [identifierError, setIdentifierError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [authError, setAuthError] = useState("");

  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    passwordRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      setLoading(false);
    };
  }, []);

  function validateForm() {
    let valid = true;

    setIdentifierError("");
    setPasswordError("");
    setAuthError("");

    const cleanIdentifier = identifier.trim();

    if (!cleanIdentifier) {
      setIdentifierError("Enter your email or username.");
      valid = false;
    }

    if (!password) {
      setPasswordError("Enter your password.");
      valid = false;
    }

    return valid;
  }

  /* CAPS LOCK DETECTION */
  function handlePasswordKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    setCapsLockOn(event.getModifierState("CapsLock"));
  }

  function handlePasswordKeyUp(
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    setCapsLockOn(event.getModifierState("CapsLock"));
  }

  /* LOGIN */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    const valid = validateForm();
    if (!valid) return;

    setLoading(true);
    setAuthError("");

    try {
      const result = await mockLogin(identifier, password);

      if (!result.success || !result.user) {
        setAuthError(
          result.message || "Authentication failed. Please try again."
        );
        return;
      }

      /* USER ROLE RETURNED */
      const role = result.user.role;

      /* OPTIONAL LOCAL SESSION */
      localStorage.setItem(
        "ims_user",
        JSON.stringify({
          identifier: result.user.identifier,
          role: result.user.role,
        })
      );

      /* ROLE-BASED ROUTING */
      const dashboardRoute = getDashboardRoute(role);
      window.location.href = dashboardRoute;
    } catch {
      setAuthError(
        "Something went wrong while signing you in. Please try again."
      );
    } finally {
      /* RESET LOADING STATE */
      setLoading(false);
    }
  }

  /* FORGOT PASSWORD — hands off to the parent to swap in the reset form */
  function handleForgotPassword() {
    onForgotPassword?.();
  }

  return (
    <div
      className="relative w-full max-w-md bg-white shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
    >
      <div className="relative px-8 py-10 sm:px-10 sm:py-11">
        {onClose && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={loading}
            aria-label="Close login"
            className="absolute right-4 top-4 h-9 w-9 rounded-none text-neutral-400 hover:bg-neutral-100 hover:text-[#1c1f2e]"
          >
            <X className="h-[20px] w-[20px]" />
          </Button>
        )}

        {/* MMCY logo — centered, no icon, no fill */}
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="text-3xl font-extrabold tracking-tight text-[#1c1f2e]">
            MM<span className="text-[#e8562d]">C</span>Y
          </span>

          <p className="mt-2 text-base leading-6 text-neutral-500">
            Sign in to access the IMS platform
          </p>
        </div>

        {/* Authentication error */}
        {authError && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 border border-red-200 bg-red-50 px-3.5 py-3 text-base leading-6 text-red-700"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Identifier */}
          <div className="mb-5 space-y-2">
            <Label
              htmlFor="identifier"
              className="text-base text-[#1c1f2e]"
            >
              Email
            </Label>

            <div className="relative">
              <Input
                id="identifier"
                name="username"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={identifier}
                onChange={(event) => {
                  setIdentifier(event.target.value);
                  setIdentifierError("");
                  setAuthError("");
                }}
                placeholder="you@example.com"
                disabled={loading}
                aria-invalid={Boolean(identifierError)}
                aria-describedby={
                  identifierError ? "identifier-error" : undefined
                }
                className="h-12 rounded-md border border-neutral-200 text-base shadow-none focus-visible:border-neutral-300 focus-visible:ring-0"
              />
            </div>

            {identifierError && (
              <p
                id="identifier-error"
                className="text-sm text-red-600"
              >
                {identifierError}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="mb-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="password"
                className="text-base text-[#1c1f2e]"
              >
                Password
              </Label>
            </div>

            <div className="relative">
              <Input
                ref={passwordRef}
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setPasswordError("");
                  setAuthError("");
                }}
                onKeyDown={handlePasswordKeyDown}
                onKeyUp={handlePasswordKeyUp}
                onBlur={() => setCapsLockOn(false)}
                placeholder="Enter your password"
                disabled={loading}
                aria-invalid={Boolean(passwordError)}
                aria-describedby={
                  passwordError
                    ? "password-error"
                    : capsLockOn
                      ? "caps-lock-warning"
                      : undefined
                }
                className="h-12 rounded-md border border-neutral-200 pr-10 text-base shadow-none focus-visible:border-neutral-300 focus-visible:ring-0"
              />

              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                className="text-sm font-medium text-[#e8562d] transition hover:text-[#d1481f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Forgot password?
              </button>

              <button
                type="button"
                onClick={() =>
                  setShowPassword((current) => !current)
                }
                disabled={loading}
                aria-label={
                  showPassword ? "Hide password" : "Show password"
                }
               className={cn(
  "absolute right-2 top-[48%] flex h-8 w-8 -translate-y-1/2 items-center justify-center",
  "text-neutral-400",
  "disabled:cursor-not-allowed disabled:opacity-50"
)}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>

            {capsLockOn && (
              <p
                id="caps-lock-warning"
                className="text-sm font-medium text-amber-600"
              >
                Caps Lock is on
              </p>
            )}

            {passwordError && (
              <p
                id="password-error"
                className="text-sm text-red-600"
              >
                {passwordError}
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-none bg-[#e8562d] text-base text-white hover:bg-[#d1481f]"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm leading-6 text-neutral-400">
          Authorized users only. Your access is protected by organizational authentication.
        </p>
      </div>
    </div>
  );
}