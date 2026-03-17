# endnote-exporter

Desktop app to export EndNote libraries to Zotero-compatible XML.

## Project Structure

```
endnote-exporter/
├── endnote_exporter.py   # Core export logic (~1100 lines)
├── gui.py                # Tkinter GUI (~150 lines)
├── platform_utils.py     # Cross-platform utilities
├── pyproject.toml        # Project config
└── .github/workflows/    # CI/CD for multi-platform builds
```

## Key Files

- **`endnote_exporter.py`**: `EndnoteExporter` class handles SQLite database reads, XML generation. `XMLComparator` for testing.
- **`gui.py`**: `ExporterApp` class, Tkinter file dialogs. Entry point: `python gui.py`
- **`platform_utils.py`**: Cross-platform path handling, Documents folder detection, .enlp support

## Development

```bash
# Run from source
uv run gui.py

# Quality gates
uvx ruff check . --fix
uvx ruff format .
uvx ty check .

# Build executable
pyinstaller --onefile --windowed --name "EndNote Exporter" gui.py
```

## Architecture Notes

- **Python 3.12+**, no external dependencies except `loguru` and `pyinstaller`
- Uses `pathlib.Path` exclusively (no `os.path`)
- UTF-8 encoding on all file operations
- PyInstaller-aware for frozen executable mode

## EndNote Library Structure

```
MyLibrary.enl          # Library index file
MyLibrary.Data/        # Database folder
├── sdb/sdb.eni        # SQLite database
└── PDF/               # PDF attachments
```

macOS packages (`.enlp`) contain the same structure inside a directory bundle.

## Cross-Platform Considerations

- **Windows**: Uses `SHGetFolderPathW` via ctypes for localized Documents folder
- **macOS**: Supports both `.enl` and `.enlp` package formats
- **Linux**: Respects `XDG_DOCUMENTS_DIR`, case-insensitive `.Data` folder lookup

## XML Output Format

Generates Zotero-compatible XML with:
- Preserved add/modify dates (as Note attachments)
- Absolute PDF paths for reliable import
- Reference type mappings (EndNote → Zotero)
