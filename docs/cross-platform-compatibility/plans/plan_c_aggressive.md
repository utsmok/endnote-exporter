# Plan C: Aggressive Approach - Complete Rewrite with Modern Architecture

## Overview

**Risk Level:** High
**Estimated Effort:** 40-80 hours
**Disruption:** Major
**Timeline:** 4-8 weeks

This plan involves a complete modernization of the application with a new architecture, modern GUI framework, comprehensive testing, and full cross-platform support. While risky, it positions the project for long-term maintainability.

---

## Strategic Goals

1. **Modern Architecture:** Decoupled, testable, maintainable codebase
2. **Better GUI:** Modern, cross-platform GUI framework
3. **Comprehensive Testing:** >90% test coverage
4. **CI/CD Pipeline:** Automated builds for all platforms
5. **Extensibility:** Plugin architecture for future features

---

## New Architecture

### Directory Structure

```
endnote-exporter/
|-- src/
|   |-- endnote_exporter/
|       |-- __init__.py
|       |-- __main__.py           # Entry point
|       |-- core/
|       |   |-- __init__.py
|       |   |-- exporter.py       # Core export logic
|       |   |-- database.py       # Database operations
|       |   |-- xml_builder.py    # XML generation
|       |   |-- models.py         # Data models
|       |-- platform/
|       |   |-- __init__.py
|       |   |-- paths.py          # Path handling
|       |   |-- detection.py      # Platform detection
|       |   |-- shell.py          # Shell integration
|       |-- gui/
|       |   |-- __init__.py
|       |   |-- app.py            # Main application
|       |   |-- views/
|       |   |   |-- main_view.py
|       |   |   |-- settings_view.py
|       |   |-- widgets/
|       |   |   |-- file_selector.py
|       |   |   |-- progress.py
|       |   |-- controllers/
|       |       |-- export_controller.py
|       |-- utils/
|       |   |-- __init__.py
|       |   |-- logging.py        # Logging configuration
|       |   |-- config.py         # Configuration management
|       |   |-- validators.py     # Input validation
|       |-- exceptions.py         # Custom exceptions
|-- tests/
|   |-- unit/
|   |   |-- test_exporter.py
|   |   |-- test_database.py
|   |   |-- test_paths.py
|   |-- integration/
|   |   |-- test_export_flow.py
|   |-- fixtures/
|       |-- sample_library/
|-- docs/
|   |-- architecture.md
|   |-- api.md
|-- pyproject.toml
|-- setup.py
|-- Makefile
|-- .github/
    |-- workflows/
        |-- test.yml
        |-- release.yml
```

---

## Component Design

### 1. Core Layer

#### models.py

```python
"""Data models for EndNote export."""
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional
from enum import Enum


class ReferenceType(Enum):
    """EndNote reference types."""
    JOURNAL_ARTICLE = "journalArticle"
    BOOK = "book"
    BOOK_SECTION = "bookSection"
    THESIS = "thesis"
    # ... etc


@dataclass
class Reference:
    """A single EndNote reference."""
    id: int
    ref_type: ReferenceType
    title: Optional[str] = None
    authors: list[str] = field(default_factory=list)
    year: Optional[int] = None
    journal: Optional[str] = None
    volume: Optional[str] = None
    issue: Optional[str] = None
    pages: Optional[str] = None
    abstract: Optional[str] = None
    keywords: list[str] = field(default_factory=list)
    doi: Optional[str] = None
    url: Optional[str] = None
    pdf_paths: list[Path] = field(default_factory=list)
    custom_fields: dict[str, Any] = field(default_factory=dict)

    def to_zotero_dict(self) -> dict:
        """Convert to Zotero-compatible dictionary."""
        # Implementation
        pass


@dataclass
class ExportResult:
    """Result of an export operation."""
    success: bool
    references_exported: int
    references_skipped: int
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    output_path: Optional[Path] = None
    duration_seconds: float = 0.0
```

#### exporter.py

```python
"""Core export functionality."""
from pathlib import Path
from typing import Protocol
import sqlite3

from .models import Reference, ExportResult
from .database import EndNoteDatabase
from .xml_builder import ZoteroXMLBuilder
from ..exceptions import DatabaseNotFoundError, ExportError


class ProgressCallback(Protocol):
    """Protocol for progress reporting."""
    def __call__(self, current: int, total: int, message: str) -> None: ...


class Exporter:
    """Main exporter class with clean interface."""

    def __init__(self, library_path: Path):
        self.library_path = library_path
        self._db: Optional[EndNoteDatabase] = None

    @property
    def database(self) -> EndNoteDatabase:
        """Lazy-load database connection."""
        if self._db is None:
            db_path = self._get_database_path()
            if not db_path.exists():
                raise DatabaseNotFoundError(db_path)
            self._db = EndNoteDatabase(db_path)
        return self._db

    def export(
        self,
        output_path: Path,
        progress_callback: Optional[ProgressCallback] = None
    ) -> ExportResult:
        """
        Export EndNote library to Zotero-compatible XML.

        Args:
            output_path: Path for output XML file
            progress_callback: Optional callback for progress updates

        Returns:
            ExportResult with export statistics
        """
        # Implementation
        pass

    def validate_library(self) -> list[str]:
        """
        Validate the EndNote library structure.

        Returns:
            List of validation warnings (empty if valid)
        """
        # Implementation
        pass

    def get_library_stats(self) -> dict:
        """Get statistics about the library."""
        # Implementation
        pass
```

