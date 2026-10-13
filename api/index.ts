import type { VercelRequest, VercelResponse } from "@vercel/node";
import { bot } from "../src/bot";

// ⚠️ Никакого bot.launch() здесь быть не должно
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Telegram всегда должен получать 200, иначе будет ретраить апдейт часами
  if (req.method !== "POST") {
    return res.status(200).send("QR bot is running");
  }

  try {
    await bot.handleUpdate(req.body);
    return res.status(200).send("ok");
  } catch (err) {
    console.error("handleUpdate failed:", err);
    // даже при ошибке возвращаем 200, чтобы Telegram не зациклился
    return res.status(200).send("ok");
  }
}
