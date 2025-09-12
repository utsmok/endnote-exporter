# filename: endnote_exporter_gui.py

import tkinter as tk
from tkinter import filedialog, messagebox
from pathlib import Path
from collections import defaultdict
import sqlite3
import xml.etree.ElementTree as ET
from xml.dom import minidom
from datetime import datetime

# --- Corrected Helper Function ---
def create_xml_element(parent, tag, text=None, attrib={}):
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
        return dt, dt.isoformat(sep='T', timespec='seconds')
    except (ValueError, TypeError):
        return None, None

# --- Core Export Logic (Using the corrected helper) ---

def export_references_to_xml(enl_file_path: Path, output_file: Path):
    """
    Main function to perform the database-to-XML conversion.
    Takes the full path to the .enl file as input.
    """
    base_path = enl_file_path.parent
    library_name = enl_file_path.stem
    output_path = base_path / f'{library_name}_zotero_export.xml' if output_file is None else output_file
    data_path = base_path / f'{library_name}.Data'
    db_path = data_path / 'sdb' / 'sdb.eni'

    if not db_path.exists():
        raise FileNotFoundError(f"Database file not found at '{db_path}'. Make sure the .Data folder exists.")

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

        xml_root = ET.Element('xml')
        records = create_xml_element(xml_root, 'records')

        for row in all_refs:
            ref = dict(zip(col_names, row))
            record = create_xml_element(records, 'record')

            create_xml_element(record, 'rec-number', ref.get('id'))
            create_xml_element(record, 'ref-type', ref.get('reference_type', 0), attrib={'name': 'Journal Article'})

            added_dt, added_iso = format_timestamp(ref.get('added_to_library'))
            modified_dt, modified_iso = format_timestamp(ref.get('record_last_updated'))

            dates = create_xml_element(record, 'dates')
            create_xml_element(dates, 'year', ref.get('year'))

            titles = create_xml_element(record, 'titles')
            create_xml_element(titles, 'title', ref.get('title'))
            create_xml_element(titles, 'secondary-title', ref.get('secondary_title'))

            if ref.get('author'):
                contributors = create_xml_element(record, 'contributors')
                authors = create_xml_element(contributors, 'authors')
                for author_name in ref['author'].strip().splitlines():
                    create_xml_element(authors, 'author', author_name.strip())

            create_xml_element(record, 'pages', ref.get('pages'))
            create_xml_element(record, 'volume', ref.get('volume'))
            create_xml_element(record, 'number', ref.get('number'))
            create_xml_element(record, 'abstract', ref.get('abstract'))
            create_xml_element(record, 'isbn', ref.get('isbn'))

            urls_node = None
            if ref.get('url') or (ref.get('id') in file_mapping):
                urls_node = create_xml_element(record, 'urls')

            if ref.get('url') and urls_node is not None:
                web_urls = create_xml_element(urls_node, 'web-urls')
                for url in str(ref.get('url')).strip().split():
                    create_xml_element(web_urls, 'url', url.strip())

            if ref.get('id') in file_mapping and urls_node is not None:
                pdf_urls = create_xml_element(urls_node, 'pdf-urls')
                pdf_folder_path = data_path / 'PDF'
                for file_path in file_mapping[ref.get('id')]:
                    full_pdf_path = pdf_folder_path / file_path
                    if full_pdf_path.exists():
                        create_xml_element(pdf_urls, 'url', f"{full_pdf_path.resolve()}")

            original_notes = ref.get('notes', '')
            date_metadata = []
            if added_iso: date_metadata.append(f"Created: {added_iso}")
            if modified_iso: date_metadata.append(f"Modified: {modified_iso}")

            combined_notes = '\n'.join(date_metadata)
            if original_notes.strip():
                combined_notes = original_notes.strip() + '\n\n' + combined_notes

            create_xml_element(record, 'notes', combined_notes)

        pretty_xml = minidom.parseString(ET.tostring(xml_root, 'utf-8')).toprettyxml(indent="  ")
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(pretty_xml)

        return len(all_refs), output_path

    finally:
        if 'con' in locals() and con:
            con.close()

# --- GUI Application Logic (Unchanged) ---

class ExporterApp:
    def __init__(self, root):
        self.root = root
        self.root.title("EndNote to Zotero Exporter")
        self.enl_file = None

        self.label = tk.Label(root, text="Select your EndNote Library file (.enl) to begin.", padx=20, pady=20)
        self.label.pack()

        self.select_button = tk.Button(root, text="Select .enl File", command=self.select_file)
        self.select_button.pack(pady=10)

        self.run_button = tk.Button(root, text="Export to XML", command=self.run_export, state=tk.DISABLED)
        self.run_button.pack(pady=10)

    def select_file(self):
        # The typical EndNote library location is in the user's Documents folder.
        default_endnote_dir = Path.home() / "Documents" / "EndNote"

        # If the default directory doesn't exist, filedialog will handle it gracefully.
        file_path = filedialog.askopenfilename(
            title="Select EndNote Library",
            initialdir=str(default_endnote_dir) if default_endnote_dir.exists() else Path.home(),
            filetypes=[("EndNote Library", "*.enl")]
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
            filetypes=[("XML files", "*.xml"), ("All files", "*.*")]
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
                f"Successfully exported {count[0]} references.\n\nFile saved to:\n\n{output_file}"
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