/**
 * Contact Number Validation and Formatting Utilities
 * Standard: 11-digit Philippine contact numbers (e.g. 09123456789)
 * Display format: xxx-xxxx-xxx (e.g. 091-2334-5467 or 091-2345-6789)
 */

/**
 * Validates whether an input contact number contains exactly 11 digits
 * @param {string} val
 * @returns {boolean}
 */
export function isValidContactNumber(val) {
  if (!val) return false;
  const digits = String(val).replace(/\D/g, '');
  return digits.length === 11;
}

/**
 * Formats a contact number for display in the xxx-xxxx-xxx format.
 * If 11 digits: 3 digits - 4 digits - 4 digits (e.g. 091-2334-5467)
 * If 10 digits: 3 digits - 4 digits - 3 digits (e.g. 091-2334-546)
 * Handles combined numbers (e.g., "(046) 431-0330 / 0917-888-1234")
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
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  return str;
}
