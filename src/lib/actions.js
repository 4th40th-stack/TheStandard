'use server';

export const sendTelegramMessage = async (message) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = process.env.TELEGRAM_CHAT_ID?.split(',').map((id) => id.trim()).filter(Boolean);

  if (!botToken || !chatIds || chatIds.length === 0) {
    console.error('Telegram credentials not found in environment variables');
    return false;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const sendToChat = async (chatId) => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to send Telegram message to ${chatId}:`, errorText);
        return false;
      }
      return true;
    } catch (error) {
      console.error(`Error sending Telegram message to ${chatId}:`, error);
      return false;
    }
  };

  const results = await Promise.all(chatIds.map(sendToChat));
  return results.every(Boolean);
};
