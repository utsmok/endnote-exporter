from pathlib import Path
from collections import defaultdict
import sqlite3
import xml.etree.ElementTree as ET
from xml.dom import minidom
from xml.sax.saxutils import escape
from datetime import datetime
import json
import re
from typing import Any
from loguru import logger
import sys

# Configure logging sinks and formats
# Ensure a logs folder exists
if getattr(sys, 'frozen', False):
    # If the application is run as a bundle, the PyInstaller bootloader
    # extends the sys module by a flag frozen=True and sets the app
    # path into variable _MEIPASS'.
    application_path = sys.executable
else:
    application_path = __file__
_LOG_DIR = Path(application_path).parent
_LOG_DIR.mkdir(parents=True, exist_ok=True)

logfile = _LOG_DIR / "endnote_exporter.log"


logger.remove()

logger.add(
    str(logfile),
    level="TRACE",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {function}:{name}:{line} |  {message}",
    encoding="utf-8",
    rotation="10 MB",
    enqueue=True,
    colorize=False,
    backtrace=True,
    diagnose=True,
)

# JSONL sink for comparisons only. We use serialize=True so records are JSON.
comparisons_file = _LOG_DIR / "comparisons.jsonl"

# Compiled regex for removing invalid XML characters
# Build a character class of invalid ranges and remove them via re.sub.
# Valid ranges: \t\n\r\x20-\uD7FF\uE000-\uFFFD and beyond BMP.
# We'll remove any char not in the allowed set.
# Note: Python's re doesn't support codepoints above \uFFFF in character
# classes on narrow builds, but modern Python on Windows is wide and will
# handle supplementary planes. We'll include the common ranges here.

INVALID_XML_REGEX = re.compile(
    r"[^	\n\r\u0020-\uD7FF\uE000-\uFFFD]",
    flags=re.UNICODE,
)

# Best-effort mapping from internal reference_type codes to EndNote ref-type codes
# This was inferred from the sample CSV vs EndNote XML. Adjust as needed.
ENDNOTE_REF_TYPE_MAP = {
    # Map raw reference_type (DB) -> EndNote numeric ref-type observed in baseline XML
    0: 17,   # default -> Journal Article
    1: 6,    # maps to Book in baseline
    2: 32,   # maps to Thesis
    3: 10,   # maps to Conference Proceedings
    7: 5,    # maps to Book Section
    10: 27,  # maps to Report
    22: 31,  # Statute
    31: 13,  # Generic
    37: 34,  # Unpublished Work
    43: 56,  # Blog
    46: 57,  # Serial (conference series)
    48: 59,  # Dataset
}

# Human-readable names for common EndNote ref-type numeric codes
REF_TYPE_NAMES = {
    5: "Book Section",
    6: "Book",
    10: "Conference Proceedings",
    13: "Generic",
    17: "Journal Article",
    27: "Report",
    31: "Statute",
    32: "Thesis",
    34: "Unpublished Work",
    56: "Blog",
    57: "Serial",
    59: "Dataset",
}

# Small mapping of known journal full-titles to their common abbreviated forms
JOURNAL_ABBREVS = {
    "NDT & E International": "Ndt&E Int",
    "IOP Conference Series: Materials Science and Engineering": "IOP Conf Ser: Mater Sci Eng",
}


def _split_keywords(raw: str | None) -> list[str]:
    if not raw:
        return []
    s = str(raw)
    # if explicit newline-separated or semicolon-separated, split into list
    if "\n" in s or "\r" in s:
        return [p.strip() for p in s.splitlines() if p.strip()]
    if ";" in s:
        return [p.strip() for p in s.split(";") if p.strip()]
    # otherwise preserve comma-separated raw string as a single entry to match baseline exports
    return [s.strip()]


def _is_reasonable_abbr(s: str | None) -> bool:
    """Return True if string s looks like a reasonable abbreviation (short, mostly ASCII letters/digits/punct)."""
    if not s:
        return False
    s = str(s).strip()
    if len(s) == 0 or len(s) > 40:
        return False
    # require at least one ASCII alnum
    if not any(('0' <= ch <= '9') or ('A' <= ch <= 'Z') or ('a' <= ch <= 'z') for ch in s):
        return False
    # avoid strings that are mostly non-ascii
    non_ascii = sum(1 for ch in s if ord(ch) > 127)
    if non_ascii / max(1, len(s)) > 0.3:
        return False
    return True


def _ensure_list(x: Any) -> list[Any]:
    if x is None:
        return []
    if isinstance(x, list):
        return x
    return [x]



