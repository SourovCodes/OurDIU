// Writes the API's OpenAPI document to apps/api/openapi.json, the file the mobile
// app's Dart client is generated from. A test fails when the committed copy is stale.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { createApp } from "../src/app";
import { openApiConfig } from "../src/lib/openapi";

const doc = createApp().getOpenAPI31Document(openApiConfig);
const out = path.join(import.meta.dirname, "../openapi.json");
writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`);
console.log(`Wrote ${out}`);
