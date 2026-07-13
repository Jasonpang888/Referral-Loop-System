import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { assertProductionAuthConfig } from "./lib/auth";

const app: Express = express();
assertProductionAuthConfig();

function parseAllowedOrigins(): string[] | undefined {
  const raw = process.env.CORS_ORIGIN ?? process.env.FRONTEND_ORIGIN;
  if (!raw) return undefined;
  return raw.split(",").map((origin) => origin.trim()).filter(Boolean);
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const allowedOrigins = parseAllowedOrigins();
app.use(cors(allowedOrigins ? { origin: allowedOrigins, credentials: true } : undefined));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
