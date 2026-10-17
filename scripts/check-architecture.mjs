import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const layers = new Set(['domain', 'application', 'features', 'shared']);
const dependencies = {
  domain: new Set(['domain']),
  application: new Set(['application', 'domain']),
  shared: new Set(['shared']),
  features: new Set(['features', 'application', 'domain', 'shared']),
  composition: new Set(['composition', ...layers]),
};
const browserGlobals = new Set([
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'performance',
]);
const timers = new Set([
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'queueMicrotask',
]);

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.(?:ts|tsx)$/.test(entry.name) && !/\.(?:spec|test|d)\.ts$/.test(entry.name)
      ? [file]
      : [];
  });
}

function boundary(root, file) {
  const relative = path.relative(path.join(root, 'src'), file).split(path.sep);
  if (relative[0] === '..' || path.isAbsolute(relative[0])) return { layer: 'outside' };
  if (relative[0] !== 'app' || relative.length === 2) return { layer: 'composition' };
  return {
    layer: layers.has(relative[1]) ? relative[1] : 'unknown',
    feature: relative[1] === 'features' ? relative[2] : undefined,
  };
}

function imports(sourceFile) {
  const result = [];
  const add = (expression, node) => {
    result.push({
      specifier: expression && ts.isStringLiteralLike(expression) ? expression.text : null,
      node,
    });
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) add(node.moduleSpecifier, node);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      add(node.moduleReference.expression, node);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      add(node.argument.literal, node);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      add(node.arguments[0], node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return result;
}

function isReference(node) {
  const parent = node.parent;
  return !(
    (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
    ((ts.isPropertyAssignment(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isMethodDeclaration(parent)) &&
      parent.name === node) ||
    (ts.isImportSpecifier(parent) && parent.propertyName === node)
  );
}

/** Checks the real compiler paths; exported so fixtures exercise the same checker as CI. */
export function checkArchitecture(projectRoot) {
  const root = realpathSync(projectRoot);
  const configFile = path.join(root, 'tsconfig.json');
  const config = ts.readConfigFile(configFile, ts.sys.readFile);
  if (config.error)
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const options = parsed.options;
  const aliasPrefixes = Object.keys(options.paths ?? {}).map((alias) => alias.split('*')[0]);
  const diagnostics = [];
  const report = (sourceFile, node, code, message) => {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    diagnostics.push({
      file: path.relative(root, sourceFile.fileName),
      line: position.line + 1,
      column: position.character + 1,
      code,
      message,
    });
  };

  for (const file of sourceFiles(path.join(root, 'src'))) {
    const sourceFile = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const source = boundary(root, file);
    if (source.layer === 'unknown') {
      report(
        sourceFile,
        sourceFile,
        'unknown-layer',
        'Place application code in a declared layer.',
      );
      continue;
    }

    for (const { specifier, node } of imports(sourceFile)) {
      if (specifier === null) {
        report(
          sourceFile,
          node,
          'dynamic-path',
          'Import paths must be string literals for boundary checks.',
        );
        continue;
      }
      const local =
        specifier.startsWith('.') ||
        path.isAbsolute(specifier) ||
        aliasPrefixes.some((prefix) => specifier.startsWith(prefix));
      const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule;
      if (!resolved || resolved.isExternalLibraryImport) {
        if (
          local ||
          (!resolved && specifier.startsWith('@') && !specifier.startsWith('@angular/'))
        ) {
          report(
            sourceFile,
            node,
            'unresolved-import',
            `Cannot resolve local import "${specifier}".`,
          );
        } else if (source.layer === 'domain') {
          report(
            sourceFile,
            node,
            'domain-external',
            `Domain must be pure TypeScript: "${specifier}" is external.`,
          );
        } else if (source.layer === 'shared' && !specifier.startsWith('@angular/')) {
          report(
            sourceFile,
            node,
            'shared-external',
            `Shared may only depend on Angular and shared code: "${specifier}".`,
          );
        }
        continue;
      }

      const target = boundary(root, realpathSync(resolved.resolvedFileName));
      if (!dependencies[source.layer]?.has(target.layer)) {
        report(
          sourceFile,
          node,
          'layer-direction',
          `${source.layer} cannot depend on ${target.layer}: "${specifier}".`,
        );
      }
      if (
        source.layer === 'features' &&
        target.layer === 'features' &&
        source.feature !== target.feature
      ) {
        report(
          sourceFile,
          node,
          'feature-isolation',
          `Features are isolated: "${specifier}" belongs to another feature.`,
        );
      }
      if (specifier.startsWith('.') && source.layer !== target.layer) {
        report(sourceFile, node, 'cross-layer-relative', `Use a layer alias for "${specifier}".`);
      }
    }

    if (source.layer === 'domain') {
      const visit = (node) => {
        if (
          ts.isIdentifier(node) &&
          isReference(node) &&
          (browserGlobals.has(node.text) || timers.has(node.text))
        ) {
          report(
            sourceFile,
            node,
            'domain-runtime',
            `Domain cannot use runtime global "${node.text}"; pass time/data in explicitly.`,
          );
        }
        if (
          ts.isPropertyAccessExpression(node) &&
          ts.isIdentifier(node.expression) &&
          ['globalThis', 'self'].includes(node.expression.text) &&
          (browserGlobals.has(node.name.text) || timers.has(node.name.text))
        ) {
          report(
            sourceFile,
            node,
            'domain-runtime',
            `Domain cannot use runtime global "${node.getText(sourceFile)}".`,
          );
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
    }
  }
  return diagnostics;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const diagnostics = checkArchitecture(process.cwd());
  for (const diagnostic of diagnostics) {
    console.error(
      `${diagnostic.file}:${diagnostic.line}:${diagnostic.column} [${diagnostic.code}] ${diagnostic.message}`,
    );
  }
  if (diagnostics.length > 0) {
    console.error(`Architecture check failed: ${diagnostics.length} violation(s).`);
    process.exitCode = 1;
  } else {
    console.log('Architecture boundaries verified.');
  }
}
