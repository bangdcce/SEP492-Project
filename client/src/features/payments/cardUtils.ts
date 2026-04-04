export type CardBrand =
  | "Visa"
  | "Mastercard"
  | "American Express"
  | "Discover"
  | "Diners Club"
  | "JCB"
  | "UnionPay"
  | "Card";

export const normalizeCardNumber = (value: string) => value.replace(/\D/g, "");

export const formatCardNumberInput = (value: string) => {
  const digits = normalizeCardNumber(value).slice(0, 19);
  const brand = detectCardBrand(digits);

  if (brand === "American Express") {
    const first = digits.slice(0, 4);
    const second = digits.slice(4, 10);
    const third = digits.slice(10, 15);
    return [first, second, third].filter(Boolean).join(" ");
  }

  return digits.replace(/(.{4})/g, "$1 ").trim();
};

export const formatCardExpiryInput = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

export const detectCardBrand = (cardNumber: string): CardBrand => {
  if (/^4\d{0,18}$/.test(cardNumber)) return "Visa";
  if (/^(5[1-5]\d{0,14}|2(2[2-9]|[3-6]\d|7[01])\d{0,12}|2720\d{0,12})$/.test(cardNumber)) {
    return "Mastercard";
  }
  if (/^3[47]\d{0,13}$/.test(cardNumber)) return "American Express";
  if (/^(6011\d{0,12}|65\d{0,14}|64[4-9]\d{0,13})$/.test(cardNumber)) return "Discover";
  if (/^3(0[0-5]|[68]\d)\d{0,11}$/.test(cardNumber)) return "Diners Club";
  if (/^(2131|1800|35\d{0,3})\d{0,11}$/.test(cardNumber)) return "JCB";
  if (/^62\d{0,17}$/.test(cardNumber)) return "UnionPay";
  return "Card";
};

export const passesLuhn = (cardNumber: string) => {
  const digits = normalizeCardNumber(cardNumber);

  if (digits.length < 12) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
};

export const parseCardExpiry = (value: string) => {
  const digits = value.replace(/\D/g, "");

  if (digits.length < 4) {
    return { isValid: false, month: null, year: null };
  }

  const month = Number(digits.slice(0, 2));
  const shortYear = Number(digits.slice(2, 4));
  const fullYear = 2000 + shortYear;

  if (month < 1 || month > 12) {
    return { isValid: false, month: null, year: null };
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  if (fullYear < currentYear || (fullYear === currentYear && month < currentMonth)) {
    return { isValid: false, month: null, year: null };
  }

  return { isValid: true, month, year: fullYear };
};

export const maskCardLabel = (brand: string, last4: string) => `${brand} •••• ${last4}`;
