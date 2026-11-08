// Exposes Auth.js's endpoints (sign-in, Google callback, sign-out, ...)
// under /api/auth/*.
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
