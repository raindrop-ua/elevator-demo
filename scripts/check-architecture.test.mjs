import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import { checkArchitecture } from './check-architecture.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const { config } = ts.parseConfigFileTextToJson(
  'tsconfig.json',
  readFileSync(path.join(projectRoot, 'tsconfig.json'), 'utf8'),
);

function fixture(t, files, configure = () => {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'elevator-architecture-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const compilerOptions = structuredClone(config.compilerOptions);
  configure(compilerOptions);
  const contents = {
    'tsconfig.json': JSON.stringify({ compilerOptions }),
    'src/app/domain/model.ts': 'export class Model {}',
    'src/app/application/store.ts': 'export class Store {}',
    'src/app/shared/icon.ts': 'export class Icon {}',
    'src/app/features/simulator/view.ts': 'export class View {}',
    'src/app/features/settings/view.ts': 'export class Settings {}',
    ...files,
  };
  for (const [name, content] of Object.entries(contents)) {
    const target = path.join(root, name);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return checkArchitecture(root);
}

test('configured aliases resolve without baseUrl and preserve allowed layer directions', (t) => {
  assert.equal(config.compilerOptions.baseUrl, undefined);
  assert.equal(config.compilerOptions.strict, true);
  assert.equal(config.angularCompilerOptions.strictTemplates, true);
  assert.deepEqual(
    fixture(t, {
      'src/app/application/store.ts':
        "import { Model } from '@domain/model'; export class Store {}",
      'src/app/shared/icon.ts': "import { Component } from '@angular/core'; export class Icon {}",
      'src/app/features/simulator/view.ts': [
        "import { Model } from '@domain/model';",
        "import { Store } from '@application/store';",
        "import { Icon } from '@shared/icon';",
        "import { Part } from './part';",
      ].join('\n'),
      'src/app/features/simulator/part.ts': 'export class Part {}',
      'src/app/app.component.ts': "import { View } from '@features/simulator/view';",
    }),
    [],
  );
});

const importForms = {
  static: (target) => `import { Model } from '${target}';`,
  'type-only': (target) => `import type { Model } from '${target}';`,
  're-export': (target) => `export { Model } from '${target}';`,
  'star re-export': (target) => `export * from '${target}';`,
  dynamic: (target) => `const model = import('${target}');`,
  'template-literal dynamic': (target) => 'const model = import(`' + target + '`);',
  'inline type': (target) => `type Model = import('${target}').Model;`,
  require: (target) => `const model = require('${target}');`,
  'import equals': (target) => `import model = require('${target}');`,
};

for (const [name, statement] of Object.entries(importForms)) {
  test(`${name}: resolves an allowed alias`, (t) => {
    assert.deepEqual(
      fixture(t, {
        'src/app/application/consumer.ts': statement('@domain/model'),
      }),
      [],
    );
  });
  test(`${name}: catches a forbidden dependency`, (t) => {
    const violations = fixture(t, {
      'src/app/shared/consumer.ts': statement('@domain/model'),
    });
    assert.equal(violations.length, 1);
    assert.equal(violations[0].code, 'layer-direction');
  });
}

for (const [source, target] of [
  ['domain/consumer.ts', '@application/store'],
  ['domain/consumer.ts', '@features/simulator/view'],
  ['application/consumer.ts', '@features/simulator/view'],
  ['application/consumer.ts', '@shared/icon'],
  ['shared/consumer.ts', '@application/store'],
]) {
  test(`${source} cannot import ${target}`, (t) => {
    assert.ok(
      fixture(t, { [`src/app/${source}`]: `import '${target}';` }).some(
        (diagnostic) => diagnostic.code === 'layer-direction',
      ),
    );
  });
}

test('same-layer relative imports are allowed', (t) => {
  assert.deepEqual(
    fixture(t, {
      'src/app/domain/nested/consumer.ts': "import { Model } from '../model';",
    }),
    [],
  );
});

test('cross-layer relative imports require an alias, even when the direction is allowed', (t) => {
  const result = fixture(t, {
    'src/app/application/store.ts': "import { Model } from '../domain/model';",
  });
  assert.deepEqual(
    result.map((diagnostic) => diagnostic.code),
    ['cross-layer-relative'],
  );
});

for (const target of ['@features/settings/view', '../settings/view']) {
  test(`feature isolation blocks ${target}`, (t) => {
    assert.ok(
      fixture(t, {
        'src/app/features/simulator/consumer.ts': `import '${target}';`,
      }).some((diagnostic) => diagnostic.code === 'feature-isolation'),
    );
  });
}

for (const target of ['@domain/missing', './missing', '@unknown/model']) {
  test(`unresolved import fails: ${target}`, (t) => {
    assert.ok(
      fixture(t, {
        'src/app/application/consumer.ts': `import '${target}';`,
      }).some((diagnostic) => diagnostic.code === 'unresolved-import'),
    );
  });
}

test('the checker follows actual alias targets instead of assuming names imply layers', (t) => {
  const result = fixture(
    t,
    {
      'src/app/application/consumer.ts': "import '@domain/model';",
      'src/app/shared/model.ts': 'export class Model {}',
    },
    (options) => {
      options.paths['@domain/*'] = ['./src/app/shared/*'];
    },
  );
  assert.ok(result.some((diagnostic) => diagnostic.code === 'layer-direction'));
});

for (const statement of [
  "import { Injectable } from '@angular/core';",
  "import { Observable } from 'rxjs';",
  "import fs from 'node:fs';",
]) {
  test(`domain rejects external packages: ${statement}`, (t) => {
    assert.ok(
      fixture(t, { 'src/app/domain/consumer.ts': statement }).some(
        (diagnostic) => diagnostic.code === 'domain-external',
      ),
    );
  });
}

for (const statement of [
  'window.location;',
  'document.title;',
  'performance.now();',
  'setTimeout(() => {}, 1);',
  'requestAnimationFrame(() => {});',
  'globalThis.setInterval(() => {}, 1);',
  'const clock = setTimeout;',
]) {
  test(`domain rejects runtime dependency: ${statement}`, (t) => {
    assert.ok(
      fixture(t, { 'src/app/domain/consumer.ts': statement }).some(
        (diagnostic) => diagnostic.code === 'domain-runtime',
      ),
    );
  });
}

test('runtime APIs are allowed in the application adapter', (t) => {
  assert.deepEqual(
    fixture(t, {
      'src/app/application/clock.ts': 'requestAnimationFrame(() => {}); performance.now();',
    }),
    [],
  );
});

test('shared rejects a non-Angular external package', (t) => {
  assert.ok(
    fixture(t, {
      'src/app/shared/consumer.ts': "import { readFile } from 'node:fs';",
    }).some((diagnostic) => diagnostic.code === 'shared-external'),
  );
});

test('tests can use Angular test helpers regardless of the layer under test', (t) => {
  assert.deepEqual(
    fixture(t, {
      'src/app/domain/model.spec.ts': "import { TestBed } from '@angular/core/testing';",
    }),
    [],
  );
});

test('computed imports cannot bypass the checker', (t) => {
  assert.ok(
    fixture(t, {
      'src/app/domain/consumer.ts': 'const name = "whatever"; import(name);',
    }).some((diagnostic) => diagnostic.code === 'dynamic-path'),
  );
});

test('new undeclared layers fail until their boundary rules are defined', (t) => {
  assert.ok(
    fixture(t, {
      'src/app/misc/consumer.ts': 'export class Unknown {}',
    }).some((diagnostic) => diagnostic.code === 'unknown-layer'),
  );
});

test('diagnostics identify the source line', (t) => {
  const violations = fixture(t, {
    'src/app/application/consumer.ts': "// first line\nimport './missing';",
  });
  assert.equal(violations[0].file, 'src/app/application/consumer.ts');
  assert.equal(violations[0].line, 2);
  assert.equal(violations[0].column, 1);
});
