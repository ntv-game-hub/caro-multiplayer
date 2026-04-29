import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const HOST = process.env.HOST || "0.0.0.0";
export const PORT = Number(process.env.PORT || 3000);
export const CLIENT_DIST = path.resolve(__dirname, "../../client/dist");
export const CORS_ORIGIN = process.env.CORS_ORIGIN || undefined;
