"""Platform-specific utilities for cross-platform compatibility."""

from pathlib import Path
import sys


def get_application_path() -> Path:
    """Get the application path, handling PyInstaller bundles."""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent
    return Path(__file__).parent


def normalize_path(path: Path) -> Path:
    """Normalize a path for the current platform."""
    try:
        return path.resolve()
    except OSError:
        return path.absolute()


def is_valid_path(path: Path) -> bool:
    """Check if a path is valid for the current platform."""
    try:
        path.resolve()
        return True
    except (OSError, ValueError):
        return False


def find_data_folder(base_path: Path, library_name: str) -> Path | None:
    """Find the .Data folder with case-insensitive lookup.

    Args:
        base_path: Parent directory of the library
        library_name: Name of the library (without extension)

    Returns:
        Path to .Data folder, or None if not found
    """
    # Try exact match first (most common, preserves case on Windows)
    expected_path = base_path / f"{library_name}.Data"
    if expected_path.exists():
        return expected_path

    # Case-insensitive search for case-sensitive filesystems
    target_name = f"{library_name}.Data".lower()
    try:
        for item in base_path.iterdir():
            if item.is_dir() and item.name.lower() == target_name:
                return item
    except PermissionError:
        pass

    return None


def get_documents_folder() -> Path:
    """
    Get the platform-specific Documents folder.

    Uses platform-specific APIs where available:
    - Windows: SHGetFolderPath via ctypes
    - macOS/Linux: XDG standards with fallbacks

    Returns:
        Path to Documents folder, or user home as fallback.
    """
    if sys.platform == "win32":
        docs = _get_windows_documents_folder()
        if docs:
            return docs
    elif sys.platform == "darwin":
        docs = Path.home() / "Documents"
        if docs.exists():
            return docs

    # Linux and fallback
    xdg_docs = _get_xdg_documents_folder()
    if xdg_docs:
        return xdg_docs

    # Fallback chain for all platforms
    candidates = [
        Path.home() / "Documents",
        Path.home() / "Dokumenty",  # Polish
        Path.home() / "Documentos",  # Spanish/Portuguese
        Path.home() / "Dokumente",  # German
        Path.home() / "Documents",  # French
        Path.home() / "My Documents",  # Old Windows
        Path.home() / "docs",  # Some Linux
        Path.home(),
    ]

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return Path.home()


def _get_windows_documents_folder() -> Path | None:
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
        result = Path(buf.value)
        if result.exists():
            return result
    except Exception:
        pass
    return None


def _get_xdg_documents_folder() -> Path | None:
    """Get Linux Documents folder using XDG standards."""
    import os

    xdg_docs = os.environ.get("XDG_DOCUMENTS_DIR")
    if xdg_docs:
        path = Path(xdg_docs)
        if path.exists():
            return path

    config_home = os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")
    user_dirs_file = Path(config_home) / "user-dirs.dirs"

    if user_dirs_file.exists():
        try:
            with user_dirs_file.open("r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("XDG_DOCUMENTS_DIR="):
                        path_str = line.split("=", 1)[1].strip().strip('"')
                        if path_str.startswith("$HOME"):
                            path_str = str(Path.home()) + path_str[5:]
                        path = Path(path_str)
                        if path.exists():
                            return path
        except Exception:
            pass

    return None


def get_endnote_default_directory() -> Path:
    """Get the default EndNote library directory."""
    endnote_dir = get_documents_folder() / "EndNote"
    if endnote_dir.exists():
        return endnote_dir
    return get_documents_folder()


def validate_file_extension(path: Path, expected: str | list[str]) -> bool:
    """Validate that a file has the expected extension(s).

    Args:
        path: File path to validate
        expected: Expected extension(s) (with or without dot)

    Returns:
        True if extension matches (case-insensitive)
    """
    if isinstance(expected, str):
        expected = [expected]

    actual = path.suffix.lower()
    for exp in expected:
        exp = exp.lower()
        if not exp.startswith("."):
            exp = "." + exp
        if actual == exp:
            return True
    return False
