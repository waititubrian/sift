import { createFrontendApiProxyHandlers } from "@clerk/nextjs/server";

// Matches NEXT_PUBLIC_CLERK_PROXY_URL (/__clerk) — see ARCHITECTURE.md's
// Authentication section for why that env var is set explicitly.
export const { GET, POST, PUT, DELETE, PATCH } = createFrontendApiProxyHandlers();
