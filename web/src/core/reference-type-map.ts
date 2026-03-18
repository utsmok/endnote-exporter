/**
 * EndNote → Zotero reference type mappings.
 *
 * Ported from Python exporter ENDNOTE_REF_TYPE_MAP and REF_TYPE_NAMES.
 */

/**
 * Maps raw EndNote database reference_type values to Zotero-compatible ref-type codes.
 *
 * Source: endnote_exporter.py ENDNOTE_REF_TYPE_MAP
 */
export const ENDNOTE_REF_TYPE_MAP: Record<number, number> = {
  0: 17, // default -> Journal Article
  1: 6, // maps to Book in baseline
  2: 32, // maps to Thesis
  3: 10, // maps to Conference Proceedings
  7: 5, // maps to Book Section
  10: 27, // maps to Report
  22: 31, // Statute
  31: 13, // Generic
  37: 34, // Unpublished Work
  43: 56, // Blog
  46: 57, // Serial (conference series)
  48: 59, // Dataset
};

/**
 * Human-readable names for common EndNote ref-type numeric codes.
 *
 * Source: endnote_exporter.py REF_TYPE_NAMES
 */
export const REF_TYPE_NAMES: Record<number, string> = {
  5: 'Book Section',
  6: 'Book',
  10: 'Conference Proceedings',
  13: 'Generic',
  17: 'Journal Article',
  27: 'Report',
  31: 'Statute',
  32: 'Thesis',
  34: 'Unpublished Work',
  56: 'Blog',
  57: 'Serial',
  59: 'Dataset',
};

/**
 * Small mapping of known journal full-titles to their common abbreviated forms.
 *
 * Source: endnote_exporter.py JOURNAL_ABBREVS
 */
export const JOURNAL_ABBREVS: Record<string, string> = {
  'NDT & E International': 'Ndt&E Int',
  'IOP Conference Series: Materials Science and Engineering':
    'IOP Conf Ser: Mater Sci Eng',
};

/**
 * Raw EndNote reference types that trigger tertiary-title fallback.
 * Used for conference/proceedings types.
 *
 * Source: endnote_exporter.py _build_record_dict (mapped in (3, 10, 46) or mapped == 10)
 */
export const CONFERENCE_REF_TYPES = new Set([3, 10, 46]);

/**
 * Journal article ref-type code.
 *
 * Source: endnote_exporter.py (mapped == 17)
 */
export const JOURNAL_ARTICLE_REF_TYPE = 17;
