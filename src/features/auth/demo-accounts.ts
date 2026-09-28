import "server-only";

export type DemoAccount = { label: string; email: string };

/**
 * The accounts the demo picker offers, in display order. Server-only: the
 * login page passes this list down only when DEMO_LOGIN is on, so with the
 * flag off no demo email reaches the browser. demoSignIn() accepts nothing
 * outside it.
 */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { label: "IMS Manager",      email: "ims-admin@ex.com" },
  { label: "QMS Coordinator",  email: "qms-coordinator@ex.com" },
  { label: "ISMS Coordinator", email: "isms-coordinator@ex.com" },
  { label: "CTO/VP",           email: "cto@ex.com" },
  { label: "IT Manager",       email: "it-dept-manager@ex.com" },
  { label: "IT Contributor",   email: "it-contributor@ex.com" },
  { label: "SRD Manager",      email: "srd-dept-manager@ex.com" },
  { label: "SRD Contributor",  email: "srd-contributor@ex.com" },
  { label: "Viewer",           email: "viewer@ex.com" },
];
