import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const flow=fs.readFileSync(".github/workflows/offsite-backup.yml","utf8");
const docs=fs.readFileSync("docs/OFFSITE_BACKUP.md","utf8");

test("offsite backup never runs with untrusted pull-request code",()=>{
 assert.match(flow,/^on:\s*$/m);
 assert.match(flow,/^  schedule:\s*$/m);
 assert.match(flow,/^  workflow_dispatch:\s*$/m);
 assert.doesNotMatch(flow,/^\s+pull_request(_target)?:/m);
 assert.match(flow,/permissions:\s*\n  contents: read/);
 assert.match(flow,/cancel-in-progress: false/);
});
test("unconfigured recipient skips backup and DB URL is a GitHub secret",()=>{
 assert.match(flow,/if:.*vars\.SMART_BUDGET_BACKUP_AGE_RECIPIENT/);
 assert.match(flow,/secrets\.SMART_BUDGET_BACKUP_DATABASE_URL/);
 assert.doesNotMatch(flow,/SUPABASE_DB_URL:\s*postgres(ql)?:\/\//);
 assert.match(flow,/if \[\[ -z "\$\{SUPABASE_DB_URL:-\}"/);
});
test("Postgres dump is streamed to age encryption, no plaintext disk artifact",()=>{
 assert.match(flow,/postgres:17\.6-alpine/);
 for(const schema of ["public","smart_budget_backups","incident_backup_20261116"]){
  assert.ok(flow.includes("--schema="+schema));
 }
 assert.match(flow,/pg_dump/);
 assert.match(flow,/\| "\$age_bin" --encrypt --recipient "\$AGE_RECIPIENT" --output "\$archive"/);
 assert.doesNotMatch(flow,/pg_dump[^\n]*--file=/);
 assert.doesNotMatch(flow,/\.sql(\.gz)?\s*$/m);
});
test("only the encrypted output is uploaded as an expiring artifact",()=>{
 assert.match(flow,/actions\/upload-artifact@v4/);
 assert.match(flow,/path:.*\.dump\.age/);
 assert.match(flow,/if-no-files-found: error/);
 assert.match(flow,/retention-days: 60/);
 assert.doesNotMatch(flow,/git push|git commit|create-release|github\.com\/repos\/.*\/contents/i);
});
test("docs require user-held private identity and an explicit recovery drill",()=>{
 assert.match(docs,/winget install -e --id FiloSottile\.age/);
 assert.match(docs,/age-keygen -o/);
 assert.match(docs,/AGE-SECRET-KEY/);
 assert.match(docs,/pg_restore --list/);
 assert.match(docs,/Session pooler/);
});
