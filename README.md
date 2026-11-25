<a href="https://schema.postman.com" target="_blank"><img src="https://s3.amazonaws.com/web-artefacts/postman-logo%2Btext-197x68.png" /></a>

# Postman Schemas

Repository of all schemas for JSON structures compatible with Postman (such as the Postman Collection Format). The schemas are also hosted online, at [schema.postman.com](https://schema.postman.com): the documentation for a version lives at `/collection/<version>` (e.g. [/collection/v2.1.0](https://schema.postman.com/collection/v2.1.0)) and its raw JSON Schema at `/collection/<version>/collection.json`. 

## Schema Viewer

This repository ships a [TanStack Start](https://tanstack.com/start) (React) app that renders every schema version using the [Stoplight JSON Schema Viewer](https://github.com/stoplightio/json-schema-viewer).

Requirements: Node.js `24` (see `.nvmrc`) and [pnpm](https://pnpm.io).

```
nvm use            # switch to Node 24
pnpm install       # install dependencies
pnpm dev           # start the dev server at http://localhost:3000
pnpm build         # production build for Cloudflare Workers (dist/), prerenders the docs pages
pnpm preview       # serve the last build locally in the Workers runtime
pnpm run preview:cf  # build, then serve it with wrangler dev
pnpm run deploy      # build and deploy the "schemas" Worker (production!)
```

Use `pnpm run deploy`, not `pnpm deploy`: pnpm 10's built-in `deploy` command takes precedence over the script. `pnpm run deploy` publishes straight to the production Worker; use `pnpm run preview:cf` to try a build locally.

The redirects from the old URLs (e.g. `/collection/json/<version>/draft-07/docs/index.html`) live in a generated `public/_redirects` file. `pnpm preview`, `wrangler dev` and Cloudflare apply it; `pnpm dev` does not, so old URLs 404 there.

Each schema under `schemas/<draft>/<version>/` is compiled into a single document (sibling definitions merged, `$ref`s kept, not dereferenced) by `pnpm generate:schemas` (run automatically before `dev`/`build`), which reuses the tooling in `lib/`. The compiled output and a manifest are written to `src/generated/` (git-ignored).

The underlying schema tooling is still available directly:

```
pnpm compile --schema <file> --schema-dir <dir> --output <file> [--draft-version <draft>]
pnpm validate --input <file> --schema <file> --schema-dir <dir> [--draft-version <draft>]
```

The draft (`draft-04` or `draft-07`) is read from the schema's `$schema` when `--draft-version` is omitted. `validate` exits 1 when validation fails.

## Usage

All the schemas in this repository are valid JSON Schemas. Each collection version is published at:

```
https://schema.postman.com/collection/<version>/collection.json
```

- `<version>`: `v1.0.0`, `v2.0.0`, `v2.1.0` or `v3.0.0`
- These are the [draft-07](https://json-schema.org/specification-links) schemas. Each version also has a viewer at `/collection/<version>`.

For example, https://schema.postman.com/collection/v2.1.0/collection.json.

The draft-04 files are still served at their old paths, `/collection/json/<version>/draft-04/collection.json` and `/json/collection/<version>/collection.json` (v3.0.0 is draft-07 only).

They can be used with any JSON Schema validator, as shown below.

### Filesystem (YAML) schemas

The v3.0.0 on-disk YAML format has one schema per file kind:

| Kind | URL | Glob |
|---|---|---|
| definition | `/collection/v3.0.0/fs/definition.json` | `**/.resources/definition.{yaml,yml}` |
| request | `/collection/v3.0.0/fs/request.json` | `**/*.request.{yaml,yml}` |
| example | `/collection/v3.0.0/fs/example.json` | `**/.resources/*.resources/examples/*.example.{yaml,yml}` |
| message | `/collection/v3.0.0/fs/message.json` | `**/.resources/*.resources/messages/*.message.{yaml,yml}` |

VS Code (yaml-language-server):

```json
"yaml.schemas": {
  "https://schema.postman.com/collection/v3.0.0/fs/definition.json": "**/.resources/definition.{yaml,yml}",
  "https://schema.postman.com/collection/v3.0.0/fs/request.json": "**/*.request.{yaml,yml}",
  "https://schema.postman.com/collection/v3.0.0/fs/example.json": "**/.resources/*.resources/examples/*.example.{yaml,yml}",
  "https://schema.postman.com/collection/v3.0.0/fs/message.json": "**/.resources/*.resources/messages/*.message.{yaml,yml}"
}
```

Per-file modeline (the first line of the YAML file):

```yaml
# yaml-language-server: $schema=https://schema.postman.com/collection/v3.0.0/fs/request.json
$kind: http-request
method: POST
url: "{{baseUrl}}/users"
```

Ajv + js-yaml (`npm install ajv js-yaml`):

```js
import Ajv from 'ajv';
import { load } from 'js-yaml';
import { glob, readFile } from 'node:fs/promises';

const schema = await (await fetch('https://schema.postman.com/collection/v3.0.0/fs/request.json')).json();
const validate = new Ajv({ strict: false }).compile(schema);

for await (const file of glob('postman/collections/**/*.request.{yaml,yml}')) {
  if (!validate(load(await readFile(file, 'utf8')))) console.error(file, validate.errors);
}
```

### Example: JavaScript

With [Ajv](https://ajv.js.org) 8 (`npm install ajv`) on Node.js 18+ (global `fetch`), as an ES module:

```js
import Ajv from 'ajv';

const input = {
    /* JSON of a v2.1.0 collection */
};

const schema = await (await fetch('https://schema.postman.com/collection/v2.1.0/collection.json')).json();

// strict: false, because the v1/v2 schemas use keywords that Ajv's strict mode rejects
const validate = new Ajv({ strict: false }).compile(schema);

console.log(validate(input) ? 'It is a valid collection!' : 'It is not a valid collection!');
```

For the `draft-04` schemas, use `import Ajv from 'ajv-draft-04'` (`npm install ajv-draft-04`) instead.

### Example: Python

With [jsonschema](https://github.com/python-jsonschema/jsonschema) (`pip install jsonschema requests`), which picks the draft from the schema's `$schema`:

```python
import requests
from jsonschema import validate
from jsonschema.exceptions import ValidationError

schema = requests.get('https://schema.postman.com/collection/v2.1.0/collection.json').json()

test_input = {}  # Whatever needs to be validated.

try:
    validate(test_input, schema)
except ValidationError:
    print('It is not a valid collection!')
else:
    print('It is a valid collection!')
```

### Maintainers

Updating the filesystem schemas requires npm access to `@postman` (the package is restricted).

```
pnpm sync:fs-schemas @postman/v3.schemas@<version>
pnpm test
git add vendor && git commit -m "Vendor @postman/v3.schemas <version>"
```

`vendor/@postman/v3.schemas/provenance.json` records the package name, version and integrity hash. Re-running with the same input leaves `git status` clean.
