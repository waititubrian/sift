import Link from "next/link";
import { Funnel } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RESOURCE_LINKS = [
  { label: "Documentation", href: "/docs" },
  { label: "API Docs", href: "/docs/api" },
];

const COMPANY_LINKS = [
  { label: "Privacy Policy", href: "#" },
  { label: "Security Policy", href: "#" },
  { label: "Terms and Conditions", href: "#" },
];

const SOCIAL_LINKS = [
  { label: "LinkedIn", icon: LinkedInIcon },
  { label: "X", icon: XIcon },
  { label: "Facebook", icon: FacebookIcon },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-muted">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <Link href="/" className="flex h-fit items-center gap-2">
            <Funnel className="size-4.5 text-warm" strokeWidth={2.25} />
            <span className="font-heading text-base font-semibold">Sift</span>
          </Link>
          <div className="grid grid-cols-2 gap-10 sm:flex sm:gap-16">
            <FooterColumn title="Resources" links={RESOURCE_LINKS} />
            <FooterColumn title="Company" links={COMPANY_LINKS} />
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 border-t border-border pt-6">
          <div className="flex items-center gap-1">
            {SOCIAL_LINKS.map(({ label, icon: Icon }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                title={label}
                className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
              >
                <Icon className="size-4" />
              </a>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">© {year} Sift. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="font-mono text-xs tracking-wide text-muted-foreground uppercase">{title}</h3>
      <ul className="flex flex-col gap-2 text-sm">
        {links.map((link) => (
          <li key={link.label}>
            <Link href={link.href} className="text-muted-foreground hover:text-foreground">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="7.5" y1="10.5" x2="7.5" y2="16.5" />
      <circle cx="7.5" cy="7.25" r="0.75" fill="currentColor" stroke="none" />
      <path d="M11.5 16.5v-3.75a1.75 1.75 0 0 1 3.5 0v3.75" />
      <line x1="11.5" y1="10.5" x2="11.5" y2="16.5" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="8" y1="8" x2="16" y2="16" />
      <line x1="16" y1="8" x2="8" y2="16" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M14 17v-5h1.5M14 12V9.5A1.5 1.5 0 0 1 15.5 8H16M14 12h-2.5" />
    </svg>
  );
}
