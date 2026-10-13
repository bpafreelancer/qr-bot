import type { VercelRequest, VercelResponse } from "@vercel/node";
import QRCode from "qrcode";

const BOT_TOKEN = process.env.BOT_TOKEN;
const TG_ID = process.env.TG_ID; // строка или число — сравнение всё равно приводим к строке
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Telegram ограничение на QR (примерно 2.9k символов в зависимости от коррекции)
const MAX_LEN = 2000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel всегда ждёт 200, иначе Telegram будет ретраить
  if (req.method !== "POST") {
    return res.status(200).send("ok");
  }

  try {
    if (!BOT_TOKEN || !TG_ID) {
      console.error("BOT_TOKEN или TG_ID не заданы");
      return res.status(200).send("ok");
    }

    const update = req.body;
    const msg = update?.message ?? update?.edited_message;
    const text: string | undefined = msg?.text;

    // Принимаем только текстовые сообщения от нужного пользователя
    if (!msg || !text) return res.status(200).send("ok");

    const fromId = String(msg.from?.id ?? "");
    if (fromId !== String(TG_ID)) {
      // Чужим — ни слова. Просто игнор.
      return res.status(200).send("ok");
    }

    const chatId: number = msg.chat.id;
    const replyTo: number = msg.message_id;

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
    // Важно вернуть 200, иначе Telegram будет спамить ретраями
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
