import LoginForm from "@/features/auth/components/LoginForm";
import { DEMO_ACCOUNTS } from "@/features/auth/demo-accounts";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { expired } = await searchParams;

  // Read per request on the server (searchParams already makes this route
  // dynamic), so the flag is the running server's, not the build's. With it
  // off the list is never passed down and stays out of the browser.
  const demoEnabled = process.env.DEMO_LOGIN === "true";

  return (
    <LoginForm
      expired={expired === "1"}
      demoAccounts={demoEnabled ? DEMO_ACCOUNTS : null}
    />
  );
}
