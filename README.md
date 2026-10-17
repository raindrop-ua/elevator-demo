# ElevatorDemo

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.2.0.

## Setup

Use Node.js 24 LTS and pnpm 12.14.0 (pinned in `package.json`).

```bash
npm install --global pnpm@12.14.0
pnpm install --frozen-lockfile
```

## Development server

To start a local development server, run:

```bash
pnpm start
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
pnpm exec ng generate component component-name
```

The project uses classic Angular naming for both files and symbols:

- Components: `example.component.ts` → `ExampleComponent`.
- Directives: `example.directive.ts` → `ExampleDirective`.
- Services: `example.service.ts` → `ExampleService`.
- Pipes: `example.pipe.ts` → `ExamplePipe`.
- Modules: `example.module.ts` → `ExampleModule`.
- Guards, interceptors and resolvers: `example.guard.ts`, `example.interceptor.ts`, `example.resolver.ts`, with the corresponding `Guard`, `Interceptor` and `Resolver` suffixes. Functional generators remain enabled.

These defaults are configured in `angular.json` and apply to future CLI generation.

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
pnpm exec ng generate --help
```

## Building

To build the project run:

```bash
pnpm build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
pnpm test --watch=false
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
pnpm exec ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
