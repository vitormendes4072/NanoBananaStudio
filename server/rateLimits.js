import { rateLimit } from "express-rate-limit";

export const generationLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições de geração. Aguarde um momento antes de enviar mais jobs." },
});

export const heavyComputeLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições de processamento simultâneas. Aguarde um momento." },
});

export const libraryLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições à biblioteca. Aguarde um momento." },
});
