import { Telegraf, Context } from "telegraf";
import { message } from "telegraf/filters";
import QRCode from "qrcode";

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN is not set");
}

// ⚠️ Создаём бота ОДИН РАЗ на уровне модуля — не внутри handler'а
export const bot = new Telegraf<Context>(BOT_TOKEN);

const MAX_LEN = 2000;

// /start
bot.start(async (ctx) => {
  await ctx.reply("Отправь мне любой текст — пришлю QR-код.");
});

// /help
bot.help(async (ctx) => {
  await ctx.reply(
    "Просто отправь текст, и я верну PNG с QR-кодом.\n" +
      `Максимальная длина: ${MAX_LEN} символов.`,
  );
});

// Любой текст
bot.on(message("text"), async (ctx) => {
  const text = ctx.message.text;

  // /start и /help уже обработаны выше, но на всякий случай
  if (text.startsWith("/")) return;

  if (text.length > MAX_LEN) {
    await ctx.reply(
      `Слишком длинный текст (${text.length} симв.). Максимум ${MAX_LEN}.`,
      { reply_parameters: { message_id: ctx.message.message_id } },
    );
    return;
  }

  try {
    const qrBuffer = await QRCode.toBuffer(text, {
      type: "png",
      errorCorrectionLevel: "M",
      width: 512,
      margin: 2,
    });

    await ctx.replyWithPhoto(
      { source: qrBuffer, filename: "qr.png" },
      { reply_parameters: { message_id: ctx.message.message_id } },
    );
  } catch (err) {
    console.error("QR generation failed:", err);
    await ctx.reply("Не удалось сгенерировать QR. Попробуй ещё раз.");
  }
});

// Глобальный обработчик ошибок
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
});
