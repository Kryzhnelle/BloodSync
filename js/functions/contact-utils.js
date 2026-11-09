/**
 * BloodSync - Contact Number Formatting & Privacy Utilities
 * Standard: 11-digit Philippine mobile numbers (e.g. 09123456789)
 * Required Display Format: XXXX-XXX-XXXX (e.g. 0912-345-6789)
 */

/**
 * Validates whether an input contact number contains exactly 11 digits
 * @param {string|number} val
 * @returns {boolean}
 */
export function isValidContactNumber(val) {
  if (!val) return false;
  const digits = String(val).replace(/\D/g, '');
  return digits.length === 11 && (digits.startsWith('09') || digits.startsWith('02'));
}

/**
 * Normalizes a phone number to pure digits for database storage without separators
 * @param {string|number} val
 * @returns {string}
 */
export function normalizePhoneNumber(val) {
  if (!val) return '';
  const digits = String(val).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('63')) {
    return '0' + digits.slice(2);
  }
  return digits;
}

/**
 * Formats a contact number for display in the XXXX-XXX-XXXX format.
 * Example: 09123456789 -> 0912-345-6789
 * Handles compound numbers separated by slashes gracefully.
 * @param {string|number} val
 * @returns {string}
 */
export function formatContactDisplay(val) {
  if (!val) return '';
  const str = String(val).trim();

  // If multiple numbers separated by slash (e.g. landline / mobile)
  if (str.includes('/')) {
    return str
      .split('/')
      .map((part) => formatContactDisplay(part.trim()))
      .join(' / ');
  }

  const digits = str.replace(/\D/g, '');

  // 12 digits with country code 63 (e.g. 639123456789 -> 0912-345-6789)
  if (digits.length === 12 && digits.startsWith('63')) {
    const local = '0' + digits.slice(2);
    return `${local.slice(0, 4)}-${local.slice(4, 7)}-${local.slice(7, 11)}`;
  }

  // Standard 11-digit Philippine mobile number: XXXX-XXX-XXXX (e.g. 0912-345-6789)
  if (digits.length === 11) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
  }

  // 10 digits missing leading zero (e.g. 9123456789 -> 0912-345-6789)
  if (digits.length === 10 && digits.startsWith('9')) {
    const local = '0' + digits;
    return `${local.slice(0, 4)}-${local.slice(4, 7)}-${local.slice(7, 11)}`;
  }

  // If already matches XXXX-XXX-XXXX
  if (/^\d{4}-\d{3}-\d{4}$/.test(str)) {
    return str;
  }

  return str;
}

/**
 * Formats a contact number while user types into an input field: XXXX-XXX-XXXX
 * @param {string} val
 * @returns {string}
 */
export function formatPhoneInputValue(val) {
  if (!val) return '';
  let digits = String(val).replace(/\D/g, '');
  if (digits.length > 11) {
    digits = digits.slice(0, 11);
  }

  if (digits.length <= 4) {
    return digits;
  }
  if (digits.length <= 7) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
}

/**
 * Attaches real-time XXXX-XXX-XXXX formatting to a phone input element.
 * Does not interfere with deleting, backspacing, or pasting.
 * @param {HTMLInputElement} inputEl
 */
export function attachPhoneInputFormatter(inputEl) {
  if (!inputEl) return;
  if (inputEl._phoneFormatterBound) {
    // If element already has formatter attached, format its current value
    if (inputEl.value) {
      inputEl.value = formatPhoneInputValue(inputEl.value);
    }
    return;
  }
  inputEl._phoneFormatterBound = true;

  inputEl.maxLength = 13; // 4 + 1 + 3 + 1 + 4
  inputEl.placeholder = '0912-345-6789';

  if (inputEl.value) {
    inputEl.value = formatPhoneInputValue(inputEl.value);
  }

  const handleInput = () => {
    const prevVal = inputEl.value;
    const cursorPos = inputEl.selectionEnd || 0;
    const digitsBeforeCursor = prevVal.slice(0, cursorPos).replace(/\D/g, '').length;

    const newVal = formatPhoneInputValue(prevVal);
    inputEl.value = newVal;

    // Restore cursor position corresponding to the digits typed before
    let newPos = 0;
    let digitsCount = 0;
    while (newPos < newVal.length && digitsCount < digitsBeforeCursor) {
      if (/\d/.test(newVal[newPos])) {
        digitsCount++;
      }
      newPos++;
    }
    inputEl.setSelectionRange(newPos, newPos);
  };

  inputEl.addEventListener('input', handleInput);
  inputEl.addEventListener('paste', () => {
    setTimeout(handleInput, 0);
  });
}

/**
 * Masks a personal name for privacy / anonymous requests using the format D****e.
 * E.g. "Denice" -> "D****e", "Anita Bath" -> "A****a B****h"
 * @param {string} name
 * @returns {string}
 */
export function maskName(name) {
  if (!name || typeof name !== 'string') return 'D****e';
  const trimmed = name.trim();
  if (!trimmed) return 'D****e';

  const parts = trimmed.split(/\s+/);
  return parts
    .map((part) => {
      if (part.length <= 1) return part;
      if (part.length === 2) return `${part[0]}*`;
      const asterisks = '*'.repeat(Math.max(part.length - 2, 4));
      return `${part[0]}${asterisks}${part[part.length - 1]}`;
    })
    .join(' ');
}

/**
 * Evaluates each strong password requirement for real-time feedback and validation:
 * - At least 8 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one number (0-9)
 * - At least one special character (e.g. !, @, #, $, %)
 * @param {string} password
 */
export function getPasswordRequirementsStatus(password) {
  const pwd = String(password || '');
  const minLength = pwd.length >= 8;
  const hasUppercase = /[A-Z]/.test(pwd);
  const hasLowercase = /[a-z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pwd);
  const isValid = minLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;

  return {
    minLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecial,
    isValid,
  };
}

/**
 * Returns { isValid: boolean, message: string, checks: object } for a password.
 * @param {string} password
 */
export function validateStrongPassword(password) {
  const checks = getPasswordRequirementsStatus(password);
  if (checks.isValid) {
    return { isValid: true, message: '', checks };
  }
  const missing = [];
  if (!checks.minLength) missing.push('at least 8 characters');
  if (!checks.hasUppercase) missing.push('one uppercase letter (A–Z)');
  if (!checks.hasLowercase) missing.push('one lowercase letter (a–z)');
  if (!checks.hasNumber) missing.push('one number (0–9)');
  if (!checks.hasSpecial) missing.push('one special character (!@#$%...)');

  return {
    isValid: false,
    message: `Password does not meet requirements: must contain ${missing.join(', ')}.`,
    checks,
  };
}