---

### 2. Platform Layer

#### paths.py

```python
"""Cross-platform path handling."""
from pathlib import Path
import sys
import os
from typing import Optional


class PathManager:
    """Centralized path management for cross-platform compatibility."""

    @staticmethod
    def get_documents_folder() -> Path:
        """Get platform-specific Documents folder."""
        if sys.platform == "win32":
            return PathManager._get_windows_documents()
        elif sys.platform == "darwin":
            return Path.home() / "Documents"
        else:  # Linux and others
            return PathManager._get_linux_documents()

    @staticmethod
    def _get_windows_documents() -> Path:
        """Get Windows Documents folder using SHGetFolderPath."""
        try:
            import ctypes
            from ctypes import wintypes

            SHGFP_TYPE_CURRENT = 0
            CSIDL_PERSONAL = 5  # My Documents

            buf = ctypes.create_unicode_buffer(wintypes.MAX_PATH)
            ctypes.windll.shell32.SHGetFolderPathW(
                0, CSIDL_PERSONAL, 0, SHGFP_TYPE_CURRENT, buf
            )
            return Path(buf.value)
        except Exception:
            # Fallback
            return Path.home() / "Documents"

    @staticmethod
    def _get_linux_documents() -> Path:
        """Get Linux Documents folder using XDG."""
        xdg_docs = os.environ.get("XDG_DOCUMENTS_DIR")
        if xdg_docs:
            return Path(xdg_docs)

        # Check user-dirs.dirs
        config_home = os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")
        user_dirs_file = Path(config_home) / "user-dirs.dirs"
        if user_dirs_file.exists():
            try:
                with user_dirs_file.open("r") as f:
                    for line in f:
                        if line.startswith("XDG_DOCUMENTS_DIR="):
                            path = line.split("=", 1)[1].strip().strip('"')
                            if path.startswith("$HOME"):
                                path = str(Path.home()) + path[5:]
                            return Path(path)
            except Exception:
                pass

        return Path.home() / "Documents"

    @staticmethod
    def get_application_data() -> Path:
        """Get platform-specific application data directory."""
        if sys.platform == "win32":
            return Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
        elif sys.platform == "darwin":
            return Path.home() / "Library" / "Application Support"
        else:
            xdg_data = os.environ.get("XDG_DATA_HOME")
            if xdg_data:
                return Path(xdg_data)
            return Path.home() / ".local" / "share"

    @staticmethod
    def normalize_for_comparison(path: Path) -> Path:
        """Normalize path for case-insensitive comparison where appropriate."""
        if sys.platform == "win32" or sys.platform == "darwin":
            # Case-insensitive filesystems
            return Path(str(path).lower())
        return path
```

---

### 3. GUI Layer (Modern Framework)

#### Options Considered

| Framework | Pros | Cons | Recommendation |
|-----------|------|------|----------------|
| **CustomTkinter** | Easy migration, modern look | Still Tkinter limitations | **Recommended** |
| PyQt6/PySide6 | Powerful, native look | License complexity, large | Alternative |
| Dear PyGui | GPU-accelerated, modern | Less mature, different paradigm | Not recommended |
| Flet | Modern, web-based | Heavy, requires Flutter | Not recommended |

#### Recommended: CustomTkinter

```python
"""Modern GUI using CustomTkinter."""
import customtkinter as ctk
from pathlib import Path
from typing import Optional, Callable

from ..core.exporter import Exporter
from ..core.models import ExportResult
from ..platform.paths import PathManager


class MainWindow(ctk.CTk):
    """Main application window."""

    def __init__(self):
        super().__init__()

        self.title("EndNote to Zotero Exporter")
        self.geometry("700x500")
        self.minsize(600, 400)

        # Configure grid
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        # Create widgets
        self._create_header()
        self._create_main_content()
        self._create_footer()

        # State
        self.selected_library: Optional[Path] = None
        self.exporter: Optional[Exporter] = None

    def _create_header(self) -> None:
        """Create header section."""
        header = ctk.CTkFrame(self, fg_color="transparent")
        header.grid(row=0, column=0, sticky="ew", padx=20, pady=20)

        title = ctk.CTkLabel(
            header,
            text="EndNote to Zotero Exporter",
            font=ctk.CTkFont(size=24, weight="bold")
        )
        title.pack()

        subtitle = ctk.CTkLabel(
            header,
            text="Export your EndNote library for import into Zotero",
            font=ctk.CTkFont(size=14)
        )
        subtitle.pack()

    def _create_main_content(self) -> None:
        """Create main content area."""
        content = ctk.CTkFrame(self)
        content.grid(row=1, column=0, sticky="nsew", padx=20, pady=(0, 20))
        content.grid_columnconfigure(0, weight=1)
        content.grid_rowconfigure(1, weight=1)

        # File selection
        self.file_frame = FileSelectionFrame(
            content,
            on_file_selected=self._on_library_selected
        )
        self.file_frame.grid(row=0, column=0, sticky="ew", padx=20, pady=20)

        # Progress area
        self.progress_frame = ProgressFrame(content)
        self.progress_frame.grid(row=1, column=0, sticky="nsew", padx=20, pady=(0, 20))

    def _create_footer(self) -> None:
        """Create footer with action buttons."""
        footer = ctk.CTkFrame(self, fg_color="transparent")
        footer.grid(row=2, column=0, sticky="ew", padx=20, pady=(0, 20))

        self.export_button = ctk.CTkButton(
            footer,
            text="Export to XML",
            command=self._start_export,
            state="disabled",
            width=200,
            height=40,
            font=ctk.CTkFont(size=14, weight="bold")
        )
        self.export_button.pack()

    def _on_library_selected(self, path: Path) -> None:
        """Handle library file selection."""
        self.selected_library = path
        self.exporter = Exporter(path)
        self.export_button.configure(state="normal")

    def _start_export(self) -> None:
        """Start the export process."""
        # Implementation
        pass
```

