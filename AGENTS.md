# Project architecture rules

Follow the layer boundaries and dependency rules in [README.md](README.md#project-structure).

## Angular component files

- Always create each new component as three separate files with the same basename:
  `example.component.ts`, `example.component.html`, and `example.component.css`.
- Keep the component class and metadata in `.ts`, the template in `.html`, and styles in
  `.css`. Reference the external files through `templateUrl` and `styleUrl` (or `styleUrls`).
- Do not put inline `template` or `styles` in component TypeScript files, even for small
  components or test components.
- Keep the separate `.css` file even when it is initially empty.
- When modifying an existing component with an inline template or styles, move them into
  the corresponding external files while preserving its behavior and appearance.
