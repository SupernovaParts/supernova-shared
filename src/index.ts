// supernova-shared — public entry
//
// Zwei Quellen werden hier exportiert:
// 1. ./types/api  — TypeScript-Types aus der OpenAPI-Spec der supernova-api (codegen).
// 2. ./schema     — Drizzle/Zod Master-Schema (Single Source of Truth fuer Frontends).

export type * from "./types/api.js";
export * from "./schema.js";

// Convenience-Aliase: haeufig gebrauchte OpenAPI-Schemas direkt unter eigenen Namen exportieren,
// damit Frontend-Code `import { Job, Part } from '@supernova/shared'` schreiben kann.
import type { components } from "./types/api.js";

export type Schemas = components["schemas"];

// Beispiele — bei Bedarf erweitern, sobald Frontends konkrete Modelle brauchen.
// Die genauen Schema-Namen stehen in src/types/api.ts (nach `npm run generate-types`).
//
// export type Job = Schemas["Job"];
// export type Part = Schemas["Part"];
// export type LoginRequest = Schemas["LoginRequest"];
