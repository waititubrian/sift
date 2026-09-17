"use client";

import { ClerkProvider as BaseClerkProvider } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";

// Literal hex, not var(--x) — Clerk does color math on these at render time.
// Kept in sync by hand with :root/.dark in globals.css.
const LIGHT_VARIABLES = {
  colorPrimary: "#18181B",
  colorBackground: "#FFFFFF",
  colorText: "#1A2130",
  colorTextSecondary: "#5C6779",
  colorInputBackground: "#F6F7F9",
  colorInputText: "#1A2130",
  colorDanger: "#C1442C",
  colorSuccess: "#3E7CB1",
  colorNeutral: "#1A2130",
  borderRadius: "0.5rem",
  fontFamily: "var(--font-body)",
};

const DARK_VARIABLES = {
  colorPrimary: "#FAFAFA",
  colorBackground: "#1A2029",
  colorText: "#E7E9EE",
  colorTextSecondary: "#A6AEBF",
  colorInputBackground: "#12161F",
  colorInputText: "#E7E9EE",
  colorDanger: "#E27358",
  colorSuccess: "#6FA8D6",
  colorNeutral: "#E7E9EE",
  borderRadius: "0.5rem",
  fontFamily: "var(--font-body)",
};

const ELEMENTS = {
  card: "shadow-none ring-1 ring-foreground/10 rounded-xl",
  headerTitle: "font-heading text-xl font-semibold",
  headerSubtitle: "text-muted-foreground",
  socialButtonsBlockButton: "border border-border rounded-lg normal-case font-medium",
  socialButtonsBlockButtonText: "font-medium",
  dividerLine: "bg-border",
  dividerText: "text-muted-foreground",
  formFieldLabel: "text-foreground font-medium",
  formFieldInput: "rounded-lg border-border",
  formButtonPrimary:
    "rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 normal-case shadow-none text-sm font-medium",
  footerActionLink: "text-primary hover:underline",
  identityPreviewEditButton: "text-primary",
  otpCodeFieldInput: "rounded-lg border-border",
};

export function ClerkProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const variables = resolvedTheme === "dark" ? DARK_VARIABLES : LIGHT_VARIABLES;

  return (
    <BaseClerkProvider appearance={{ variables, elements: ELEMENTS }}>
      {children}
    </BaseClerkProvider>
  );
}
