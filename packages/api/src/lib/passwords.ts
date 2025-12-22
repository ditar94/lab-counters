import crypto from 'crypto';

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*_-';

function pickRandom(chars: string): string {
  const index = crypto.randomInt(0, chars.length);
  return chars[index]!;
}

function shuffle(value: string): string {
  const chars = value.split('');
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function generateTemporaryPassword(length = 12): string {
  const minLength = 8;
  const targetLength = Math.max(length, minLength);
  const all = `${LOWER}${UPPER}${DIGITS}${SYMBOLS}`;

  const required = [
    pickRandom(LOWER),
    pickRandom(UPPER),
    pickRandom(DIGITS),
    pickRandom(SYMBOLS),
  ];

  const remainingLength = Math.max(0, targetLength - required.length);
  let remainder = '';
  for (let i = 0; i < remainingLength; i += 1) {
    remainder += pickRandom(all);
  }

  return shuffle(required.join('') + remainder);
}
