from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import Any, cast

MODULE_PATH = Path(__file__).with_name("build_fixture_corpus.py")
pytest = cast(Any, __import__("pytest"))


def load_fixture_module() -> Any:
    spec = importlib.util.spec_from_file_location(
        "browser_local_build_fixture_corpus", MODULE_PATH
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load module from {MODULE_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


FIXTURE_MODULE = load_fixture_module()
MANIFEST = cast(dict[str, Any], FIXTURE_MODULE.load_manifest())
FIXTURE_IDS = [entry["id"] for entry in MANIFEST["fixtures"]]


@pytest.mark.parametrize("fixture_id", FIXTURE_IDS)
def test_fixture_validation(fixture_id: str) -> None:
    entry = next(
        fixture for fixture in MANIFEST["fixtures"] if fixture["id"] == fixture_id
    )
    FIXTURE_MODULE.validate_fixture(entry)
