"use client";

import { FormEvent, useState } from "react";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ForgotPasswordFormProps {
  onBackToLogin?: () => void;
}

export default function ForgotPasswordForm({
  onBackToLogin,
}: ForgotPasswordFormProps) {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  function validateIdentifier() {
    const value = identifier.trim();

    if (!value) {
      setError("Enter your email address.");
      return false;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(value)) {
      setError("Enter a valid email address.");
      return false;
    }

    return true;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError("");

    if (!validateIdentifier()) {
      return;
    }

    setLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div
        className="
          w-full
          max-w-[440px]
          rounded-none
          bg-white
          p-8
          font-[Arial,Helvetica,sans-serif]
          sm:p-10
        "
      >
        <div className="flex flex-col">
          <h1
            className="
              text-[32px]
              font-normal
              tracking-[-0.025em]
              text-[#242C3F]
            "
          >
            Check your email
          </h1>

          <p
            className="
              mt-3
              max-w-[360px]
              text-[16px]
              font-normal
              leading-7
              text-[#747780]
            "
          >
            If an account exists for{" "}
            <span className="font-normal text-[#242C3F]">
              {identifier}
            </span>
            , you'll receive instructions to reset your password.
          </p>

          <Button
            type="button"
            onClick={onBackToLogin}
            className="
              mt-8
              h-[50px]
              w-full
              rounded-none
              bg-[#E8562D]
              text-[16px]
              font-normal
              text-white
              shadow-none
              transition-colors
              hover:bg-[#D1481F]
            "
          >
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="
        w-full
        max-w-[440px]
        rounded-none
        bg-white
        p-8
        font-[Arial,Helvetica,sans-serif]
        sm:p-10
      "
    >
      <div className="mb-8">
        <h1
          className="
            text-[32px]
            font-normal
            tracking-[-0.025em]
            text-[#242C3F]
          "
        >
          Forgot password?
        </h1>

        <p
          className="
            mt-2
            text-[16px]
            font-normal
            leading-7
            text-[#747780]
          "
        >
          Enter the email address associated with your account and
          we'll send you instructions to reset your password.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-6">
          <label
            htmlFor="reset-email"
            className="
              mb-2
              block
              text-[15px]
              font-normal
              text-[#242C3F]
            "
          >
            Email address
          </label>

          <Input
            id="reset-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={identifier}
            onChange={(event) => {
              setIdentifier(event.target.value);
              setError("");
            }}
            placeholder="you@example.com"
            disabled={loading}
            autoFocus
            className="
              h-[50px]
              rounded-md
              border
              border-neutral-200
              bg-white
              px-3.5
              text-[16px]
              font-normal
              text-[#242C3F]
              shadow-none
              outline-none
              transition
              placeholder:text-[#A4A6AD]
              focus-visible:border-neutral-300
              focus-visible:ring-0
              focus-visible:ring-offset-0
            "
          />

          {error && (
            <p
              role="alert"
              className="
                mt-2
                text-[14px]
                font-normal
                leading-5
                text-[#C0392B]
              "
            >
              {error}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="
            h-12
            w-full
            rounded-none
            bg-[#E8562D]
            text-base
            font-normal
            text-white
            shadow-none
            hover:bg-[#D1481F]
          "
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Sending...
            </>
          ) : (
            "Send reset instructions"
          )}
        </Button>
      </form>

      <button
        type="button"
        onClick={onBackToLogin}
        disabled={loading}
        className="
          mx-auto
          mt-7
          flex
          items-center
          gap-2
          text-[15px]
          font-normal
          text-[#747780]
          transition-colors
          hover:text-[#242C3F]
          disabled:cursor-not-allowed
          disabled:opacity-50
        "
      >
        Back to sign in
      </button>

      <p
        className="
          mt-5
          text-center
          text-[13px]
          font-normal
          leading-6
          text-[#9699A1]
        "
      >
        For security, we won't reveal whether an account exists
        for the email address provided.
      </p>
    </div>
  );
}