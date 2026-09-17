import { clerkMiddleware } from "@clerk/nextjs/server";

// Session plumbing only — no route matching here. `createRouteMatcher` is
// deprecated; each protected page/route calls auth()/auth.protect() itself.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
