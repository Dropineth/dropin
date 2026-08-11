/* global process, structuredClone */
import { createHash } from "node:crypto";
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tsModule from "typescript";

const ts = tsModule.default ?? tsModule;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function locationOffsets(sourceFile, location) {
  const lineCount = sourceFile.getLineStarts().length;
  const startLine = Number(location?.start?.line);
  const endLine = Number(location?.end?.line);
  const startColumn = Number(location?.start?.column);
  const endColumn = Number(location?.end?.column);
  if (
    !Number.isInteger(startLine) ||
    !Number.isInteger(endLine) ||
    !Number.isInteger(startColumn) ||
    !Number.isInteger(endColumn) ||
    startLine < 1 ||
    endLine < 1 ||
    startLine > lineCount ||
    endLine > lineCount
  ) {
    return undefined;
  }
  return {
    start: sourceFile.getPositionOfLineAndCharacter(startLine - 1, startColumn),
    end: sourceFile.getPositionOfLineAndCharacter(endLine - 1, endColumn),
  };
}

function contains(outer, inner) {
  return outer.start <= inner.start && outer.end >= inner.end;
}

function overlaps(left, right) {
  return left.start < right.end && right.start < left.end;
}

function collectSyntaxRanges(sourceFile) {
  const imports = [];
  const functionNames = [];
  const functionBodies = [];
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) {
      imports.push({ start: node.getStart(sourceFile), end: node.getEnd() });
    }
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node) ||
      ts.isConstructorDeclaration(node)
    ) {
      functionBodies.push({ start: node.getStart(sourceFile), end: node.getEnd() });
      if ("name" in node && node.name) {
        functionNames.push({
          start: node.name.getStart(sourceFile),
          end: node.name.getEnd(),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { imports, functionNames, functionBodies };
}

function classifySyntheticLocation({
  sourceFile,
  sourceText,
  location,
  syntax,
  coveredBranchRanges,
  allowFunctionName,
}) {
  const offsets = locationOffsets(sourceFile, location);
  if (!offsets) return "outside_source";
  if (syntax.imports.some((range) => contains(range, offsets))) return "import_declaration";

  const fragment = sourceText.slice(offsets.start, offsets.end).trim();
  if (fragment === "}" && offsets.end - offsets.start <= 2) {
    return "non_executable_closing_brace";
  }
  if (
    allowFunctionName &&
    syntax.functionNames.some(
      (range) =>
        range.start === offsets.start &&
        range.end === offsets.end &&
        coveredBranchRanges.some((covered) => contains(covered, range)),
    )
  ) {
    return "duplicate_function_export_binding";
  }
  return undefined;
}

export function normalizeCriticalCoverage({
  root,
  coverage,
  sourceFiles,
}) {
  const normalized = structuredClone(coverage);
  const removals = [];

  for (const configuredFile of sourceFiles) {
    const absolute = realpathSync(path.join(root, configuredFile));
    const coverageKey = Object.keys(normalized).find((candidate) => {
      try {
        return realpathSync(path.isAbsolute(candidate) ? candidate : path.resolve(root, candidate)) === absolute;
      } catch {
        return false;
      }
    });
    if (!coverageKey) continue;

    const fileCoverage = normalized[coverageKey];
    const sourceText = readFileSync(absolute, "utf8");
    const scriptKind = configuredFile.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(
      configuredFile,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    );
    const syntax = collectSyntaxRanges(sourceFile);
    const coveredBranchRanges = Object.entries(fileCoverage.branchMap ?? {})
      .filter(([branchId]) => (fileCoverage.b?.[branchId] ?? []).some((count) => Number(count) > 0))
      .map(([, branch]) => locationOffsets(sourceFile, branch.loc))
      .filter(Boolean);

    for (const [statementId, statementEntry] of Object.entries(
      fileCoverage.statementMap ?? {},
    )) {
      if (Number(fileCoverage.s?.[statementId] ?? 0) > 0) continue;
      const reason = classifySyntheticLocation({
        sourceFile,
        sourceText,
        location: statementEntry,
        syntax,
        coveredBranchRanges,
        allowFunctionName: false,
      });
      if (!reason) continue;
      delete fileCoverage.statementMap[statementId];
      delete fileCoverage.s[statementId];
      removals.push({
        file: configuredFile,
        metric: "statements",
        id: statementId,
        reason,
        location: statementEntry,
      });
    }

    for (const [functionId, functionEntry] of Object.entries(fileCoverage.fnMap ?? {})) {
      if (Number(fileCoverage.f?.[functionId] ?? 0) > 0) continue;
      const location = functionEntry.loc ?? functionEntry.decl;
      const offsets = locationOffsets(sourceFile, location);
      const reason = classifySyntheticLocation({
        sourceFile,
        sourceText,
        location,
        syntax,
        coveredBranchRanges,
        allowFunctionName: false,
      });
      const overlapsExecutableFunction =
        offsets && syntax.functionBodies.some((range) => overlaps(range, offsets));
      if (!reason || overlapsExecutableFunction) continue;
      delete fileCoverage.fnMap[functionId];
      delete fileCoverage.f[functionId];
      removals.push({
        file: configuredFile,
        metric: "functions",
        id: functionId,
        reason,
        location,
      });
    }

    for (const [branchId, branchEntry] of Object.entries(fileCoverage.branchMap ?? {})) {
      const counts = fileCoverage.b?.[branchId] ?? [];
      if (counts.some((count) => Number(count) > 0)) continue;
      const reason = classifySyntheticLocation({
        sourceFile,
        sourceText,
        location: branchEntry.loc,
        syntax,
        coveredBranchRanges,
        allowFunctionName: true,
      });
      if (!reason) continue;
      delete fileCoverage.branchMap[branchId];
      delete fileCoverage.b[branchId];
      removals.push({
        file: configuredFile,
        metric: "branches",
        id: branchId,
        reason,
        location: branchEntry.loc,
      });
    }
  }

  return {
    coverage: normalized,
    audit: {
      schemaVersion: 1,
      policy:
        "Remove only uncovered V8 source-map entries proven to map to imports, non-executable closing braces, out-of-source locations, or duplicate function export bindings with a covered executable body.",
      removalCount: removals.length,
      removals,
      normalizedCoverageHash: sha256(JSON.stringify(normalized)),
    },
  };
}

function runCli() {
  const root = process.cwd();
  const config = JSON.parse(
    readFileSync(path.join(root, "config", "canopyproof-critical-coverage.json"), "utf8"),
  );
  const rawFile = path.join(root, config.rawCoverageFile);
  const outputFile = path.join(root, config.coverageFile);
  const sourceFiles = [...new Set(config.modules.flatMap((module) => module.files))].sort();
  const result = normalizeCriticalCoverage({
    root,
    coverage: JSON.parse(readFileSync(rawFile, "utf8")),
    sourceFiles,
  });
  writeFileSync(outputFile, `${JSON.stringify(result.coverage)}\n`);
  process.stdout.write(`${JSON.stringify(result.audit, null, 2)}\n`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
