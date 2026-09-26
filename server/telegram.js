const crypto = require('crypto');

function validateTelegramInitData(initData, botToken, now = Math.floor(Date.now() / 1000)) {
  if (!botToken) throw new Error('BOT_TOKEN غير مضبوط');

  const params = new URLSearchParams(initData || '');
  const receivedHash = params.get('hash');
  if (!receivedHash) throw new Error('Telegram hash مفقود');

  const authDate = Number(params.get('auth_date'));
  if (!Number.isInteger(authDate) || now - authDate > 86400 || authDate > now + 60) {
    throw new Error('Telegram initData منتهي الصلاحية');
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const expectedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (
    receivedHash.length !== expectedHash.length ||
    !crypto.timingSafeEqual(
      Buffer.from(receivedHash),
      Buffer.from(expectedHash)
    )
  ) {
    throw new Error('Telegram initData غير موثوق');
  }

  const userRaw = params.get('user');
  if (!userRaw) throw new Error('بيانات مستخدم Telegram مفقودة');

  const user = JSON.parse(userRaw);

  return {
    id: user.id,
    firstName: user.first_name || '',
    lastName: user.last_name || '',
    username: user.username || ''
  };
}

module.exports = { validateTelegramInitData };
