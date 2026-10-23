import { configure } from "@testing-library/react";

// Menus and sheets load their code on first use (docs/PLAN.md, decision 47), which
// can take over a second while `pnpm check` runs the API's tests alongside; the
// default one-second wait for `findBy…` then fails at random.
configure({ asyncUtilTimeout: 4000 });
