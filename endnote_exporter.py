from pathlib import Path
from collections import defaultdict
import sqlite3
import xml.etree.ElementTree as ET
from xml.dom import minidom
from datetime import datetime
from loguru import logger
import sys
import json

# Configure logging sinks and formats
# Ensure a logs folder exists
_LOG_DIR = Path(__file__).parent / "logs"
_LOG_DIR.mkdir(parents=True, exist_ok=True)

# Remove default handler and add custom ones
logger.remove()

# Console sink with colorized, compact formatting
console_format = (
    "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
    "<level>{level}</level> | "
    "<cyan>{extra}</cyan> "
    "- {message}\n{exception}"
)
logger.add(sys.stderr, format=console_format, colorize=True, level="INFO")

# File sink for regular logs (rotates daily, keeps 7 days)
logfile = _LOG_DIR / "endnote_exporter.log"
logger.add(
    str(logfile),
    rotation="00:00",
    retention="7 days",
    encoding="utf-8",
    level="DEBUG",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {extra} - {message}\n{exception}",
)

# JSONL sink for comparisons only. We use serialize=True so records are JSON.
comparisons_file = _LOG_DIR / "comparisons.jsonl"


class EndnoteExporter:
    @logger.catch
    def export_references_to_xml(self, enl_file_path: Path, output_file: Path):
        """Main method to perform the database-to-XML conversion.

        Takes the full path to the .enl file as input.
        """
        return self._export(enl_file_path, output_file)

    @logger.catch
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

            xml_root = ET.Element("xml")
            records = create_xml_element(xml_root, "records")

            # Open the comparisons_file once before the loop
            with open(comparisons_file, "a", encoding="utf-8") as comp_f:
                for row in all_refs:
                    ref = dict(zip(col_names, row))
                    with logger.contextualize(
                        ref_id=ref.get("id"), title=ref.get("title")
                    ):
                        # Bind a short context id for nicer log output

                        record_dict = self._build_record_dict(
                            ref, file_mapping, data_path
                        )
                        comparison = self._create_comparison(ref, record_dict)

                        json.dump(comparison, fp=comp_f, ensure_ascii=False)
                        comp_f.write("\n")

            # Now build XML from dict
            self._dict_to_xml(record_dict, records)

            pretty_xml = minidom.parseString(
                ET.tostring(xml_root, "utf-8")
            ).toprettyxml(indent="  ")
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(pretty_xml)

            logger.info(f"Exported {len(all_refs)} references to {output_path}")

            return len(all_refs), output_path

        finally:
            if "con" in locals() and con:
                con.close()

    @logger.catch
    def _build_record_dict(self, ref, file_mapping, data_path):
        record = {}

        record["rec-number"] = ref.get("id")
        record["ref-type"] = {
            "value": ref.get("reference_type", 0),
            "name": "Journal Article",
        }

        added_dt, added_iso = format_timestamp(ref.get("added_to_library"))
        modified_dt, modified_iso = format_timestamp(ref.get("record_last_updated"))

        record["dates"] = {"year": ref.get("year")}

        record["titles"] = {
            "title": ref.get("title"),
            "secondary-title": ref.get("secondary_title"),
        }

        if ref.get("author"):
            authors = [
                author_name.strip()
                for author_name in ref["author"].strip().splitlines()
            ]
            record["contributors"] = {"authors": authors}
        else:
            logger.warning(f"No author found for reference {ref.get('id')}")

        record["pages"] = ref.get("pages")
        record["volume"] = ref.get("volume")
        record["number"] = ref.get("number")
        record["abstract"] = ref.get("abstract")
        record["isbn"] = ref.get("isbn")

        urls = {}
        if ref.get("url"):
            urls["web-urls"] = [
                url.strip() for url in str(ref.get("url")).strip().split()
            ]
        if ref.get("id") in file_mapping:
            pdf_urls = []
            pdf_folder_path = data_path / "PDF"
            for file_path in file_mapping[ref.get("id")]:
                full_pdf_path: Path = pdf_folder_path / file_path
                pdf_urls.append(str(full_pdf_path.resolve()))
                if not full_pdf_path.exists():
                    logger.warning(f"PDF file not found {full_pdf_path}")
            if pdf_urls:
                urls["pdf-urls"] = pdf_urls
        if urls:
            record["urls"] = urls

        original_notes = ref.get("notes", "")
        date_metadata = []
        if added_iso:
            date_metadata.append(f"Created: {added_iso}")
        if modified_iso:
            date_metadata.append(f"Modified: {modified_iso}")

        combined_notes = "\n".join(date_metadata)
        if original_notes.strip():
            combined_notes = original_notes.strip() + "\n\n" + combined_notes

        record["notes"] = combined_notes

        return record

    @logger.catch
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
        create_xml_element(dates, "year", record_dict["dates"].get("year"))

        titles = create_xml_element(record, "titles")
        create_xml_element(titles, "title", record_dict["titles"].get("title"))
        create_xml_element(
            titles, "secondary-title", record_dict["titles"].get("secondary-title")
        )

        if "contributors" in record_dict:
            contributors = create_xml_element(record, "contributors")
            authors = create_xml_element(contributors, "authors")
            for author in record_dict["contributors"]["authors"]:
                create_xml_element(authors, "author", author)

        create_xml_element(record, "pages", record_dict.get("pages"))
        create_xml_element(record, "volume", record_dict.get("volume"))
        create_xml_element(record, "number", record_dict.get("number"))
        create_xml_element(record, "abstract", record_dict.get("abstract"))
        create_xml_element(record, "isbn", record_dict.get("isbn"))

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

        create_xml_element(record, "notes", record_dict.get("notes"))

    @logger.catch
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
    el = ET.SubElement(parent, tag, attrib)
    if text is not None:
        el.text = str(text)
    return el