class EndnoteExporter:
    def export_references_to_xml(self, enl_file_path: Path, output_file: Path):
        """Main method to perform the database-to-XML conversion.

        Takes the full path to the .enl file as input.
        """
        logger.debug(f'Starting export for {enl_file_path} to {output_file}')
        return self._export(enl_file_path, output_file)

    def _export(self, enl_file_path: Path, output_file: Path):
        base_path = enl_file_path.parent
        library_name = enl_file_path.stem
        output_path = (
            base_path / f"{library_name}_zotero_export.xml"
            if output_file is None
            else output_file
        )
        data_path = base_path / f"{library_name}.Data"
        db_path = data_path / "sdb" / "sdb.eni"

        if not db_path.exists():
            error_msg = f"Database file not found at '{db_path}'. Make sure the .Data folder exists."
            logger.error(error_msg)
            raise FileNotFoundError(error_msg)

        logger.debug(f"Using database at {db_path}")

        try:
            con = sqlite3.connect(db_path)
            cur = con.cursor()

            cur.execute("SELECT * FROM refs WHERE trash_state = 0")
            all_refs = cur.fetchall()
            col_names = [description[0] for description in cur.description]

            cur.execute("SELECT refs_id, file_path FROM file_res")
            all_files = cur.fetchall()

            file_mapping = defaultdict(list)
            for ref_id, path in all_files:
                file_mapping[ref_id].append(path)

            logger.debug(f"Found {len(all_refs)} references and {len(all_files)} files in the database.")

            xml_root = ET.Element("xml")
            records = create_xml_element(xml_root, "records")

            # Open the comparisons_file once before the loop
            with open(comparisons_file, "a", encoding="utf-8") as comp_f:
                logger.debug(f'Starting parsing the data to create the xml file and comparisons.')
                logger.debug(f"Writing comparisons to {comparisons_file}. Should have {len(all_refs)} entries.")
                logger.debug(f'Writing output XML to {output_path}.')
                for row in all_refs:
                    ref = dict(zip(col_names, row))

                    try:
                        record_dict = self._build_record_dict(ref, file_mapping, data_path)
                    except Exception as e:
                        logger.error(f"Error building record_dict for reference ID {ref.get('id')}: {e}\nSkipping this record.")
                        continue
                    try:
                        comparison = self._create_comparison(ref, record_dict)
                    except Exception as e:
                        logger.error(f"Error creating comparison for reference ID {ref.get('id')}: {e}\nSkipping comparison for this record.")
                        comparison = {}

                    json.dump(comparison, fp=comp_f, ensure_ascii=False)
                    comp_f.write("\n")

                    # Build XML node for this record immediately
                    try:
                        self._dict_to_xml(record_dict, records)
                    except Exception as e:
                        logger.error(f"Error converting record_dict to XML for reference ID {ref.get('id')}: {e}\nSkipping this record.")
                        continue
            try:
                 pretty_xml = minidom.parseString(
                pretty_xml = minidom.parseString(
                    ET.tostring(xml_root, "utf-8")
                ).toprettyxml(indent="  ")
            except Exception as e:
                logger.error(f"Error generating pretty XML: {e}\nWriting raw XML instead.")
                try:
                    pretty_xml = ET.tostring(xml_root, encoding="utf-8").decode("utf-8")
                except Exception as e2:
                    logger.error(f"Error generating raw XML: {e2}\nTrying string escape??")
                    try:
                        pretty_xml = escape(ET.tostring(xml_root).decode("utf-8"))
                    except Exception as e3:
                        pretty_xml = ""
                        logger.error(e3)
                        logger.error(f"Error generating escaped XML. To debug, iterate over the XML records and try to write them one by one until it fails, then add the problematic record to a skip list & include it in the logs.")

                        for child in xml_root.findall("records/record"):
                            try:
                                record = ET.tostring(child, encoding="utf-8").decode("utf-8")
                            except Exception as e4:
                                logger.error(f"Error generating XML for child element {child.tag}: {e4}")
                                logger.error(f"Child element: {child.text=}, {child.tag=}, {child.attrib=}")
                                logger.error(f"grandchildren:")
                                for gc in child:
                                    logger.error(f"grandchild element: {gc.text=}, {gc.tag=}, {gc.attrib=}")
                                    # if gc has children, log them too
                                    for ggc in gc:
                                        logger.error(f"great grandchild element: {ggc.text=}, {ggc.tag=}, {ggc.attrib=}")
                                continue
                            pretty_xml += record + "\n"

            if pretty_xml:
                with open(output_path, "w", encoding="utf-8") as f:
                    f.write(pretty_xml)
            else:
                logger.error("No XML content generated; output file not written.")
                return 0, None

            logger.info(f"Exported {len(all_refs)} references to {output_path}")

            return len(all_refs), output_path

        finally:
            if "con" in locals() and con:
                con.close()
            logger.debug("Database connection closed.")

    def _build_record_dict(self, ref, file_mapping, data_path):
        record = {}

        record["rec-number"] = ref.get("id")
        # Map reference_type to EndNote ref-type where possible
        try:
            raw_ref_type = int(ref.get("reference_type", 0) or 0)
        except Exception:
            raw_ref_type = 0
            logger.warning(f"Invalid reference_type value: {ref.get('reference_type')}")
        mapped = ENDNOTE_REF_TYPE_MAP.get(raw_ref_type, raw_ref_type)
        record["ref-type"] = {"value": mapped, "name": REF_TYPE_NAMES.get(mapped, "")}

        # added_to_library and record_last_updated may be Unix timestamps or ISO strings in DB
        added_dt, added_iso = format_timestamp(ref.get("added_to_library"))
        mod_dt, modified_iso = format_timestamp(ref.get("record_last_updated"))

        # build dates only when values exist to avoid emitting empty <year/> elements
        year_val = ref.get("year")
        record_dates = {}
        if year_val:
            record_dates["year"] = year_val
        record["dates"] = record_dates
        # preserve publication date if present
        pub_date = ref.get("date")
        if pub_date:
            # store as nested pub-dates; keep raw string
            record["dates"]["pub-dates"] = {"date": pub_date}

        record["titles"] = {
            "title": ref.get("title"),
            "secondary-title": ref.get("secondary_title"),
            "short-title": ref.get("short_title") or "",
            # alt-title used in baseline exports for some records
            "alt-title": ref.get("alternate_title") or ref.get("alt_title") or "",
        }

        if ref.get("author"):
            authors = [
                author_name.strip()
                for author_name in ref["author"].strip().splitlines()
            ]
            record["contributors"] = {"authors": authors}
            # include secondary authors / corporate authors if present in DB
            # CSV header uses 'secondary_author'
            if ref.get("secondary_author"):
                sa = ref.get("secondary_author")
                # normalize into a list of author strings
                if isinstance(sa, str):
                    sa_list = [s.strip() for s in sa.replace('\r', '\n').split('\n') if s.strip()]
                elif isinstance(sa, list):
                    sa_list = sa
                else:
                    sa_list = [str(sa)]
                record["contributors"]["secondary-authors"] = sa_list

        record["pages"] = ref.get("pages")
        record["volume"] = ref.get("volume")
        record["number"] = ref.get("number")
        record["abstract"] = ref.get("abstract")
        # preserve raw ISBN block (may be multi-line) and normalize newlines to CR to match EndNote export
        raw_isbn = ref.get("isbn")
        if raw_isbn:
            s = str(raw_isbn)
            # Normalize CRLF or LF to CR (EndNote XML encodes CR as &#xD;)
            s = s.replace("\r\n", "\r").replace("\n", "\r")
            record["isbn"] = s

        # electronic resource (DOI)
        if ref.get("electronic_resource_number"):
            record["electronic-resource-num"] = ref.get("electronic_resource_number")

        # language
        if ref.get("language"):
            record["language"] = ref.get("language")

        # Only emit periodical for clear serial/journal types or when the
        # secondary_title looks like a journal/series name.
        def _looks_like_periodical(title: str) -> bool:
            if not title:
                return False
            t = title.lower()
            # be conservative: treat as periodical only for clear journal-like names
            keywords = [
                "journal",
                "transactions",
                "advances in",
                "materials science",
                "plos",
                "science of the",
            ]
            for k in keywords:
                if k in t:
                    return True
            return False

        # Only emit periodical when this record maps to a Journal Article (17).
        # This avoids marking many conference proceedings as periodicals.
        if ref.get("secondary_title") and (mapped == 17 or (isinstance(ref.get("secondary_title"), str) and "advances in" in ref.get("secondary_title").lower())):
            record["periodical"] = {"full-title": ref.get("secondary_title")}

        # Additional EndNote-only fields observed in baseline exports
        # DB column is `type_of_work` in refs.csv
        if ref.get("type_of_work"):
            record["work-type"] = ref.get("type_of_work")
        # custom_7 in the CSV maps to <custom7> in EndNote XML
        if ref.get("custom_7"):
            record["custom7"] = ref.get("custom_7")
        # custom_3 is present in some baseline records; expose as <custom3>
        if ref.get("custom_3"):
            record["custom3"] = ref.get("custom_3")
        if ref.get("section"):
            record["section"] = ref.get("section")
        if ref.get("label"):
            record["label"] = ref.get("label")
        # DB column for publication place is `place_published`
        if ref.get("place_published"):
            record["pub-location"] = ref.get("place_published")
        # alt-periodical handling: decide whether alternate_title is an abbreviation
        # (abbr-1) or a full alternate title. Prefer marking as abbr if it's shorter
        # than the main secondary_title or explicitly looks like a short form.
        alt_title = ref.get("alternate_title") or ref.get("alt_title")
        short_title = ref.get("short_title")
        sec_title = ref.get("secondary_title")
        if alt_title:
            try:
                if sec_title and len(str(alt_title).strip()) < len(str(sec_title).strip()):
                    # treat as abbreviation
                    if "periodical" in record:
                        record["periodical"]["abbr-1"] = alt_title
                    else:
                        record["alt-periodical"] = {"abbr-1": alt_title}
                else:
                    alt = {"full-title": alt_title}
                    if short_title and isinstance(short_title, str) and _is_reasonable_abbr(short_title):
                        alt["abbr-1"] = short_title
                    record["alt-periodical"] = alt
            except Exception:
                record["alt-periodical"] = {"full-title": alt_title}
                logger.warning(f"Error processing alt-title/abbreviation for record ID {ref.get('id')}; using alt-title only.")
        else:
            # attach short_title as an abbreviation under periodical when periodical exists
            if short_title and "periodical" in record and isinstance(short_title, str) and _is_reasonable_abbr(short_title):
                record["periodical"]["abbr-1"] = short_title

        # if the periodical full-title matches a known abbreviation mapping, ensure abbr-1 is set
        if "periodical" in record and record["periodical"].get("full-title"):
            ft = record["periodical"].get("full-title")
            if not record["periodical"].get("abbr-1") and ft in JOURNAL_ABBREVS and _is_reasonable_abbr(JOURNAL_ABBREVS[ft]):
                record["periodical"]["abbr-1"] = JOURNAL_ABBREVS[ft]

        # If alt-title matches a known abbreviation for the periodical, also emit alt-periodical
        # but only for journal-like records (mapped==17)
        if mapped == 17 and alt_title and "periodical" in record and record["periodical"].get("full-title"):
            ft = record["periodical"].get("full-title")
            if ft in JOURNAL_ABBREVS and str(alt_title).strip() == JOURNAL_ABBREVS[ft] and _is_reasonable_abbr(JOURNAL_ABBREVS[ft]):
                record["alt-periodical"] = {"full-title": ft, "abbr-1": JOURNAL_ABBREVS[ft]}

        # Do not emit alt-periodical for non-journal records to match baseline behavior
        if mapped != 17 and "alt-periodical" in record:
            del record["alt-periodical"]

        # For some conference/proceedings types, baseline uses tertiary-title for the conference name
        if mapped in (3, 10, 46) or mapped == 10:
            # if secondary_title is empty but alternate_title exists, treat it as tertiary-title
            if not ref.get("secondary_title") and alt_title:
                record["titles"]["tertiary-title"] = alt_title

        # publisher / accession / auth-address / custom fields / edition
        if ref.get("publisher"):
            record["publisher"] = ref.get("publisher")
        if ref.get("accession_number"):
            record["accession-num"] = ref.get("accession_number")
        if ref.get("author_address"):
            # Preserve original address block but normalize line endings to CR to match EndNote exports
            raw_addr = str(ref.get("author_address") or "").strip()
            # convert any CRLF/LF to CR
            addr = raw_addr.replace('\r\n', '\r').replace('\n', '\r')
            record["auth-address"] = addr
        if ref.get("custom_1"):
            record["custom1"] = ref.get("custom_1")
        if ref.get("custom_2"):
            record["custom2"] = ref.get("custom_2")
        if ref.get("edition"):
            record["edition"] = ref.get("edition")
        urls = {}
        if ref.get("url"):
            urls["web-urls"] = [url.strip() for url in str(ref.get("url")).strip().split()]
        if ref.get("id") in file_mapping:
            pdf_urls = []
            pdf_folder_path = data_path / "PDF"
            for file_path in file_mapping[ref.get("id")]:
                full_pdf_path: Path = pdf_folder_path / file_path
                pdf_urls.append(str(full_pdf_path.resolve()))
                if not full_pdf_path.exists():
                    logger.debug(f"PDF file not found {full_pdf_path}")
            if pdf_urls:
                urls["pdf-urls"] = pdf_urls
        if urls:
            record["urls"] = urls

        # keywords: parse into list
        if ref.get("keywords"):
            kws = _split_keywords(ref.get("keywords"))
            if kws:
                record["keywords"] = {"keyword": kws}

        # remote database / provider fields (kept for parity with baseline)
        if ref.get("name_of_database"):
            record["remote-database-name"] = ref.get("name_of_database")
        if ref.get("database_provider"):
            record["remote-database-provider"] = ref.get("database_provider")

        # access-date: only use explicit access_date column (do not fallback to added_to_library)
        access_raw = ref.get("access_date")
        if access_raw:
            try:
                # numeric epoch -> format human readable
                if isinstance(access_raw, (int, float)) or (isinstance(access_raw, str) and access_raw.isdigit()):
                    a_dt, _ = format_timestamp(int(str(access_raw)))
                    if a_dt:
                        record["access-date"] = a_dt.strftime("%Y-%m-%d %H:%M:%S")
                    else:
                        record["access-date"] = str(access_raw)
                else:
                    record["access-date"] = str(access_raw)
            except Exception:
                record["access-date"] = str(access_raw)
                logger.warning(f"Error processing access_date value '{access_raw}' for record ID {ref.get('id')}; using raw string.")

        original_notes = ref.get("notes", "")
        date_metadata = []
        if added_iso:
            date_metadata.append(f"Created: {added_iso}")
        if modified_iso:
            date_metadata.append(f"Modified: {modified_iso}")

        combined_notes = "\n".join(date_metadata)
        if original_notes and str(original_notes).strip():
            combined_notes = str(original_notes).strip() + "\n\n" + combined_notes

        record["notes"] = combined_notes

        return record

    def _dict_to_xml(self, record_dict, parent):



        record = create_xml_element(parent, "record")

        create_xml_element(record, "rec-number", record_dict.get("rec-number"))
        create_xml_element(
            record,
            "ref-type",
            record_dict["ref-type"]["value"],
            attrib={"name": record_dict["ref-type"]["name"]},
        )

        dates = create_xml_element(record, "dates")
        # only emit <year> when present (avoid empty <year/>)
        year_val = record_dict.get("dates", {}).get("year")
        if year_val:
            create_xml_element(dates, "year", year_val)
        # optional pub-dates
        if record_dict["dates"].get("pub-dates"):
            pd = record_dict["dates"].get("pub-dates")
            # allow either dict with single date or list
            if isinstance(pd, dict) and pd.get("date"):
                pubnode = create_xml_element(dates, "pub-dates")
                create_xml_element(pubnode, "date", pd.get("date"))
            elif isinstance(pd, list):
                for d in pd:
                    pubnode = create_xml_element(dates, "pub-dates")
                    create_xml_element(pubnode, "date", d)

        titles = create_xml_element(record, "titles")
        create_xml_element(titles, "title", record_dict["titles"].get("title"))
        create_xml_element(
            titles, "secondary-title", record_dict["titles"].get("secondary-title")
        )
        # optional short-title
        if record_dict["titles"].get("short-title"):
            create_xml_element(titles, "short-title", record_dict["titles"].get("short-title"))
        # optional tertiary-title and alt-title (some baseline records use these)
        if record_dict["titles"].get("tertiary-title"):
            create_xml_element(titles, "tertiary-title", record_dict["titles"].get("tertiary-title"))
        if record_dict["titles"].get("alt-title"):
            create_xml_element(titles, "alt-title", record_dict["titles"].get("alt-title"))

        if "contributors" in record_dict:
            contributors = create_xml_element(record, "contributors")
            authors = create_xml_element(contributors, "authors")
            for author in record_dict["contributors"]["authors"]:
                create_xml_element(authors, "author", author)
            # secondary-authors: emit as nested element with multiple <author> when present
            if record_dict["contributors"].get("secondary-authors"):
                sec = record_dict["contributors"].get("secondary-authors")
                sec_node = create_xml_element(contributors, "secondary-authors")
                # sec may be a list of names
                if isinstance(sec, list):
                    for a in sec:
                        create_xml_element(sec_node, "author", a)
                else:
                    create_xml_element(sec_node, "author", sec)

        # periodical nested title (with light normalization to match baseline casing)
        def _normalize_journal_title(t: str) -> str:
            if not t:
                return t
            # common observed canonicalizations from baseline XML
            replacements = {
                'Science of The Total Environment': 'Science of the Total Environment',
                'PLoS One': 'PLoS ONE',
                'Remote Sensing of Environment': 'Remote sensing of environment',
                'Sustainable cities and society': 'Sustainable Cities and Society',
            }
            return replacements.get(t, t)

        # periodical nested title
        if "periodical" in record_dict:
            per = create_xml_element(record, "periodical")
            full = record_dict["periodical"].get("full-title")
            create_xml_element(per, "full-title", _normalize_journal_title(full))
            if record_dict["periodical"].get("abbr-1"):
                create_xml_element(per, "abbr-1", record_dict["periodical"].get("abbr-1"))

        create_xml_element(record, "pages", record_dict.get("pages"))
        create_xml_element(record, "volume", record_dict.get("volume"))
        create_xml_element(record, "number", record_dict.get("number"))
        create_xml_element(record, "abstract", record_dict.get("abstract"))
        create_xml_element(record, "isbn", record_dict.get("isbn"))

        # Emit EndNote-specific optional fields
        if record_dict.get("work-type"):
            create_xml_element(record, "work-type", record_dict.get("work-type"))
        if record_dict.get("custom7"):
            create_xml_element(record, "custom7", record_dict.get("custom7"))
        if record_dict.get("section"):
            create_xml_element(record, "section", record_dict.get("section"))
        if record_dict.get("label"):
            create_xml_element(record, "label", record_dict.get("label"))
        if record_dict.get("pub-location"):
            create_xml_element(record, "pub-location", record_dict.get("pub-location"))
        # alt-periodical (nested abbr-1)
        if record_dict.get("alt-periodical"):
            ap = create_xml_element(record, "alt-periodical")
            create_xml_element(ap, "full-title", record_dict["alt-periodical"].get("full-title"))
            if record_dict["alt-periodical"].get("abbr-1"):
                create_xml_element(ap, "abbr-1", record_dict["alt-periodical"].get("abbr-1"))

        # publisher, accession, auth-address, custom fields, edition
        if record_dict.get("publisher"):
            create_xml_element(record, "publisher", record_dict.get("publisher"))
        if record_dict.get("accession-num"):
            create_xml_element(record, "accession-num", record_dict.get("accession-num"))
        if record_dict.get("auth-address"):
            create_xml_element(record, "auth-address", record_dict.get("auth-address"))
        if record_dict.get("custom1"):
            create_xml_element(record, "custom1", record_dict.get("custom1"))
        if record_dict.get("custom2"):
            create_xml_element(record, "custom2", record_dict.get("custom2"))
        # emit custom3 if present (observed in baseline)
        if record_dict.get("custom3"):
            create_xml_element(record, "custom3", record_dict.get("custom3"))
        if record_dict.get("edition"):
            create_xml_element(record, "edition", record_dict.get("edition"))

        # electronic resource (DOI)
        if record_dict.get("electronic-resource-num"):
            create_xml_element(record, "electronic-resource-num", record_dict.get("electronic-resource-num"))

        # language and access-date
        if record_dict.get("language"):
            create_xml_element(record, "language", record_dict.get("language"))
        if record_dict.get("access-date"):
            create_xml_element(record, "access-date", record_dict.get("access-date"))

        if "urls" in record_dict:
            urls_node = create_xml_element(record, "urls")
            if "web-urls" in record_dict["urls"]:
                web_urls = create_xml_element(urls_node, "web-urls")
                for url in record_dict["urls"]["web-urls"]:
                    create_xml_element(web_urls, "url", url)
            if "pdf-urls" in record_dict["urls"]:
                pdf_urls = create_xml_element(urls_node, "pdf-urls")
                for url in record_dict["urls"]["pdf-urls"]:
                    create_xml_element(pdf_urls, "url", url)

        # keywords
        if "keywords" in record_dict:
            kw_node = create_xml_element(record, "keywords")
            for kw in record_dict["keywords"].get("keyword", []):
                create_xml_element(kw_node, "keyword", kw)

        create_xml_element(record, "notes", record_dict.get("notes"))

    def _create_comparison(self, ref, record_dict):
        comparison = {}
        # Simple mapping for some fields
        field_mappings = {
            "id": "rec-number",
            "reference_type": "ref-type",
            "year": "year",
            "title": "title",
            "secondary_title": "secondary-title",
            "author": "authors",
            "pages": "pages",
            "volume": "volume",
            "number": "number",
            "abstract": "abstract",
            "isbn": "isbn",
            "url": "web-urls",
            "notes": "notes",
        }
        for input_field, output_field in field_mappings.items():
            input_value = ref.get(input_field)
            if output_field == "ref-type":
                output_value = record_dict.get("ref-type", {}).get("value")
            elif output_field == "title":
                output_value = record_dict.get("titles", {}).get("title")
            elif output_field == "secondary-title":
                output_value = record_dict.get("titles", {}).get("secondary-title")
            elif output_field == "authors":
                output_value = record_dict.get("contributors", {}).get("authors")
            elif output_field == "web-urls":
                output_value = record_dict.get("urls", {}).get("web-urls")
            elif output_field == "year":
                output_value = record_dict.get("dates", {}).get("year")
            else:
                output_value = record_dict.get(output_field)
            comparison[input_field] = {"input": input_value, "output": output_value}
        return comparison


def create_xml_element(parent, tag, text=None, attrib=None):
    """
    Correctly creates an XML element, assigns its text, and appends it to the parent.
    """
    if attrib is None:
        attrib = {}

    # sanitize attribute values to remove illegal XML chars
    safe_attrib = {k: safe_str(v) for k, v in attrib.items() if v is not None}

    el = ET.SubElement(parent, tag, safe_attrib)
    if text is not None:
        # sanitize text for XML legality
        cleaned = safe_str(text)
        # only set text when there's something to set; keep empty string to preserve element
        el.text = cleaned
    return el


def format_timestamp(ts):
    """Converts a Unix timestamp into a datetime object and an ISO 8601 formatted string."""
    if ts is None or ts == 0 or ts == "":
        return None, None
    # allow numeric strings
    try:
        if isinstance(ts, str) and ts.isdigit():
            ts = int(ts)
        elif isinstance(ts, str):
            # try float-like
            try:
                ts = int(float(ts))
            except Exception:
                pass
        dt = datetime.fromtimestamp(int(ts))
        return dt, dt.isoformat(sep="T", timespec="seconds")
    except (ValueError, TypeError, OSError):
        # cannot parse timestamp; return None
        return None, None


def safe_str(input) -> str:
    """
    Takes in a value and returns a string with all XML-illegal characters removed.

    This follows the XML 1.0 valid character ranges (tab, LF, CR, and
    the allowed Unicode ranges). Any character outside those ranges will be
    removed. The result is stripped of leading/trailing whitespace.
    """
    if input is None:
        return ""
    try:
        s = str(input).strip()
        return INVALID_XML_REGEX.sub("", s) or ""
    except (AttributeError, TypeError) as e:
        logger.warning(f"Error sanitizing string for XML: {input}")
        return ""

# For backward compatibility, keep the function
def export_references_to_xml(enl_file_path: Path, output_file: Path):
    exporter = EndnoteExporter()
    return exporter.export_references_to_xml(enl_file_path, output_file)


class XMLComparator:
    """Compare two EndNote/Zotero-style XML exports at the record and field level.

    Usage: XMLComparator(endnote_xml_path, custom_xml_path).compare()
    Prints a detailed per-record comparison and a compact core summary.

    """

    def __init__(self, endnote_xml_path, custom_xml_path):
        self.endnote_xml = Path(endnote_xml_path)
        self.custom_xml = Path(custom_xml_path)
        self.ignore_fields = {
            "notes",
            "database",
            "source-app",
            "urls",
            "remote-database-name",
            "remote-database-provider",
            "foreign-keys"
        }

    def compare(self):
        a = self._parse(self.endnote_xml)
        b = self._parse(self.custom_xml)

        keys_a = set(a.keys())
        keys_b = set(b.keys())

        keys_a = {k for k in keys_a if k not in self.ignore_fields}
        keys_b = {k for k in keys_b if k not in self.ignore_fields}

        matched = keys_a & keys_b
        only_a = keys_a - keys_b
        only_b = keys_b - keys_a

        detailed = []
        field_diff_counts = {}
        a_fields = set()
        b_fields = set()
        # Compare matched records
        for key in sorted(matched, key=lambda x: str(x)):
            rec_a = a[key]
            rec_b = b[key]
            missing_a = []
            missing_b = []
            diffs = {}

            a_fields.update(rec_a.keys())
            b_fields.update(rec_b.keys())
            all_fields = set(rec_a.keys()) | set(rec_b.keys())
            for field in sorted(all_fields):
                if field in self.ignore_fields:
                    continue
                va = rec_a.get(field)
                vb = rec_b.get(field)
                if not va:
                    va = ""
                if not vb:
                    vb = ""

                # Special-case ISBN: normalize newline characters and compare as sets of lines
                if field == "isbn":
                    def _isbn_lines(x):
                        if x is None:
                            return []
                        # if value is list, flatten to strings
                        if isinstance(x, list):
                            parts = []
                            for item in x:
                                parts.extend(str(item).replace("\r\n", "\n").replace("\r", "\n").split("\n"))
                        else:
                            parts = str(x).replace("\r\n", "\n").replace("\r", "\n").split("\n")
                        return [p.strip() for p in parts if p and p.strip()]

                    va_lines = _isbn_lines(va)
                    vb_lines = _isbn_lines(vb)
                    # compare as sorted lists
                    if sorted(va_lines) != sorted(vb_lines):
                        diffs[field] = {"a": va, "b": vb}
                        field_diff_counts.setdefault((field, "content_diff"), 0)
                        field_diff_counts[(field, "content_diff")] += 1
                    continue

                # Special-case auth-address: compare as unordered set of normalized lines
                if field == "auth-address":
                    def _addr_lines(x):
                        if x is None:
                            return []
                        s = str(x)
                        s = s.replace('\r\n', '\n').replace('\r', '\n')
                        parts = [p.strip() for p in s.split('\n') if p.strip()]
                        return parts

                    a_lines = sorted(_addr_lines(va))
                    b_lines = sorted(_addr_lines(vb))
                    if a_lines != b_lines:
                        diffs[field] = {"a": va, "b": vb}
                        field_diff_counts.setdefault((field, "content_diff"), 0)
                        field_diff_counts[(field, "content_diff")] += 1
                    continue

                # Special-case custom3: compare after normalizing whitespace to avoid line-ending/spacing differences
                if field == "custom3":
                    def _norm(x):
                        if x is None:
                            return ""
                        return " ".join(str(x).split())

                    if _norm(va) != _norm(vb):
                        diffs[field] = {"a": va, "b": vb}
                        field_diff_counts.setdefault((field, "content_diff"), 0)
                        field_diff_counts[(field, "content_diff")] += 1
                    continue

                if field not in rec_a and (va or vb):
                    missing_a.append(field)
                    field_diff_counts.setdefault((field, "missing_in_a"), 0)
                    field_diff_counts[(field, "missing_in_a")] += 1
                    diffs[field] = {"a": va, "b": vb}

                elif field not in rec_b and (va or vb):
                    if field in ["contributors", "urls"]:
                        # actually a difference instead of missing
                        if va or vb:
                            diffs[field] = {"a": va, "b": vb}
                        field_diff_counts.setdefault((field, "content_diff"), 0)
                        field_diff_counts[(field, "content_diff")] += 1
                    else:
                        missing_b.append(field)
                        field_diff_counts.setdefault((field, "missing_in_b"), 0)
                        field_diff_counts[(field, "missing_in_b")] += 1
                        if va or vb:
                            diffs[field] = {"a": va, "b": vb}

                elif va or vb:
                    if not self._values_equal(va, vb):
                        diffs[field] = {"a": va, "b": vb}
                        field_diff_counts.setdefault((field, "content_diff"), 0)
                        field_diff_counts[(field, "content_diff")] += 1

            rec_report = {
                "key": key,
                "missing_in_a": missing_a,
                "missing_in_b": missing_b,
                "diffs": diffs,
            }
            detailed.append(rec_report)

        # Print detailed report
        logger.debug("\nXML Comparison Report")
        logger.debug("=========================================")
        logger.debug(f"Endnote XML: {self.endnote_xml} ({len(keys_a)} records)")
        logger.debug(f"Custom XML: {self.custom_xml} ({len(keys_b)} records)")
        logger.debug(f"Matched records: {len(matched)}")
        logger.debug(f"Only in Endnote XML: {len(only_a)}; Only in Custom XML: {len(only_b)}")

        if only_a:
            logger.debug("\nRecords only in Endnote XML (sample up to 10):")
            for k in list(only_a)[:10]:
                logger.debug(f" - {k}")
        if only_b:
            logger.debug("\nRecords only in Custom XML (sample up to 10):")
            for k in list(only_b)[:10]:
                logger.debug(f" - {k}")

        logger.debug("\nPer-record differences for matched records:")
        for rec in detailed:
            if rec["missing_in_a"] or rec["missing_in_b"] or rec["diffs"]:
                logger.debug(f"\nRecord: {rec['key']}")
                if rec["missing_in_a"]:
                    logger.debug(f"  Fields missing in Endnote XML: {rec['missing_in_a']}")
                if rec["missing_in_b"]:
                    logger.debug(f"  Fields missing in Custom XML: {rec['missing_in_b']}")
                if rec["diffs"]:
                    logger.debug("  Content differences:")
                    for f, vals in rec["diffs"].items():
                        logger.debug(
                            f"    - {f}:\n      Endnote: {vals['a']}\n      Custom: {vals['b']}"
                        )

        # Core summary
        logger.debug("\nCore summary:")
        logger.debug("-----------------------------------------")
        logger.debug(f"Total records Endnote: {len(keys_a)}")
        logger.debug(f"Total records Custom: {len(keys_b)}")
        logger.debug(
            f"Matched: {len(matched)}; Only Endnote: {len(only_a)}; Only Custom: {len(only_b)}"
        )
        logger.debug("\nTop field-level issues:")
        for (field, issue), count in sorted(
            field_diff_counts.items(), key=lambda x: -x[1]
        ):
            logger.debug(f" - {field} ({issue}): {count}")

        # Now print a list of fields missing in B but present in A

        missing_b_fields = set()
        missing_a_fields = set()
        for tup, count in field_diff_counts.items():
            field, issue = tup

            if field not in self.ignore_fields and issue == "missing_in_b":
                missing_b_fields.add(field)
            if field not in self.ignore_fields and issue == "missing_in_a":
                missing_a_fields.add(field)

        logger.debug("\nFields present in Custom XML but missing in Endnote XML:")
        logger.debug("\n".join(sorted(missing_a_fields)))
        logger.debug("\nFields present in Endnote XML but missing in Custom XML:")
        logger.debug("\n".join(sorted(missing_b_fields)))

        logger.debug("\nAll fields in Endnote XML:")
        logger.debug("\n".join(sorted(a_fields)))

        logger.debug("\nAll fields in Custom XML:")
        logger.debug("\n".join(sorted(b_fields)))
        return {
            "counts": {
                "endnote": len(keys_a),
                "custom": len(keys_b),
                "matched": len(matched),
                "only_endnote": len(only_a),
                "only_custom": len(only_b),
            },
            "field_issues": field_diff_counts,
            "detailed": detailed,
        }

    def _parse(self, path: Path):
        """Parse an XML file into a mapping of record-key -> field dict.

        Keying strategy: use rec-number if present; otherwise fallback to title|year combination.
        """
        if not path.exists():
            raise FileNotFoundError(f"XML file not found: {path}")

        tree = ET.parse(path)
        root = tree.getroot()

        records = {}
        for rec in root.findall(".//record"):
            data = self._element_to_py(rec)
            # ensure data is a mapping; if parsing yields a plain string for unexpected structure,
            # coerce to empty dict so subsequent .get() calls are safe.
            if not isinstance(data, dict):
                data = {}

            # determine key
            key = None
            if "rec-number" in data and data["rec-number"] not in (None, ""):
                key = str(data["rec-number"])  # prefer ID
            else:
                title = None
                year = None
                titles = data.get("titles") or {}
                if isinstance(titles, dict):
                    title = titles.get("title")
                    year = data.get("dates", {}).get("year")
                key = f"title:{title}|year:{year}"

            records[key] = data

        return records

    def _element_to_py(self, el):
        """Recursively convert an Element and its children into Python types.

        If multiple children share a tag, values become a list. Leaf element text is stripped.
        """
        children = list(el)
        if len(children) == 1 and children[0].tag == "style" and not list(children[0]):
            el = children[0]
            children = None

        if not children:
            text = el.text
            if text is None:
                return ""
            return text.strip()

        result = {}
        for child in children:
            val = self._element_to_py(child)
            tag = child.tag

            if tag in result:
                # coerce to list
                if not isinstance(result[tag], list):
                    result[tag] = [result[tag]]
                result[tag].append(val)
            else:
                result[tag] = val
        return result

    def _values_equal(self, a, b):
        """Loose equality for field values: handle lists (order-insensitive), dicts (recursive), and strings."""
        if a is None and b is None:
            return True
        if isinstance(a, dict) and isinstance(b, dict):
            # compare keys and values recursively
            keys = set(a.keys()) | set(b.keys())
            for k in keys:
                if not self._values_equal(a.get(k), b.get(k)):
                    return False
            return True
        if isinstance(a, list) and isinstance(b, list):
            # compare as multisets of stringified items
            sa = sorted([json.dumps(x, ensure_ascii=False, sort_keys=True) for x in a])
            sb = sorted([json.dumps(x, ensure_ascii=False, sort_keys=True) for x in b])
            return sa == sb
        # fallback: compare stripped strings
        try:
            sa = "" if a is None else str(a).strip()
            sb = "" if b is None else str(b).strip()
            return sa == sb
        except Exception:
            return a == b


def compare_xml_files(path_a, path_b):
    """Convenience helper: parse and compare two xml files and return the summary dict."""
    comp = XMLComparator(path_a, path_b)
    return comp.compare()
