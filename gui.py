import tkinter as tk
from tkinter import filedialog, messagebox
from tkinter import ttk
from pathlib import Path
from endnote_exporter import export_references_to_xml

class ExporterApp:
    def __init__(self, root):
        self.root = root
        self.root.title("EndNote to Zotero Exporter")
        self.root.resizable(True, True)  # Make window resizable
        self.enl_file = None

        # Style for better theming
        style = ttk.Style()
        style.configure("TLabel", font=("TkDefaultFont", 10))
        style.configure("Status.TLabel", font=("TkDefaultFont", 12, "bold"), foreground="blue")
        style.configure("TButton", font=("TkDefaultFont", 10))

        self.label = ttk.Label(
            root,
            text="Select your EndNote Library file (.enl) to begin.",
            padding=(20, 20),
            wraplength=500,  # Wrap text for long messages
        )
        self.label.pack()

        self.select_button = ttk.Button(
            root, text="Select .enl File", command=self.select_file
        )
        self.select_button.pack(pady=10)

        self.run_button = ttk.Button(
            root, text="Export to XML", command=self.run_export, state=tk.DISABLED
        )
        # hide the run button until a file is selected
        self.run_button.pack_forget()

    def select_file(self):
        # The typical EndNote library location is in the user's Documents folder.
        default_endnote_dir = Path.home() / "Documents" / "EndNote"
        default_endnote_dir = default_endnote_dir if default_endnote_dir.exists() else Path.home() / "Documents"
        default_endnote_dir = default_endnote_dir if default_endnote_dir.exists() else Path.home()

        # If the default directory doesn't exist, filedialog will handle it gracefully.
        file_path = filedialog.askopenfilename(
            title="Select EndNote Library:",
            initialdir=str(default_endnote_dir)
            if default_endnote_dir.exists()
            else Path.home(),
            filetypes=[("EndNote Library", "*.enl")],
        )
        if file_path:
            self.enl_file = Path(file_path)
            self.label.config(text=f"You have selected EndNote Library `{self.enl_file.name}`, stored in {self.enl_file.parent}.", style="Status.TLabel")
            # show the run button after selection
            self.run_button.pack(pady=10)
            self.run_button.config(state=tk.NORMAL)
            # hide the select button after selection
            self.select_button.pack_forget()

    def run_export(self):
        if not self.enl_file:
            messagebox.showerror("Error", "No .enl file selected.")
            return

        default_xml_name = f"{self.enl_file.stem}_zotero_export.xml"

        output_path_str = filedialog.asksaveasfilename(
            title="Save Exported XML As:",
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
        except Exception as e:
            messagebox.showerror("Export Failed", f"An error occurred:\n\n{e}")
            # Reset UI on error
            self.run_button.config(state=tk.NORMAL, text="Export to XML")
            self.label.config(style="TLabel")  # Reset to normal style
        else:
            # Success: update UI
            self.run_button.pack_forget()
            self.label.config(text=f"Success! Exported {count[0]} references.\n\nFile saved to:\n\n{output_file}", style="Status.TLabel")
            self.select_button.pack(pady=10)
            self.select_button.config(text="Select another library to export")





if __name__ == "__main__":
    root = tk.Tk()
    app = ExporterApp(root)
    root.geometry("600x400")
    root.mainloop()
