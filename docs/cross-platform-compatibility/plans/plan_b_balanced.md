# Plan B: Balanced Approach - Comprehensive Refactor with Moderate Risk

## Overview

**Risk Level:** Moderate
**Estimated Effort:** 16-24 hours
**Disruption:** Moderate
**Timeline:** 1-2 weeks

This plan balances comprehensive improvements with manageable risk. It includes all changes from Plan A plus additional refactoring for better maintainability, cross-platform support, and code quality improvements.

---

## Scope of Changes

### Phase 1: Critical Fixes (from Plan A)

1. Fix hard-coded "Documents" folder
2. Add file extension validation
3. Improve exception specificity

### Phase 2: Code Quality Improvements

#### 2.1 Standardize File Opening Patterns

**Files:** `endnote_exporter.py`, `gui.py`

**Current Inconsistency:**
```python
# gui.py uses Path.open()
with log_file.open("r", encoding="utf-8") as lf:

# endnote_exporter.py uses built-in open()
with open(output_path, "w", encoding="utf-8") as f:
```

**Proposed Standardization:**
```python
# Consistently use Path.open() everywhere
with output_path.open("w", encoding="utf-8") as f:
```

**Affected Lines in endnote_exporter.py:**
- Line 187: `with open(comparisons_file, "a", encoding="utf-8")`
- Line 247: `with open(output_path, "w", encoding="utf-8")`
- Line 249: `with open(output_path, "w", encoding="utf-8")`
- Line 251: `with open(output_path, "w", encoding="utf-8")`

---

#### 2.2 Create Platform Utilities Module

**New File:** `platform_utils.py`

```python
"""Platform-specific utilities for cross-platform compatibility."""
from pathlib import Path
import sys
from typing import Optional


def get_documents_folder() -> Path:
    """
    Get the platform-specific Documents folder.

    Returns:
        Path to Documents folder, or user home as fallback.
    """
    candidates = [
        Path.home() / "Documents",
        Path.home() / "Dokumenty",
        Path.home() / "Documentos",
        Path.home() / "My Documents",
        Path.home() / "docs",
    ]

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return Path.home()


def get_application_path() -> Path:
    """
    Get the application path, handling PyInstaller bundles.

    Returns:
        Path to application directory.
    """
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).parent
    return Path(__file__).parent


def get_endnote_default_directory() -> Path:
    """
    Get the default EndNote library directory.

    Returns:
        Path to EndNote directory or Documents folder as fallback.
    """
    endnote_dir = get_documents_folder() / "EndNote"
    if endnote_dir.exists():
        return endnote_dir
    return get_documents_folder()


def validate_file_extension(path: Path, expected: str) -> bool:
    """
    Validate that a file has the expected extension.

    Args:
        path: File path to validate
        expected: Expected extension (with or without dot)

    Returns:
        True if extension matches (case-insensitive)
    """
    expected = expected.lower()
    if not expected.startswith('.'):
        expected = '.' + expected
    return path.suffix.lower() == expected
```

---

#### 2.3 Improve Error Messages with Platform Context

**Enhanced Error Handling:**

```python
class EndNoteExporterError(Exception):
    """Base exception for EndNote exporter errors."""
    pass


class InvalidFileFormatError(EndNoteExporterError):
    """Raised when an invalid file format is provided."""
    def __init__(self, path: Path, expected: str):
        self.path = path
        self.expected = expected
        super().__init__(
            f"Invalid file format: {path.suffix}. Expected {expected}.\n"
            f"File: {path}"
        )


class DatabaseNotFoundError(EndNoteExporterError):
    """Raised when the EndNote database cannot be found."""
    def __init__(self, path: Path):
        self.path = path
        super().__init__(
            f"EndNote database not found at:\n{path}\n\n"
            f"Please ensure the .Data folder exists alongside your .enl file."
        )
```

---

### Phase 3: Enhanced Cross-Platform Support

#### 3.1 Platform-Aware Path Handling

**Add to `platform_utils.py`:**

