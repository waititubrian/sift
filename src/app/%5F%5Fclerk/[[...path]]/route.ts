import { createFrontendApiProxyHandlers } from "@clerk/nextjs/server";

// Matches the client SDK's default proxy path (DEFAULT_PROXY_PATH = "/__clerk"),
// which @clerk/nextjs routes ClerkJS and Frontend API traffic through by default.
export const { GET, POST, PUT, DELETE, PATCH } = createFrontendApiProxyHandlers();
