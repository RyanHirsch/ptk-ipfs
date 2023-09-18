import fs from "node:fs";
import pino from "pino";
import { z } from "zod";

const LogLevel = z
  .union([
    z.literal("trace"),
    z.literal("debug"),
    z.literal("info"),
    z.literal("warn"),
    z.literal("error"),
    z.literal("fatal"),
  ])
  .optional()
  .default("info")
  .catch("info");

const streams = [
  { stream: fs.createWriteStream("ipfs.log"), level: "trace" },
  { stream: process.stdout, level: "trace" },
];
const logLevel = LogLevel.parse(process.env.LOGLEVEL);

export const logger = pino({ level: logLevel }, pino.multistream(streams));