```python
def normalize_path(path: Path) -> Path:
    """
    Normalize a path for the current platform.

    Handles:
    - Case sensitivity (preserves original)
    - Symlink resolution
    - Long paths on Windows

    Args:
        path: Path to normalize

    Returns:
        Normalized absolute path
    """
    try:
        return path.resolve()
    except OSError:
        return path.absolute()


def is_valid_path(path: Path) -> bool:
    """
    Check if a path is valid for the current platform.

    Args:
        path: Path to validate

    Returns:
        True if path is valid and accessible
    """
    try:
        path.resolve()
        return True
    except (OSError, ValueError):
        return False
```

#### 3.2 Configuration File Support

**New File:** `config.py`

```python
"""Configuration management for endnote-exporter."""
from pathlib import Path
import json
from dataclasses import dataclass, field
from typing import Optional
from platform_utils import get_application_path


@dataclass
class Config:
    """Application configuration."""
    last_library_path: Optional[Path] = None
    last_export_path: Optional[Path] = None
    log_level: str = "TRACE"
    remember_paths: bool = True

    @classmethod
    def load(cls) -> 'Config':
        """Load configuration from file."""
        config_path = get_application_path() / "config.json"
        if config_path.exists():
            try:
                with config_path.open("r", encoding="utf-8") as f:
                    data = json.load(f)
                return cls(
                    last_library_path=Path(data.get("last_library_path")) if data.get("last_library_path") else None,
                    last_export_path=Path(data.get("last_export_path")) if data.get("last_export_path") else None,
                    log_level=data.get("log_level", "TRACE"),
                    remember_paths=data.get("remember_paths", True),
                )
            except (json.JSONDecodeError, KeyError):
                pass
        return cls()

    def save(self) -> None:
        """Save configuration to file."""
        config_path = get_application_path() / "config.json"
        data = {
            "last_library_path": str(self.last_library_path) if self.last_library_path else None,
            "last_export_path": str(self.last_export_path) if self.last_export_path else None,
            "log_level": self.log_level,
            "remember_paths": self.remember_paths,
        }
        with config_path.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
```

---

## Refactored File Structure

```
endnote-exporter/
|-- endnote_exporter.py    # Core export logic (reduced size)
|-- gui.py                 # GUI (using platform_utils)
|-- platform_utils.py      # NEW: Platform abstractions
|-- config.py              # NEW: Configuration management
|-- exceptions.py          # NEW: Custom exceptions
|-- tests/
|   |-- test_platform_utils.py
|   |-- test_exporter.py
|   |-- test_gui.py
```

---

## Testing Requirements

### Comprehensive Testing Checklist

**Unit Tests:**
- [ ] `platform_utils.py` - all functions
- [ ] `config.py` - load/save
- [ ] `exceptions.py` - error messages

**Integration Tests:**
- [ ] End-to-end export on Windows
- [ ] End-to-end export on macOS
- [ ] End-to-end export on Linux
- [ ] Path with spaces
- [ ] Path with non-ASCII characters
- [ ] Invalid file selection
- [ ] Missing database files

**Platform-Specific Tests:**
- [ ] Windows 10/11 English
- [ ] Windows 10/11 non-English locale
- [ ] macOS 12+
- [ ] Ubuntu 22.04+

---

## Migration Path

### Step-by-Step Implementation

1. **Week 1 - Phase 1 & 2:**
   - Create new utility modules
   - Implement critical fixes
   - Refactor file operations
   - Add unit tests

2. **Week 2 - Phase 3:**
   - Add configuration support
   - Enhance error handling
   - Integration testing
   - Documentation updates

---

## Deployment Considerations

### Rollback Plan

1. Keep backup of original files
2. New modules can be safely removed
3. Configuration file is optional (app works without it)

### User Impact

- Improved error messages
- Path persistence (optional feature)
- Better non-English Windows support
- Slightly larger distribution size

---

## Success Criteria

1. All Plan A criteria met
2. Code passes new unit test suite (>80% coverage)
3. Successful tests on 3+ platforms
4. No increase in user-reported bugs
5. Improved error message clarity

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| New bugs from refactoring | Medium | Medium | Comprehensive unit tests |
| Platform-specific edge cases | Medium | Medium | Test matrix |
| Breaking changes | Low | High | Backward-compatible API |
| Scope creep | Medium | Medium | Strict change control |

**Overall Risk: MODERATE**

---

## Conclusion

Plan B provides significant improvements in code quality and cross-platform support while maintaining reasonable risk levels. The modular approach allows for incremental implementation and testing. Recommended for teams wanting substantial improvements without a complete rewrite.
