#!/usr/bin/env node
// Fails when files contain Supabase secrets (architecture.md §11).
//
//   node scripts/check-secrets.mjs            scan tracked and untracked, non-ignored files (CI)
//   node scripts/check-secrets.mjs --staged   scan staged content (pre-commit hook)
//   node scripts/check-secrets.mjs <file...>  scan the given files
//
// Findings report the file, line and rule, never the secret itself.

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "0.0.0.0", "::1"]);
const PLACEHOLDER = /^(\[.*\]|<.*>|\$\{.*\}|\*+|x+)$/i;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function jwtRole(payloadSegment) {
  try {
    const json = Buffer.from(payloadSegment, "base64url").toString("utf8");
    return JSON.parse(json).role;
  } catch {
    return undefined;
  }
}

/**
 * @typedef {{ id: string, description: string, pattern: RegExp,
 *   isSecret?: (match: RegExpMatchArray) => boolean }} Rule
 * @type {Rule[]}
 */
export const RULES = [
  {
    id: "supabase-secret-key",
    description: "Supabase secret API key",
    pattern: /\bsb_secret_[A-Za-z0-9_-]{20,}/g,
  },
  {
    id: "supabase-access-token",
    description: "Supabase personal access token",
    pattern: /\bsbp_[A-Za-z0-9]{40,}\b/g,
  },
  {
    id: "service-role-jwt",
    description: "Supabase service_role JWT",
    pattern:
      /\beyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]+/g,
    isSecret: (match) => jwtRole(match[1]) === "service_role",
  },
  {
    id: "database-url-password",
    description: "PostgreSQL connection string with a password",
    pattern: /\bpostgres(?:ql)?:\/\/[^\s:@/]+:([^\s@/]+)@([^\s:/?#]+)/g,
    isSecret: (match) =>
      !PLACEHOLDER.test(match[1]) && !LOCAL_HOSTS.has(match[2]),
  },
];

/**
 * @param {string} text
 * @returns {{ rule: string, description: string, line: number }[]}
 */
export function findSecrets(text) {
  const findings = [];
  for (const rule of RULES) {
    for (const match of text.matchAll(rule.pattern)) {
      if (rule.isSecret && !rule.isSecret(match)) continue;
      const line = text.slice(0, match.index).split("\n").length;
      findings.push({ rule: rule.id, description: rule.description, line });
    }
  }
  return findings.sort((a, b) => a.line - b.line);
}

function isBinary(buffer) {
  return buffer.subarray(0, 8000).includes(0);
}

function git(args) {
  return execFileSync("git", args, { maxBuffer: 256 * 1024 * 1024 });
}

function nulSeparated(buffer) {
  return buffer.toString("utf8").split("\0").filter(Boolean);
}

function* sources(argv) {
  if (argv[0] === "--staged") {
    const paths = nulSeparated(
      git(["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"]),
    );
    for (const path of paths) yield [path, () => git(["show", `:${path}`])];
    return;
  }
  const paths =
    argv.length > 0
      ? argv
      : nulSeparated(
          git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"]),
        );
  for (const path of paths) {
    yield [
      path,
      () => {
        const stat = statSync(path, { throwIfNoEntry: false });
        return stat?.isFile() ? readFileSync(path) : null;
      },
    ];
  }
}

function main(argv) {
  let scanned = 0;
  const problems = [];
  for (const [path, read] of sources(argv)) {
    const buffer = read();
    if (!buffer || buffer.length > MAX_FILE_BYTES || isBinary(buffer)) continue;
    scanned += 1;
    for (const finding of findSecrets(buffer.toString("utf8"))) {
      problems.push(
        `${path}:${finding.line}  ${finding.description} (${finding.rule})`,
      );
    }
  }
  if (problems.length > 0) {
    console.error("Possible secrets found:\n");
    for (const problem of problems) console.error(`  ${problem}`);
    console.error(
      "\nRemove them before committing. If a real secret was ever committed or" +
        " pushed, rotate it in the Supabase dashboard; deleting it from Git is not enough.",
    );
    return 1;
  }
  console.log(`check-secrets: no secrets found in ${scanned} files.`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
