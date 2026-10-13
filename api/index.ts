import type { VercelRequest, VercelResponse } from "@vercel/node";
import QRCode from "qrcode";

const BOT_TOKEN = process.env.BOT_TOKEN;
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Мягкий лимит на длину текста (примерно соответствует пределу QR при коррекции M)
const MAX_LEN = 2000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Всегда 200, иначе Telegram будет ретраить апдейт
  if (req.method !== "POST") {
    return res.status(200).send("ok");
  }

  try {
    if (!BOT_TOKEN) {
      console.error("BOT_TOKEN не задан");
      return res.status(200).send("ok");
    }

    const update = req.body;
    const msg = update?.message ?? update?.edited_message;
    const text: string | undefined = msg?.text;

    // Реагируем только на текстовые сообщения
    if (!msg || !text) return res.status(200).send("ok");

    const chatId: number = msg.chat.id;
    const replyTo: number = msg.message_id;

    // /start — короткая подсказка
    if (text === "/start") {
      await callTelegram("sendMessage", {
        chat_id: chatId,
        reply_to_message_id: replyTo,
        text: "Отправь мне любой текст — пришлю QR-код.",
      });
      return res.status(200).send("ok");
    }

    // Слишком длинный текст
    if (text.length > MAX_LEN) {
      await callTelegram("sendMessage", {
        chat_id: chatId,
        reply_to_message_id: replyTo,
        text: `Слишком длинный текст (${text.length} симв.). Максимум ${MAX_LEN}.`,
      });
      return res.status(200).send("ok");
    }

    // Генерим PNG
    const qrBuffer = await QRCode.toBuffer(text, {
      type: "png",
      errorCorrectionLevel: "M",
      width: 512,
      margin: 2,
    });

    // sendPhoto через multipart/form-data
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("reply_to_message_id", String(replyTo));
    form.append(
      "photo",
      new Blob([qrBuffer], { type: "image/png" }),
      "qr.png",
    );

    await fetch(`${TG_API}/sendPhoto`, { method: "POST", body: form });

    return res.status(200).send("ok");
  } catch (err) {
    console.error("handler error:", err);
    // Всё равно 200 — иначе Telegram зациклит ретраи
    return res.status(200).send("ok");
  }
}

// Хелпер для JSON-методов Telegram
async function callTelegram(method: string, payload: Record<string, unknown>) {
  try {
    await fetch(`${TG_API}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error(`telegram ${method} failed:`, e);
  }
}
