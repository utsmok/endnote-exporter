from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import sys
import tempfile
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, cast
from xml.dom import minidom

ROOT = Path(__file__).resolve().parent
REPO_ROOT = ROOT.parents[1]

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

FIXTURES_DIR = ROOT / "fixtures"
GOLDEN_DIR = ROOT / "golden"
MANIFEST_PATH = ROOT / "fixture-manifest.json"
FIXED_ZIP_TIMESTAMP = (2026, 3, 18, 0, 0, 0)
PDF_ROOT_PLACEHOLDER = "${PDF_ROOT}"
DEFAULT_ENCODING = "utf-8"

EXPECTED_FAILURE_MESSAGE = {
    "missing-database": "Database file not found",
    "malformed-archive": "File is not a zip file",
}

REF_COLUMNS = [
    "id",
    "trash_state",
    "reference_type",
    "added_to_library",
    "record_last_updated",
    "year",
    "date",
    "title",
    "secondary_title",
    "short_title",
    "alternate_title",
    "alt_title",
    "author",
    "secondary_author",
    "pages",
    "volume",
    "number",
    "abstract",
    "isbn",
    "electronic_resource_number",
    "language",
    "type_of_work",
    "custom_7",
    "custom_3",
    "section",
    "label",
    "place_published",
    "publisher",
    "accession_number",
    "author_address",
    "custom_1",
    "custom_2",
    "edition",
    "url",
    "keywords",
    "name_of_database",
    "database_provider",
    "access_date",
    "notes",
]


@dataclass(frozen=True)
class AttachmentSpec:
    refs_id: int
    relative_path: str
    content: bytes


@dataclass(frozen=True)
class FixtureSpec:
    fixture_id: str
    archive_name: str
    description: str
    classification: Literal[
        "supported",
        "expected-failure",
        "stress",
    ]
    library_mode: Literal["enl", "enlp", "malformed"]
    library_name: str | None = None
    data_dir_name: str | None = None
    records: tuple[dict[str, Any], ...] = ()
    attachments: tuple[AttachmentSpec, ...] = ()
    include_database: bool = True
    golden_name: str | None = None
    expected_failure: str | None = None
    notes: tuple[str, ...] = ()
    tags: tuple[str, ...] = ()

    @property
    def library_entry(self) -> str | None:
        if self.library_mode == "enl" and self.library_name:
            return f"{self.library_name}.enl"
        if self.library_mode == "enlp" and self.library_name:
            return f"{self.library_name}.enlp"
        return None

    @property
    def expected_record_count(self) -> int:
        return len(self.records)


