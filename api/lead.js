// Vercel Serverless Function: приймає заявку з форми й надсилає її в Telegram.
// Потрібні змінні середовища у Vercel (Settings → Environment Variables):
//   TELEGRAM_BOT_TOKEN — токен бота від @BotFather
//   TELEGRAM_CHAT_ID   — ваш chat id (куди бот надсилатиме заявки)
// Токен ніколи не потрапляє в код сайту чи браузер відвідувача.

const LIMITS = { name: 80, contact: 120, site_type: 80, plan: 40, message: 3000, lang: 5 };
const LANG_NAMES = { uk: "UA", en: "EN", pl: "PL", ru: "RU" };

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clean = (v, max) => String(v == null ? "" : v).trim().slice(0, max);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return res.status(500).json({ ok: false, error: "not_configured" });

  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }

  // Антиспам: приховане поле має бути порожнім
  if (body._gotcha) return res.status(200).json({ ok: true });

  const d = {};
  for (const k of Object.keys(LIMITS)) d[k] = clean(body[k], LIMITS[k]);

  if (d.name.length < 2 || d.contact.length < 3 || !d.site_type || d.message.length < 10) {
    return res.status(400).json({ ok: false, error: "invalid" });
  }

  const text =
    "🆕 <b>Нова заявка з сайту ANNA.STUDIO</b>\n\n" +
    `👤 <b>Ім'я:</b> ${esc(d.name)}\n` +
    `📱 <b>Контакт:</b> ${esc(d.contact)}\n` +
    `🌐 <b>Тип сайту:</b> ${esc(d.site_type)}\n` +
    `💼 <b>Тариф:</b> ${esc(d.plan || "Ще не визначено")}\n` +
    `🗣 <b>Мова сайту:</b> ${esc(LANG_NAMES[d.lang] || d.lang || "UA")}\n\n` +
    `📝 <b>Опис проєкту:</b>\n${esc(d.message)}`;

  try {
    const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true })
    });
    const out = await tg.json().catch(() => ({}));
    if (!tg.ok || !out.ok) return res.status(502).json({ ok: false, error: "telegram_error" });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ ok: false, error: "telegram_unreachable" });
  }
};