---

### 4. Testing Infrastructure

#### pytest configuration

```toml
# pyproject.toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
python_functions = ["test_*"]
addopts = "-v --cov=src/endnote_exporter --cov-report=html --cov-report=term-missing"
markers = [
    "slow: marks tests as slow",
    "integration: marks tests as integration tests",
    "windows: marks tests that require Windows",
    "macos: marks tests that require macOS",
    "linux: marks tests that require Linux",
]
```

#### Sample test file

```python
"""Tests for platform paths module."""
import pytest
from pathlib import Path
import sys

from endnote_exporter.platform.paths import PathManager


class TestPathManager:
    """Tests for PathManager class."""

    def test_get_documents_folder_returns_path(self):
        """Test that get_documents_folder returns a Path object."""
        result = PathManager.get_documents_folder()
        assert isinstance(result, Path)

    def test_get_documents_folder_exists(self):
        """Test that returned documents folder exists."""
        result = PathManager.get_documents_folder()
        assert result.exists()

    @pytest.mark.skipif(sys.platform != "win32", reason="Windows only")
    def test_windows_documents_uses_shgetfolderpath(self):
        """Test Windows uses proper API for Documents folder."""
        result = PathManager._get_windows_documents()
        # Should not be hardcoded "Documents"
        # Should match actual Windows Documents folder
        assert result.exists()

    @pytest.mark.skipif(sys.platform != "linux", reason="Linux only")
    def test_linux_documents_respects_xdg(self):
        """Test Linux respects XDG_DOCUMENTS_DIR."""
        # This test would need mock environment
        pass
```

---

### 5. CI/CD Pipeline

#### GitHub Actions - test.yml

```yaml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        python-version: ['3.10', '3.11', '3.12']

    steps:
    - uses: actions/checkout@v4

    - name: Set up Python ${{ matrix.python-version }}
      uses: actions/setup-python@v5
      with:
        python-version: ${{ matrix.python-version }}

    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -e ".[dev]"

    - name: Run linting
      run: |
        ruff check src/

    - name: Run type checking
      run: |
        mypy src/

    - name: Run tests with coverage
      run: |
        pytest --cov --cov-report=xml

    - name: Upload coverage
      uses: codecov/codecov-action@v4
      with:
        files: ./coverage.xml
```

---

## Migration Strategy

### Phase 1: Foundation (Week 1-2)

1. Set up new project structure
2. Create core models and interfaces
3. Implement platform layer
4. Set up testing infrastructure

### Phase 2: Core Migration (Week 3-4)

1. Port database operations
2. Port XML generation
3. Port export logic
4. Unit tests for all components

### Phase 3: GUI Development (Week 5-6)

1. Implement new GUI with CustomTkinter
2. Wire up to core layer
3. Integration testing
4. User acceptance testing

### Phase 4: Polish & Release (Week 7-8)

1. Documentation
2. CI/CD pipeline updates
3. Beta testing
4. Final release

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Feature regression | High | High | Comprehensive test suite |
| Extended timeline | High | Medium | Phased delivery |
| User resistance | Medium | Medium | Gradual rollout, training |
| Dependency issues | Medium | Medium | Lock file, regular updates |
| Platform-specific bugs | Medium | High | Test matrix, beta testers |

**Overall Risk: HIGH**

---

## Success Criteria

1. All existing functionality preserved
2. >90% test coverage
3. Successful builds for Windows, macOS, Linux
4. Modern, accessible GUI
5. No critical bugs in first 30 days
6. Positive user feedback

---

## Conclusion

Plan C represents a significant investment but delivers a modern, maintainable, and extensible codebase. The modular architecture supports future enhancements and the comprehensive testing ensures reliability. Recommended for projects with long-term maintenance goals and available resources for a major refactoring effort.

### When to Choose Plan C

- Long-term project with ongoing development
- Need for extensibility and plugin support
- Current codebase becoming unmaintainable
- Resources available for extended development
- Want to attract contributors with modern codebase