def build_specs() -> list[FixtureSpec]:
    base_timestamp = "1700000000"
    simple_record = {
        "id": 1,
        "trash_state": 0,
        "reference_type": 0,
        "added_to_library": base_timestamp,
        "record_last_updated": base_timestamp,
        "year": "2024",
        "date": "2024-05-01",
        "title": "Supported ENL Record",
        "secondary_title": "Journal of Synthetic Fixtures",
        "author": "Ada Lovelace\nGrace Hopper",
        "pages": "10-18",
        "volume": "12",
        "number": "2",
        "abstract": "Deterministic fixture for parity validation.",
        "isbn": "978-1-4028-9462-6",
        "electronic_resource_number": "10.1234/example.1",
        "language": "English",
        "publisher": "Fixture Press",
        "url": "https://example.test/supported-enl",
        "keywords": "fixtures;parity;browser-local",
        "notes": "Baseline supported fixture.",
    }
    enlp_record = {
        "id": 1,
        "trash_state": 0,
        "reference_type": 1,
        "added_to_library": base_timestamp,
        "record_last_updated": base_timestamp,
        "year": "2023",
        "title": "Supported ENLP Package",
        "author": "Katherine Johnson",
        "publisher": "Package House",
        "place_published": "Twente",
        "edition": "Second",
        "notes": "Synthetic .enlp-equivalent package fixture.",
    }
    attachment_record = {
        "id": 1,
        "trash_state": 0,
        "reference_type": 0,
        "added_to_library": base_timestamp,
        "record_last_updated": base_timestamp,
        "year": "2022",
        "title": "Attachment Present Record",
        "secondary_title": "Journal of Attachment Paths",
        "author": "Margaret Hamilton",
        "url": "https://example.test/attachment-record",
        "notes": "Attachment path should be normalized for checked-in goldens.",
    }
    mixed_case_record = {
        "id": 1,
        "trash_state": 0,
        "reference_type": 0,
        "added_to_library": base_timestamp,
        "record_last_updated": base_timestamp,
        "year": "2021",
        "title": "Mixed Case Data Folder",
        "author": "Barbara Liskov",
        "notes": "Exercises case-insensitive .Data lookup.",
    }
    stress_records = tuple(
        {
            "id": index,
            "trash_state": 0,
            "reference_type": 0 if index % 2 == 0 else 1,
            "added_to_library": base_timestamp,
            "record_last_updated": base_timestamp,
            "year": str(2000 + (index % 20)),
            "title": f"Stress Fixture Record {index:03d}",
            "secondary_title": "Journal of Fixture Load" if index % 3 == 0 else None,
            "author": f"Author {index:03d}",
            "pages": f"{index}-{index + 9}",
            "volume": str((index % 9) + 1),
            "number": str((index % 4) + 1),
            "keywords": f"stress;fixture;record-{index:03d}",
            "notes": f"Stress record {index:03d}",
        }
        for index in range(1, 251)
    )

    return [
        FixtureSpec(
            fixture_id="supported-enl-data",
            archive_name="supported-enl-data.zip",
            description="Supported ZIP containing a .enl file plus sibling .Data folder with SQLite DB.",
            classification="supported",
            library_mode="enl",
            library_name="SupportedLibrary",
            records=(simple_record,),
            golden_name="supported-enl-data.xml",
            tags=("supported", "zip", "enl", "data"),
        ),
        FixtureSpec(
            fixture_id="supported-enlp-equivalent",
            archive_name="supported-enlp-equivalent.zip",
            description="Supported ZIP containing an .enlp-equivalent package directory.",
            classification="supported",
            library_mode="enlp",
            library_name="PackageLibrary",
            records=(enlp_record,),
            golden_name="supported-enlp-equivalent.xml",
            tags=("supported", "zip", "enlp"),
        ),
        FixtureSpec(
            fixture_id="missing-db",
            archive_name="missing-db.zip",
            description="Expected failure: archive has library shell but no sdb/sdb.eni database file.",
            classification="expected-failure",
            library_mode="enl",
            library_name="MissingDatabase",
            include_database=False,
            expected_failure="missing-database",
            tags=("failure", "missing-db"),
        ),
        FixtureSpec(
            fixture_id="malformed-archive",
            archive_name="malformed-archive.zip",
            description="Expected failure: file has .zip extension but is not a valid ZIP archive.",
            classification="expected-failure",
            library_mode="malformed",
            expected_failure="malformed-archive",
            notes=("Text payload intentionally written with .zip extension.",),
            tags=("failure", "malformed"),
        ),
        FixtureSpec(
            fixture_id="attachment-present",
            archive_name="attachment-present.zip",
            description="Supported ZIP containing attachment entries in PDF/ for path normalization coverage.",
            classification="supported",
            library_mode="enl",
            library_name="AttachmentLibrary",
            records=(attachment_record,),
            attachments=(
                AttachmentSpec(
                    refs_id=1,
                    relative_path="group-1/paper.pdf",
                    content=(
                        b"%PDF-1.4\n"
                        b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
                        b"2 0 obj<</Type/Pages/Count 0>>endobj\n"
                        b"%%EOF\n"
                    ),
                ),
            ),
            golden_name="attachment-present.xml",
            tags=("supported", "attachments", "path-normalization"),
        ),
        FixtureSpec(
            fixture_id="mixed-case-data-lookup",
            archive_name="mixed-case-data-lookup.zip",
            description="Supported ZIP with mixed-case .Data directory spelling for case-insensitive lookup.",
            classification="supported",
            library_mode="enl",
            library_name="CaseSensitiveLibrary",
            data_dir_name="CaseSensitiveLibrary.dAtA",
            records=(mixed_case_record,),
            golden_name="mixed-case-data-lookup.xml",
            tags=("supported", "case-insensitive", "data"),
        ),
        FixtureSpec(
            fixture_id="stress-large",
            archive_name="stress-large.zip",
            description="Larger synthetic ZIP for future browser performance and memory-envelope validation.",
            classification="stress",
            library_mode="enl",
            library_name="StressLibrary",
            records=stress_records,
            golden_name="stress-large.xml",
            notes=("Contains 250 deterministic reference rows.",),
            tags=("stress", "supported", "performance"),
        ),
    ]


