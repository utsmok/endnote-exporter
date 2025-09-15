# filename: endnote_exporter_gui.py

import sqlite3
import tkinter as tk
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from tkinter import filedialog, messagebox
from typing import Any
from xml.dom import minidom


# --- Corrected Helper Function ---
def create_xml_element(parent, tag, text=None, attrib={}) -> ET.Element:
    """
    Correctly creates an XML element, assigns its text, and appends it to the parent.
    """
    el = ET.SubElement(parent, tag, attrib)
    # Ensure text is not None before assigning, and convert to string
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


def fetch_data_from_table(
    cursor: sqlite3.Cursor,
    table: str,
    cols: list | None = None,
    where: str | None = None,
):
    """
    Fetches data from a specified table with optional columns and WHERE clause.
    Returns a list of dictionaries mapping column names to their values.
    """
    col_str = ", ".join(cols) if cols else "*"
    query = f"SELECT {col_str} FROM {table}"
    if where:
        query += f" WHERE {where}"
    cursor.execute(query)
    rows = cursor.fetchall()
    col_names: list[str | Any] = [description[0] for description in cursor.description]
    return rows, col_names


def export_references_to_xml(enl_file_path: Path, output_file: Path):
    """
    Main function to perform the database-to-XML conversion.
    Takes the full path to the .enl file as input.
    """
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
        raise FileNotFoundError(
            f"Database file not found at '{db_path}'. Make sure the .Data folder exists."
        )

    try:
        con = sqlite3.connect(db_path)
        cur = con.cursor()
    except sqlite3.Error as e:
        raise ConnectionError(f"Failed to connect to the database: {e}")
    try:
        all_refs, col_names = fetch_data_from_table(
            cur, "refs", where="trash_state = 0"
        )

        all_files, filecolnames = fetch_data_from_table(
            cur, "file_res", cols=["refs_id", "file_path"]
        )

        file_mapping = defaultdict(list)
        for ref_id, path in all_files:
            file_mapping[ref_id].append(path)

        xml_root = ET.Element("xml")
        records: ET.Element[str] = create_xml_element(xml_root, "records")

        for row in all_refs:
            try:
                ref = dict(zip(col_names, row))

                record = create_xml_element(records, "record")

                create_xml_element(record, "rec-number", ref.get("id"))
                try:
                    create_xml_element(
                        record,
                        "ref-type",
                        ref.get("reference_type", 0),
                        attrib={"name": "Journal Article"},
                    )
                except Exception:
                    print(
                        f"Warning: Invalid reference type for record ID {ref.get('id')}: {ref.get('reference_type')}"
                    )
                    raise ValueError("Invalid reference type")

                added_dt, added_iso = format_timestamp(ref.get("added_to_library"))
                modified_dt, modified_iso = format_timestamp(
                    ref.get("record_last_updated")
                )

                add_dates(record, ref)

                add_titles(record, ref)
                add_contributors(record, ref)
                add_simple_fields(record, ref)
                add_urls(record, ref, file_mapping, data_path)
                add_notes(record, ref, added_iso, modified_iso)
            except Exception:
                # Skip this record on error
                print(f"Error processing record ID {ref.get('id')}, skipping.")
                continue

        try:
            pretty_xml = minidom.parseString(
                ET.tostring(xml_root, "utf-8")
            ).toprettyxml(indent="  ")
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(pretty_xml)
        except Exception as e:
            raise IOError(f"Failed to write XML to file: {e}")
        return len(all_refs), output_path

    finally:
        if "con" in locals() and con:
            con.close()


def add_dates(record, ref):
    try:
        dates = create_xml_element(record, "dates")
        create_xml_element(dates, "year", ref.get("year"))
    except Exception:
        print(
            f"Warning: Could not add year for record ID {ref.get('id')}: {ref.get('year')}"
        )


def add_titles(record, ref):
    try:
        titles = create_xml_element(record, "titles")
        create_xml_element(titles, "title", ref.get("title"))
        create_xml_element(titles, "secondary-title", ref.get("secondary_title"))
    except Exception:
        print(
            f"Warning: Could not add titles for record ID {ref.get('id')}: {ref.get('title')}, {ref.get('secondary_title')}"
        )


def add_contributors(record, ref):
    try:
        if ref.get("author"):
            contributors = create_xml_element(record, "contributors")
            authors = create_xml_element(contributors, "authors")
            for author_name in ref["author"].strip().splitlines():
                create_xml_element(authors, "author", author_name.strip())
    except Exception:
        print(
            f"Warning: Could not add authors for record ID {ref.get('id')}: {ref.get('author')}"
        )


