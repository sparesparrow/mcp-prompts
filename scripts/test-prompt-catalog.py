#!/usr/bin/env python3
"""Offline catalog checks; no AI client or project code is executed."""
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data/prompts"
KINDS = {"multiplatform_iot", "python_backend", "embedded_iot", "cpp_backend", "android_app", "web_frontend", "web_backend", "devops_infrastructure", "generic"}
LAYERS = {"perception", "episodes", "semantic", "procedures", "meta", "transfer", "evaluation"}


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


class CatalogTests(unittest.TestCase):
    def paths(self):
        return [*CATALOG.glob("main-agents/*.json"), *CATALOG.glob("subagents/*.json"), *CATALOG.glob("cognitive/*/*.json")]

    def test_types(self):
        body = (ROOT / "scripts/orchestrate-project.sh").read_text().split("detect_project_type()", 1)[1].split("# Load main agent", 1)[0]
        self.assertEqual(set(re.findall(r'echo "([a-z_]+)"', body)), KINDS)
        for kind in KINDS:
            self.assertTrue((CATALOG / f"main-agents/main_agent_{kind}.json").is_file())

    def test_fields(self):
        self.assertTrue(self.paths())
        for path in self.paths():
            obj = read(path)
            for key in ("id", "name", "description", "content"):
                self.assertIsInstance(obj[key], str)
                self.assertTrue(obj[key].strip())
            self.assertIs(obj["isTemplate"], False)
            self.assertIsInstance(obj["tags"], list)
            self.assertTrue(all(isinstance(t, str) for t in obj["tags"]))
            self.assertGreater(obj["version"], 0)
            self.assertEqual(obj["metadata"]["language"], "cs")
            self.assertNotIn("{{", obj["content"])

    def test_unique_ids(self):
        seen = set()
        for path in CATALOG.rglob("*.json"):
            if path.name == "index.json":
                continue
            obj = read(path)
            if isinstance(obj, dict) and isinstance(obj.get("id"), str):
                self.assertNotIn(obj["id"], seen, str(path))
                seen.add(obj["id"])

    def test_references(self):
        for kind in KINDS:
            refs = read(CATALOG / f"main-agents/main_agent_{kind}.json")["agentConfig"]["subagents"]
            self.assertEqual(len(set(refs)), 3)
            self.assertEqual(len(refs), 3)
            for ref in refs:
                self.assertRegex(ref, r"^[a-z][a-z0-9_]*$")
                sub = read(CATALOG / f"subagents/{ref}.json")
                self.assertEqual(sub["id"], ref)
                self.assertTrue(sub["description"] and sub["content"])

    def test_layers(self):
        for layer in LAYERS:
            obj = read(CATALOG / f"cognitive/{layer}/orchestration_cognitive_{layer}.json")
            self.assertEqual(obj["metadata"]["category"], "cognitive/" + layer)
            self.assertIn(layer, obj["tags"])

    def test_no_user_paths_or_credentials(self):
        for path in self.paths():
            for forbidden in ("/home/", "sk-live-", "ghp_", "PRIVATE KEY"):
                self.assertNotIn(forbidden, path.read_text())


if __name__ == "__main__":
    unittest.main()