def format_timestamp(ts):
    """Converts a Unix timestamp into a datetime object and an ISO 8601 formatted string."""
    if not ts or ts == 0:
        return None, None
    try:
        dt = datetime.fromtimestamp(ts)
        return dt, dt.isoformat(sep="T", timespec="seconds")
    except (ValueError, TypeError):
        return None, None


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
        print("\nXML Comparison Report")
        print("=========================================")
        print(f"Endnote XML: {self.endnote_xml} ({len(keys_a)} records)")
        print(f"Custom XML: {self.custom_xml} ({len(keys_b)} records)")
        print(f"Matched records: {len(matched)}")
        print(f"Only in Endnote XML: {len(only_a)}; Only in Custom XML: {len(only_b)}")

        if only_a:
            print("\nRecords only in Endnote XML (sample up to 10):")
            for k in list(only_a)[:10]:
                print(f" - {k}")
        if only_b:
            print("\nRecords only in Custom XML (sample up to 10):")
            for k in list(only_b)[:10]:
                print(f" - {k}")

        print("\nPer-record differences for matched records:")
        for rec in detailed:
            if rec["missing_in_a"] or rec["missing_in_b"] or rec["diffs"]:
                print(f"\nRecord: {rec['key']}")
                if rec["missing_in_a"]:
                    print(f"  Fields missing in Endnote XML: {rec['missing_in_a']}")
                if rec["missing_in_b"]:
                    print(f"  Fields missing in Custom XML: {rec['missing_in_b']}")
                if rec["diffs"]:
                    print("  Content differences:")
                    for f, vals in rec["diffs"].items():
                        print(
                            f"    - {f}:\n      Endnote: {vals['a']}\n      Custom: {vals['b']}"
                        )

        # Core summary
        print("\nCore summary:")
        print("-----------------------------------------")
        print(f"Total records Endnote: {len(keys_a)}")
        print(f"Total records Custom: {len(keys_b)}")
        print(
            f"Matched: {len(matched)}; Only Endnote: {len(only_a)}; Only Custom: {len(only_b)}"
        )
        print("\nTop field-level issues:")
        for (field, issue), count in sorted(
            field_diff_counts.items(), key=lambda x: -x[1]
        ):
            print(f" - {field} ({issue}): {count}")

        # Now print a list of fields missing in B but present in A

        missing_b_fields = set()
        missing_a_fields = set()
        for tup, count in field_diff_counts.items():
            field, issue = tup

            if field not in self.ignore_fields and issue == "missing_in_b":
                missing_b_fields.add(field)
            if field not in self.ignore_fields and issue == "missing_in_a":
                missing_a_fields.add(field)

        print("\nFields present in Custom XML but missing in Endnote XML:")
        print("\n".join(sorted(missing_a_fields)))
        print("\nFields present in Endnote XML but missing in Custom XML:")
        print("\n".join(sorted(missing_b_fields)))

        print("\nAll fields in Endnote XML:")
        print("\n".join(sorted(a_fields)))

        print("\nAll fields in Custom XML:")
        print("\n".join(sorted(b_fields)))
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
