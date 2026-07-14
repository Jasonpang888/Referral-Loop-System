// Serverless entry point for Vercel. Vercel's Node runtime invokes the
// default export directly as a (req, res) handler — an Express app instance
// already has that exact shape, so no adapter library is needed.
//
// This does NOT call app.listen() (see src/index.ts for that, used by the
// traditional long-running server / Replit / any plain Node host).
import app from "./app";

export default app;
