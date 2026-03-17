# Plan A: Conservative Approach - Minimal Changes, Low Risk

## Overview

**Risk Level:** Low
**Estimated Effort:** 4-8 hours
**Disruption:** Minimal
**Timeline:** 1-2 days

This plan focuses on addressing only the most critical cross-platform compatibility issues with minimal code changes. The goal is to fix immediate problems without introducing new risks or requiring extensive testing.

---

## Scope of Changes

### 1. Fix Hard-coded "Documents" Folder (HIGH PRIORITY)

**File:** `gui.py`, Lines 45-47

**Current Code:**
```python
default_endnote_dir = Path.home() / "Documents" / "EndNote"
default_endnote_dir = default_endnote_dir if default_endnote_dir.exists() else Path.home() / "Documents"
default_endnote_dir = default_endnote_dir if default_endnote_dir.exists() else Path.home()
```

**Proposed Change:**
```python
def get_documents_dir() -> Path:
    """Get platform-specific Documents folder with fallbacks."""
    # Try platform-specific locations
    candidates = [
        Path.home() / "Documents",      # English Windows, Linux
        Path.home() / "Dokumenty",      # Polish Windows
        Path.home() / "Documentos",     # Spanish Windows
        Path.home() / "My Documents",   # Old Windows
        Path.home() / "docs",           # Some Linux distros
    ]

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return Path.home()

default_endnote_dir = get_documents_dir() / "EndNote"
default_endnote_dir = default_endnote_dir if default_endnote_dir.exists() else get_documents_dir()
```

**Rationale:** Simple fallback mechanism without external dependencies.

---

### 2. Add File Extension Validation (MEDIUM PRIORITY)

**File:** `endnote_exporter.py`, after Line 143

**Proposed Addition:**
```python
def export_references_to_xml(self, enl_file_path: Path, output_file: Path) -> tuple[int, int]:
    # Validate input file extension
    if enl_file_path.suffix.lower() != '.enl':
        raise ValueError(
            f"Expected EndNote library file (.enl), got {enl_file_path.suffix}"
        )

    # Validate output file extension
    if output_file.suffix.lower() != '.xml':
        logger.warning(f"Output file has unexpected extension: {output_file.suffix}")

    # ... rest of existing code
```

**Rationale:** Early validation prevents cryptic errors later.

---

### 3. Improve Exception Specificity (LOW PRIORITY)

**File:** `gui.py`, Lines 75-77

**Current Code:**
```python
try:
    line = line.strip().split(" | ", 2)[-1]
except Exception:
    continue
```

**Proposed Change:**
```python
try:
    line = line.strip().split(" | ", 2)[-1]
except (IndexError, AttributeError):
    continue
```

**Rationale:** More specific exception handling improves debugging.

---

## Changes NOT Included (Deferred)

- File opening pattern standardization (Path.open() vs open())
- Module restructuring
- GUI framework migration
- Comprehensive test suite
- CI/CD improvements

---

## Testing Requirements

### Minimal Testing Checklist

- [ ] Test on Windows 10/11 (English locale)
- [ ] Test on Windows 10/11 (non-English locale if possible)
- [ ] Verify file selection with invalid extensions shows error
- [ ] Verify existing functionality unchanged

### Regression Risk: LOW

All changes are additive or minor modifications to existing logic. No architectural changes.

---

## Deployment Considerations

### Rollback Plan

Since changes are minimal, rollback is straightforward:
1. Revert specific file changes
2. No database or configuration migrations needed

### User Impact

- Users with non-English Windows will see improved default directory detection
- Users selecting wrong file types will get clearer error messages
- No visible UI changes

---

## Success Criteria

1. Application works correctly on non-English Windows systems
2. Invalid file selection produces clear error messages
3. No regression in existing functionality
4. All existing tests pass (if any)

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Fallback list incomplete | Medium | Low | Falls back to home directory |
| Breaking existing behavior | Low | Low | Minimal code changes |
| Missing edge cases | Low | Low | Defensive coding |

**Overall Risk: LOW**

---

## Timeline

- Day 1 Morning: Implement changes
- Day 1 Afternoon: Manual testing
- Day 2 Morning: Address any issues found
- Day 2 Afternoon: Final verification and documentation

---

## Conclusion

Plan A provides the safest path forward with minimal disruption. It addresses the most critical cross-platform issues while maintaining complete backward compatibility. Recommended for teams with limited testing resources or strict change management policies.
