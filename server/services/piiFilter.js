// Detects and redacts PII/PCI from user messages.
// Patterns: Israeli ID, credit/debit card, home address (Hebrew), issue dates.

const PATTERNS = [
  // Israeli ID — 9 digits, not part of a longer number
  { name: 'israeli_id', re: /(?<!\d)\d{9}(?!\d)/g },

  // Credit/debit card — 13-19 digits, optionally separated by spaces or dashes
  { name: 'card', re: /\b(?:\d[ -]?){13,19}\d\b/g },

  // Hebrew home address — address keyword followed by name + number
  {
    name: 'address',
    re: /(?:רחוב|שד'|שדרות|שדרת|דרך|סמטת|סמטה|כיכר|כיכרות|גבעת|קרית)\s+[א-ת"'\w\s]{1,40}\s+\d+/gi,
  },

  // Issue / expiry date — DD/MM/YYYY or DD.MM.YYYY
  { name: 'date', re: /\b(0?[1-9]|[12]\d|3[01])[./](0?[1-9]|1[0-2])[./](19|20)\d{2}\b/g },
];

const REDACTION = '[מידע אישי]';

function containsPii(text) {
  if (!text) return false;
  return PATTERNS.some(({ re }) => {
    re.lastIndex = 0;
    return re.test(text);
  });
}

function redactPii(text) {
  if (!text) return text;
  let result = text;
  for (const { re } of PATTERNS) {
    re.lastIndex = 0;
    result = result.replace(re, REDACTION);
  }
  return result;
}

module.exports = { containsPii, redactPii };
