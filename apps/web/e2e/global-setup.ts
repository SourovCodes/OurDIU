import { createSessionPool } from "./sessions";

// Runs once the dev servers are up but before any test sends a request.
export default function globalSetup() {
  createSessionPool();
}
