import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { SiteHeader } from "@/components/sift/site-header";

export const metadata: Metadata = {
  title: "Sign in — Sift",
};

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader active="account" />
      <main id="main" className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 sm:py-16">
        <SignIn />
      </main>
    </div>
  );
}
