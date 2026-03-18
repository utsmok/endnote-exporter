/**
 * XML sanitization utilities.
 *
 * Ported from Python exporter safe_str() and INVALID_XML_REGEX.
 *
 * XML 1.0 valid character ranges:
 * - Tab: \t (0x09)
 * - Newline: \n (0x0A)
 * - Carriage Return: \r (0x0D)
 * - U+0020 through U+D7FF
 * - U+E000 through U+FFFD
 */

/**
 * Regular expression matching invalid XML 1.0 characters.
 *
 * Source: endnote_exporter.py INVALID_XML_REGEX
 * Matches any character NOT in the allowed XML 1.0 ranges.
 */
const INVALID_XML_REGEX =
  /[^\t\n\r\u0020-\uD7FF\uE000-\uFFFD]/gu;

/**
 * Sanitizes a value for use in XML text or attribute values.
 *
 * Removes XML-illegal characters outside XML 1.0 allowed ranges.
 * Returns empty string on error or if input is null/undefined.
 *
 * @param input - The value to sanitize (string, number, null, undefined, etc.)
 * @returns A sanitized string with leading/trailing whitespace removed
 *
 * Source: endnote_exporter.py safe_str()
 */
export function safeStr(input: unknown): string {
  if (input === null || input === undefined) {
    return '';
  }

  try {
    const s = String(input).trim();
    // Remove invalid XML characters
    const sanitized = s.replace(INVALID_XML_REGEX, '');
    return sanitized || '';
  } catch (error) {
    // Log in development but return empty string in production
    if (import.meta.env.DEV) {
      console.warn('Error sanitizing string for XML:', input, error);
    }
    return '';
  }
}

export function escapeXmlText(input: unknown): string {
  return safeStr(input)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\r', '&#xD;');
}

export function escapeXmlAttribute(input: unknown): string {
  return escapeXmlText(input)
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/**
 * Normalizes line endings in ISBN and author address fields to CR.
 *
 * EndNote XML encodes CR as &#xD; to match EndNote export format.
 *
 * @param value - The raw value from the database
 * @returns Value with CRLF/LF normalized to CR
 *
 * Source: endnote_exporter.py _build_record_dict (ISBN and auth-address handling)
 */
export function normalizeToCr(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return value.replace(/\r\n/g, '\r').replace(/\n/g, '\r');
}

/**
 * Normalizes newline characters in secondary author fields.
 *
 * @param value - The raw value from the database
 * @returns Value with \r normalized to \n
 *
 * Source: endnote_exporter.py _build_record_dict (secondary_author handling)
 */
export function normalizeNewlines(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return value.replace(/\r/g, '\n');
}

/**
 * Checks if a string looks like a reasonable abbreviation.
 *
 * Criteria:
 * - Not empty, not longer than 40 characters
 * - Contains at least one ASCII alphanumeric character
 * - No more than 30% non-ASCII characters
 *
 * @param s - The string to check
 * @returns True if the string looks like a reasonable abbreviation
 *
 * Source: endnote_exporter.py _is_reasonable_abbr()
 */
export function isReasonableAbbr(s: string | null | undefined): boolean {
  if (!s) {
    return false;
  }

  const trimmed = s.trim();

  if (trimmed.length === 0 || trimmed.length > 40) {
    return false;
  }

  // Require at least one ASCII alnum
  const hasAsciiAlnum = /[0-9A-Za-z]/.test(trimmed);
  if (!hasAsciiAlnum) {
    return false;
  }

  // Avoid strings that are mostly non-ASCII
  const nonAsciiCount = Array.from(trimmed).filter((ch) => ch.charCodeAt(0) > 127)
    .length;
  const nonAsciiRatio = nonAsciiCount / Math.max(1, trimmed.length);

  return nonAsciiRatio <= 0.3;
}
