# EndNote library exporter

A user-friendly desktop application for Windows to quickly export an EndNote library into an XML file suitable for Zotero import with these improvements over the regular EndNote export:

- Simple GUI
- Preserves added / modified dates for EndNote by letting Zotero store them as `Note` attachments to the item, which can be used by the companion plugin [EndNote Date Fixer](https://github.com/utsmok/endnote-date-fixer).
- PDF attachments are linked using absolute to ensure they are properly imported into Zotero, instead of relying on relative paths.
- Available as a script or packaged as a single executable file with no dependencies to install for ease of use.

## How to use

You can download the latest version of the application from the **[Releases Page](https://github.com/utsmok/endnote-exporter/releases)**. No installation is required. Just download the correct binary file for your OS and execute it.
If you prefer the script/source version instead: see below.

For a complete step-by-step guide on how to use this tool with its companion Zotero plugin to migrate your library, please see the blog post:

**[Custom tools to export your EndNote library to Zotero @ samuelmok.cc](https://libraet.samuelmok.cc/posts/endnote-export/)**

### For Developers

This application is built with Python, using only the core library; using Tkinter for the GUI and PyInstaller for packaging. To run from source or contribute:

1.  Clone the repository: `git clone https://github.com/utsmok/endnote-exporter.git`
2.  The script has no external dependencies. Run with `python endnote_exporter_gui.py` (or using `uv`, which is recommended: `uv run endnote_exporter_gui.py`).
3.  To build the executable yourself, install PyInstaller (`pip install pyinstaller`) and run the build command found in the [GitHub Actions workflow](.github/workflows/release.yml).