def add_simple_fields(record, ref):
    try:
        create_xml_element(record, "pages", ref.get("pages"))
    except Exception:
        print(
            f"Warning: Could not add pages for record ID {ref.get('id')}: {ref.get('pages')}"
        )
    try:
        create_xml_element(record, "volume", ref.get("volume"))
    except Exception:
        print(
            f"Warning: Could not add volume for record ID {ref.get('id')}: {ref.get('volume')}"
        )
    try:
        create_xml_element(record, "number", ref.get("number"))
    except Exception:
        print(
            f"Warning: Could not add number for record ID {ref.get('id')}: {ref.get('number')}"
        )
    try:
        create_xml_element(record, "abstract", ref.get("abstract"))
    except Exception:
        print(
            f"Warning: Could not add abstract for record ID {ref.get('id')}: {ref.get('abstract')}"
        )
    try:
        create_xml_element(record, "isbn", ref.get("isbn"))
    except Exception:
        print(
            f"Warning: Could not add isbn for record ID {ref.get('id')}: {ref.get('isbn')}"
        )


def add_urls(record, ref, file_mapping, data_path):
    try:
        urls_node = None
        if ref.get("url") or (ref.get("id") in file_mapping):
            urls_node = create_xml_element(record, "urls")

        if ref.get("url") and urls_node is not None:
            web_urls = create_xml_element(urls_node, "web-urls")
            for url in str(ref.get("url")).strip().split():
                create_xml_element(web_urls, "url", url.strip())

        if ref.get("id") in file_mapping and urls_node is not None:
            pdf_urls = create_xml_element(urls_node, "pdf-urls")
            pdf_folder_path = data_path / "PDF"
            for file_path in file_mapping[ref.get("id")]:
                full_pdf_path = pdf_folder_path / file_path
                if full_pdf_path.exists():
                    create_xml_element(pdf_urls, "url", f"{full_pdf_path.resolve()}")
    except Exception:
        print(
            f"Warning: Could not add URLs for record ID {ref.get('id')}: {ref.get('url')}, files: {file_mapping.get(ref.get('id'))}"
        )


def add_notes(record, ref, added_iso, modified_iso):
    try:
        original_notes = ref.get("notes", "")
        date_metadata = []
        if added_iso:
            date_metadata.append(f"Created: {added_iso}")
        if modified_iso:
            date_metadata.append(f"Modified: {modified_iso}")

        combined_notes = "\n".join(date_metadata)
        if original_notes.strip():
            combined_notes = original_notes.strip() + "\n\n" + combined_notes

        create_xml_element(record, "notes", combined_notes)
    except Exception:
        print(
            f"Warning: Could not add notes for record ID {ref.get('id')}: {ref.get('notes')}\n or dates: {added_iso}, {modified_iso}"
        )


# --- GUI Application Logic ---


class ExporterApp:
    def __init__(self, root):
        self.root = root
        self.root.title("EndNote to Zotero Exporter")
        self.enl_file = None

        self.label = tk.Label(
            root,
            text="Select your EndNote Library file (.enl) to begin.",
            padx=20,
            pady=20,
        )
        self.label.pack()

        self.select_button = tk.Button(
            root, text="Select .enl File", command=self.select_file
        )
        self.select_button.pack(pady=10)

        self.run_button = tk.Button(
            root, text="Export to XML", command=self.run_export, state=tk.DISABLED
        )
        self.run_button.pack(pady=10)

    def select_file(self):
        # The typical EndNote library location is in the user's Documents folder.
        default_endnote_dir = Path.home() / "Documents" / "EndNote"

        # If the default directory doesn't exist, filedialog will handle it gracefully.
        file_path = filedialog.askopenfilename(
            title="Select EndNote Library",
            initialdir=str(default_endnote_dir)
            if default_endnote_dir.exists()
            else Path.home(),
            filetypes=[("EndNote Library", "*.enl")],
        )
        if file_path:
            self.enl_file = Path(file_path)
            self.label.config(text=f"Selected: {self.enl_file.name}")
            self.run_button.config(state=tk.NORMAL)

    def run_export(self):
        if not self.enl_file:
            messagebox.showerror("Error", "No .enl file selected.")
            return

        default_xml_name = f"{self.enl_file.stem}_zotero_export.xml"

        output_path_str = filedialog.asksaveasfilename(
            title="Save Exported XML As",
            initialdir=str(self.enl_file.parent),  # Default to same folder as library
            initialfile=default_xml_name,
            defaultextension=".xml",
            filetypes=[("XML files", "*.xml"), ("All files", "*.*")],
        )

        # If the user cancels the save dialog, do nothing.
        if not output_path_str:
            return

        output_file = Path(output_path_str)

        try:
            self.run_button.config(state=tk.DISABLED, text="Exporting...")
            self.root.update_idletasks()

            # Pass both the input and output paths to the core function
            count = export_references_to_xml(self.enl_file, output_file)

            messagebox.showinfo(
                "Success!",
                f"Successfully exported {count[0]} references.\n\nFile saved to:\n\n{output_file}",
            )
        except Exception as e:
            messagebox.showerror("Export Failed", f"An error occurred:\n\n{e}")
        finally:
            self.run_button.config(state=tk.NORMAL, text="Export to XML")


if __name__ == "__main__":
    root = tk.Tk()
    app = ExporterApp(root)
    root.geometry("400x200")
    root.mainloop()
