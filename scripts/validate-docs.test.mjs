import assert from "node:assert/strict";
import test from "node:test";
import { validateDocumentation } from "./validate-docs.mjs";

function fixture() {
  return {
    "AGENTS.md": "Lire [la méthode](docs/ASSISTANT_WORKFLOW.md).",
    "README.md": "Version du code : `V2.4.1`\nPreview V2.5 et cache V2.4 sont indépendants.",
    "workstate.md": "Version du code : `V2.4.1`",
    "CHANGELOG.md": "## V2.4.1 — interface\n## V2.4 — cloud",
    "docs/ASSISTANT_WORKFLOW.md": "Lire [le workstate](../workstate.md#etat).",
    "docs/WORKFLOW_AUDIT.md": "Audit [PR](https://github.com/nishiosxn/budget-app/pull/18).",
    "index.html": '<div>Budget foyer · V2.4.1</div><div class="settings-version">V2.4.1 · UI</div>'
  };
}

test("socle cohérent sans dépendance à Git ni au nom de branche", () => {
  assert.deepEqual(validateDocumentation(fixture()), []);
});
test("document absent", () => {
  const files = fixture(); delete files["AGENTS.md"];
  assert.ok(validateDocumentation(files).some(e => e.includes("AGENTS.md manquant")));
});
test("champ absent ou dupliqué", () => {
  for (const value of ["Sans version", "Version du code : `V2.4.1`\nVersion du code : `V2.4.1`"]) {
    assert.ok(validateDocumentation({ ...fixture(), "README.md": value }).some(e => e.includes("unique champ")));
  }
});
test("version workstate différente", () => {
  assert.ok(validateDocumentation({ ...fixture(), "workstate.md": "Version du code : `V2.5`" }).some(e => e.includes("différentes")));
});
test("un seul marqueur UI périmé fait échouer la validation", () => {
  const files = fixture(); files["index.html"] += "<div>Budget foyer · V2.4</div>";
  assert.ok(validateDocumentation(files).some(e => e.includes("version affichée")));
});
test("changelog exige la version exacte, pas son préfixe", () => {
  assert.ok(validateDocumentation({ ...fixture(), "CHANGELOG.md": "## V2.4.10 — autre" }).some(e => e.includes("entrée V2.4.1 absente")));
});
test("liens relatifs résolus depuis leur document, ancres et URLs tolérées", () => {
  const files = fixture();
  files["docs/ASSISTANT_WORKFLOW.md"] += " [README](../README.md?view=1#etat) [ici](#etat)";
  assert.deepEqual(validateDocumentation(files), []);
  files["docs/ASSISTANT_WORKFLOW.md"] += " [absent](../inexistant.md)";
  assert.ok(validateDocumentation(files).some(e => e.includes("lien local absent")));
});
test("exemples de liens en bloc de code ignorés", () => {
  const files = fixture(); files["AGENTS.md"] += "\n```md\n[exemple](absent.md)\n```";
  assert.deepEqual(validateDocumentation(files), []);
});
test("V1 legacy sans marqueur UI conserve les contrôles documentaires", () => {
  const files = fixture();
  files["README.md"] = files["workstate.md"] = "Version du code : `V1`";
  files["CHANGELOG.md"] = "## V1 — production";
  files["index.html"] = "<h1>Budget foyer</h1>";
  assert.deepEqual(validateDocumentation(files, { modular: false }), []);
  assert.ok(validateDocumentation(files).some(e => e.includes("version affichée")));
  delete files["docs/WORKFLOW_AUDIT.md"];
  assert.ok(validateDocumentation(files, { modular: false }).some(e => e.includes("manquant")));
});