def ensure_clean_output_dirs() -> None:
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
    GOLDEN_DIR.mkdir(parents=True, exist_ok=True)

    for path in FIXTURES_DIR.iterdir():
        if path.is_file():
            path.unlink()
    for path in GOLDEN_DIR.iterdir():
        if path.is_file():
            path.unlink()


def create_schema(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE refs (
            id INTEGER PRIMARY KEY,
            trash_state INTEGER NOT NULL DEFAULT 0,
            reference_type INTEGER,
            added_to_library TEXT,
            record_last_updated TEXT,
            year TEXT,
            date TEXT,
            title TEXT,
            secondary_title TEXT,
            short_title TEXT,
            alternate_title TEXT,
            alt_title TEXT,
            author TEXT,
            secondary_author TEXT,
            pages TEXT,
            volume TEXT,
            number TEXT,
            abstract TEXT,
            isbn TEXT,
            electronic_resource_number TEXT,
            language TEXT,
            type_of_work TEXT,
            custom_7 TEXT,
            custom_3 TEXT,
            section TEXT,
            label TEXT,
            place_published TEXT,
            publisher TEXT,
            accession_number TEXT,
            author_address TEXT,
            custom_1 TEXT,
            custom_2 TEXT,
            edition TEXT,
            url TEXT,
            keywords TEXT,
            name_of_database TEXT,
            database_provider TEXT,
            access_date TEXT,
            notes TEXT
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE file_res (
            refs_id INTEGER NOT NULL,
            file_path TEXT NOT NULL
        )
        """
    )


def populate_database(
    db_path: Path,
    records: tuple[dict[str, Any], ...],
    attachments: tuple[AttachmentSpec, ...],
) -> None:
    connection = sqlite3.connect(db_path)
    try:
        create_schema(connection)
        insert_columns = ", ".join(REF_COLUMNS)
        placeholders = ", ".join("?" for _ in REF_COLUMNS)
        for record in records:
            values = [record.get(column) for column in REF_COLUMNS]
            connection.execute(
                f"INSERT INTO refs ({insert_columns}) VALUES ({placeholders})",
                values,
            )
        for attachment in attachments:
            connection.execute(
                "INSERT INTO file_res (refs_id, file_path) VALUES (?, ?)",
                (attachment.refs_id, attachment.relative_path),
            )
        connection.commit()
        connection.execute("VACUUM")
    finally:
        connection.close()


def write_library_tree(spec: FixtureSpec, working_dir: Path) -> Path:
    if spec.library_mode == "malformed":
        archive_path = FIXTURES_DIR / spec.archive_name
        archive_path.write_text(
            "This is intentionally not a valid ZIP archive.\n",
            encoding=DEFAULT_ENCODING,
        )
        return archive_path

    if spec.library_name is None:
        raise ValueError(f"Fixture {spec.fixture_id} is missing library_name")

    root_dir: Path
    if spec.library_mode == "enlp":
        root_dir = working_dir / f"{spec.library_name}.enlp"
        root_dir.mkdir(parents=True, exist_ok=True)
        enl_path = root_dir / f"{spec.library_name}.enl"
    else:
        root_dir = working_dir
        enl_path = root_dir / f"{spec.library_name}.enl"

    enl_path.write_text(
        "Synthetic EndNote library placeholder used for deterministic testing.\n",
        encoding=DEFAULT_ENCODING,
    )

    data_dir_name = spec.data_dir_name or f"{spec.library_name}.Data"
    data_dir = root_dir / data_dir_name
    sdb_dir = data_dir / "sdb"
    pdf_dir = data_dir / "PDF"
    sdb_dir.mkdir(parents=True, exist_ok=True)
    pdf_dir.mkdir(parents=True, exist_ok=True)

    if spec.include_database:
        populate_database(sdb_dir / "sdb.eni", spec.records, spec.attachments)

    for attachment in spec.attachments:
        attachment_path = pdf_dir / attachment.relative_path
        attachment_path.parent.mkdir(parents=True, exist_ok=True)
        attachment_path.write_bytes(attachment.content)

    archive_path = FIXTURES_DIR / spec.archive_name
    zip_directory(
        working_dir if spec.library_mode == "enl" else root_dir.parent, archive_path
    )
    return archive_path


def iter_zip_entries(root: Path) -> list[tuple[str, Path | None]]:
    entries: list[tuple[str, Path | None]] = []
    for directory in sorted(
        (path for path in root.rglob("*") if path.is_dir()),
        key=lambda path: path.relative_to(root).as_posix(),
    ):
        relative = directory.relative_to(root).as_posix().rstrip("/") + "/"
        entries.append((relative, None))
    for file_path in sorted(
        (path for path in root.rglob("*") if path.is_file()),
        key=lambda path: path.relative_to(root).as_posix(),
    ):
        relative = file_path.relative_to(root).as_posix()
        entries.append((relative, file_path))
    return entries


def zip_directory(source_dir: Path, archive_path: Path) -> None:
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_STORED) as archive:
        for relative_name, file_path in iter_zip_entries(source_dir):
            info = zipfile.ZipInfo(relative_name)
            info.date_time = FIXED_ZIP_TIMESTAMP
            if file_path is None:
                info.external_attr = 0o755 << 16
                archive.writestr(info, "")
            else:
                info.external_attr = 0o644 << 16
                archive.writestr(info, file_path.read_bytes())


def compute_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_xml(xml_path: Path) -> str:
    tree = ET.parse(xml_path)
    root = tree.getroot()
    for url_node in root.findall(".//pdf-urls/url"):
        raw_text = url_node.text or ""
        normalized_text = raw_text.replace("\\", "/")
        marker = "/PDF/"
        if marker in normalized_text:
            _, suffix = normalized_text.split(marker, maxsplit=1)
            url_node.text = f"{PDF_ROOT_PLACEHOLDER}/{suffix.lstrip('/')}"
    xml_bytes = ET.tostring(root, encoding="utf-8")
    return minidom.parseString(xml_bytes).toprettyxml(indent="  ")


def create_exporter() -> Any:
    from endnote_exporter import EndnoteExporter

    return EndnoteExporter()


def write_golden(spec: FixtureSpec, library_path: Path) -> Path:
    if spec.golden_name is None:
        raise ValueError(f"Fixture {spec.fixture_id} is missing golden_name")

    export_path = library_path.parent / f"{spec.fixture_id}.xml"
    exporter = create_exporter()
    exporter.export_references_to_xml(library_path, export_path)
    normalized_xml = normalize_xml(export_path)
    golden_path = GOLDEN_DIR / spec.golden_name
    golden_path.write_text(normalized_xml, encoding=DEFAULT_ENCODING)
    cleanup_export_side_effects()
    return golden_path


def cleanup_export_side_effects() -> None:
    for filename in ("comparisons.jsonl",):
        path = REPO_ROOT / filename
        if path.exists():
            path.unlink()


def build_manifest_entry(
    spec: FixtureSpec,
    archive_path: Path,
    golden_path: Path | None,
) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "id": spec.fixture_id,
        "archive": f"fixtures/{archive_path.name}",
        "description": spec.description,
        "classification": spec.classification,
        "libraryMode": spec.library_mode,
        "expectedRecordCount": spec.expected_record_count,
        "tags": list(spec.tags),
        "notes": list(spec.notes),
        "sha256": compute_sha256(archive_path),
    }
    if spec.library_entry is not None:
        entry["libraryEntry"] = spec.library_entry
    if golden_path is not None:
        entry["golden"] = f"golden/{golden_path.name}"
        entry["goldenSha256"] = compute_sha256(golden_path)
        entry["comparisonMode"] = "normalized-exact-xml"
        entry["oracle"] = "current-python-exporter"
        if spec.attachments:
            entry["normalizations"] = ["pdf-root-placeholder"]
    if spec.expected_failure is not None:
        entry["expectedFailure"] = spec.expected_failure
        entry["expectedMessageSubstring"] = EXPECTED_FAILURE_MESSAGE[
            spec.expected_failure
        ]
        entry["comparisonMode"] = "failure-classification"
    return entry


def build_fixture_corpus() -> dict[str, Any]:
    ensure_clean_output_dirs()
    specs = build_specs()
    manifest_entries: list[dict[str, Any]] = []

    for spec in specs:
        with tempfile.TemporaryDirectory(prefix=f"{spec.fixture_id}-") as temporary_dir:
            working_dir = Path(temporary_dir)
            archive_path = write_library_tree(spec, working_dir)
            golden_path: Path | None = None
            if spec.golden_name is not None and spec.library_entry is not None:
                with tempfile.TemporaryDirectory(
                    prefix=f"{spec.fixture_id}-golden-"
                ) as extraction_dir:
                    extracted_root = Path(extraction_dir)
                    with zipfile.ZipFile(archive_path) as archive:
                        archive.extractall(extracted_root)
                    library_path = extracted_root / spec.library_entry
                    golden_path = write_golden(spec, library_path)
            manifest_entries.append(
                build_manifest_entry(spec, archive_path, golden_path)
            )

    manifest: dict[str, Any] = {
        "version": 1,
        "generatedAt": "2026-03-18",
        "generator": "testing/browser-local/build_fixture_corpus.py",
        "fixtures": manifest_entries,
        "failureClassifications": {
            "missing-database": "Archive shape looks valid, but the extracted library is missing sdb/sdb.eni.",
            "malformed-archive": "The uploaded file has a .zip suffix but cannot be opened as a ZIP archive.",
        },
        "goldenPolicy": {
            "oracle": "current Python desktop exporter",
            "successFixtures": "Golden XML is generated by exporting the extracted fixture through EndnoteExporter and normalizing attachment roots to ${PDF_ROOT}.",
            "failureFixtures": "No XML golden is stored; validation asserts the failure classification and a stable message fragment.",
        },
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding=DEFAULT_ENCODING,
    )
    return manifest


def load_manifest() -> dict[str, Any]:
    return cast(
        dict[str, Any], json.loads(MANIFEST_PATH.read_text(encoding=DEFAULT_ENCODING))
    )


def validate_fixture(entry: dict[str, Any]) -> None:
    archive_path = ROOT / entry["archive"]
    expected_failure = cast(str | None, entry.get("expectedFailure"))

    if expected_failure == "malformed-archive":
        try:
            with zipfile.ZipFile(archive_path) as archive:
                archive.testzip()
        except zipfile.BadZipFile as error:
            message_fragment = cast(str, entry["expectedMessageSubstring"])
            if message_fragment not in str(error):
                raise AssertionError(
                    f"Malformed archive message mismatch for {entry['id']}: {error}"
                ) from error
            return
        raise AssertionError(
            f"Fixture {entry['id']} unexpectedly opened as a valid ZIP"
        )

    with tempfile.TemporaryDirectory(
        prefix=f"validate-{entry['id']}-"
    ) as temporary_dir:
        extracted_root = Path(temporary_dir)
        with zipfile.ZipFile(archive_path) as archive:
            archive.extractall(extracted_root)

        library_entry = cast(str, entry["libraryEntry"])
        library_path = extracted_root / library_entry
        export_path = extracted_root / f"{entry['id']}.xml"
        exporter = create_exporter()

        if expected_failure is not None:
            try:
                exporter.export_references_to_xml(library_path, export_path)
            except FileNotFoundError as error:
                message_fragment = cast(str, entry["expectedMessageSubstring"])
                if message_fragment not in str(error):
                    raise AssertionError(
                        f"Failure message mismatch for {entry['id']}: {error}"
                    ) from error
                cleanup_export_side_effects()
                return
            raise AssertionError(
                f"Fixture {entry['id']} unexpectedly exported successfully"
            )

        count, _ = exporter.export_references_to_xml(library_path, export_path)
        expected_count = cast(int, entry["expectedRecordCount"])
        if count != expected_count:
            raise AssertionError(
                f"Fixture {entry['id']} exported {count} records, expected {expected_count}"
            )
        actual_xml = normalize_xml(export_path)
        golden_path = ROOT / cast(str, entry["golden"])
        golden_xml = golden_path.read_text(encoding=DEFAULT_ENCODING)
        if actual_xml != golden_xml:
            raise AssertionError(f"Golden mismatch for {entry['id']}")
        cleanup_export_side_effects()


def validate_fixture_corpus() -> dict[str, Any]:
    manifest = load_manifest()
    results: list[dict[str, Any]] = []
    for entry in cast(list[dict[str, Any]], manifest["fixtures"]):
        validate_fixture(entry)
        results.append({"id": entry["id"], "status": "ok"})
    return {"validated": results}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build and validate browser-local fixtures and goldens."
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Validate the existing checked-in corpus without rebuilding it first.",
    )
    parser.add_argument(
        "--build-only",
        action="store_true",
        help="Rebuild fixtures, goldens, and manifest without running validation.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.validate_only and args.build_only:
        raise SystemExit("--validate-only and --build-only are mutually exclusive")

    if not args.validate_only:
        build_fixture_corpus()
    if not args.build_only:
        validate_fixture_corpus()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
