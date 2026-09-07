import { SiteHeader } from "@/components/sift/site-header";
import { LeadsTable } from "@/components/sift/leads-table";

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader active="dashboard" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-muted-foreground">Every submission Sift has scored, routed, and logged.</p>
        </div>
        <LeadsTable />
      </main>
    </div>
  );
}
