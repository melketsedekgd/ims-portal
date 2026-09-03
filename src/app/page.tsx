"use client";

import { useState } from "react";

import LandingHeader from "@/components/landing/LandingHeader";
import Hero from "@/components/landing/Hero";
import LoginForm from "@/components/auth/LoginForm";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export default function Home() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [authView, setAuthView] = useState<"login" | "forgot">("login");

  function openLogin() {
    setAuthView("login");
    setLoginOpen(true);
  }

  function closeLogin() {
    setLoginOpen(false);
    setAuthView("login"); // reset so it reopens on the login form next time
  }

  return (
    <main className="min-h-screen bg-[#05070D]">
      {/* Landing page */}
      <div
        className={`
          min-h-screen
          transition-all
          duration-300
          ${
            loginOpen
              ? "scale-[0.99] blur-[8px] brightness-[0.65]"
              : ""
          }
        `}
      >
        <LandingHeader
          onLoginClick={openLogin}
        />

        <Hero
          onLoginClick={openLogin}
        />
      </div>

      {/* Login / Forgot password overlay */}
      {loginOpen && (
        <div
          className="
            fixed
            inset-0
            z-[2000]
            flex
            items-center
            justify-center
            bg-black/20
            px-6
            backdrop-blur-[2px]
          "
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeLogin();
            }
          }}
        >
          {authView === "forgot" ? (
            <ForgotPasswordForm
              onBackToLogin={() => setAuthView("login")}
            />
          ) : (
            <LoginForm
              onClose={closeLogin}
              onForgotPassword={() => setAuthView("forgot")}
            />
          )}
        </div>
      )}
    </main>
  );
}