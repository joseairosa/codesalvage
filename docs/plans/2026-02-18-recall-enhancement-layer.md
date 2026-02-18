# Recall Enhancement Layer — Remote Methodology & Plan Management

Created: 2026-02-18
Status: PENDING
Approved: No
Iterations: 0
Worktree: No

> **Status Lifecycle:** PENDING -> COMPLETE -> VERIFIED
> **Iterations:** Tracks implement->verify cycles (incremented by verify phase)
>
> - PENDING: Initial state, awaiting implementation
> - COMPLETE: All tasks implemented
> - VERIFIED: All checks passed
>
> **Approval Gate:** Implementation CANNOT proceed until `Approved: Yes`
> **Worktree:** Set at plan creation (from dispatcher). `Yes` uses git worktree isolation; `No` works directly on current branch (default)

## Summary

**Goal:** Evolve Recall MCP from a pure memory service into a comprehensive remote enhancement layer for AI coding agents. Add three new capability domains: (1) Methodology Serving — store and serve development methodology prompts (brainstorming, debugging, code review, TDD) as versioned, team-shared templates; (2) Plan Management — persist implementation plans as first-class entities with task-level status tracking that survives sessions; (3) Review Audit Trail — store structured code review findings linked to workflows/plans with quality gate configuration per workspace.

**Architecture:** Each domain gets its own tool module (`src/tools/methodology-tools.ts`, `src/tools/plan-tools.ts`, `src/tools/review-tools.ts`), service (`src/services/methodology.service.ts`, `src/services/plan.service.ts`, `src/services/review.service.ts`), and persistence layer (Redis hashes + sorted sets following existing `StorageKeys` pattern). Methodology templates are workspace-scoped with optional global (built-in) defaults. Plans link to workflows and contain structured tasks with status tracking. Reviews link to both plans and workflows, creating a full audit trail. All tools follow the existing thin-handler + service delegation pattern. Plan limits are extended to gate methodology and plan counts by tier.

**Tech Stack:** TypeScript, Redis/Valkey (persistence via `StorageClient`), Zod (validation), Express (REST API), MCP protocol (tools + prompts + resources), Vitest (testing)

## Scope

### In Scope

**Phase 1 — Methodology Serving (6 tasks)**

- `MethodologyTemplate` schema and storage keys in `src/types.ts`
- `MethodologyStore` persistence layer for CRUD + search + versioning
- `MethodologyService` business logic (create, get, list, fork, version)
- `methodology-tools.ts` MCP tool handlers (5 tools)
- Built-in methodology seed data (brainstorming, systematic-debugging, tdd, code-review, plan-writing)
- Plan limits extension: methodology count per tier
- Tests for service + tools

**Phase 2 — Plan Management (6 tasks)**

- `Plan` and `PlanTask` schemas and storage keys in `src/types.ts`
- `PlanStore` persistence layer for plans and tasks
- `PlanService` business logic (create, get, update task status, link to workflow)
- `plan-tools.ts` MCP tool handlers (7 tools)
- MCP prompt for plan workflow guidance
- Plan limits extension: plan count per tier
- Tests for service + tools

**Phase 3 — Review Audit Trail (5 tasks)**

- `ReviewFinding` and `QualityGate` schemas and storage keys in `src/types.ts`
- `ReviewStore` persistence layer
- `ReviewService` business logic (store review, get history, configure gates)
- `review-tools.ts` MCP tool handlers (5 tools)
- Tests for service + tools

**Phase 4 — Integration & Intelligence (3 tasks)**

- Enhance `auto_session_start` to detect task type and recommend methodologies
- MCP prompt for the enhancement layer overview
- REST API endpoints for dashboard visibility (methodology list, plan status, review history)

### Out of Scope

- UI dashboard pages for methodologies/plans/reviews (future work)
- Subagent orchestration (remains local to Claude Code/Pilot)
- Git/filesystem operations (remains local)
- TDD cycle enforcement at execution time (remains local rules)
- Methodology marketplace or community sharing (future feature)
- Migration of existing workflow data to new plan format
- Changes to existing memory CRUD tools

## Prerequisites

- Current main branch with workspace linking PR merged (if in flight)
- Working vitest test infrastructure (`npm test`)
- Existing tool module pattern established (`src/tools/*.ts`)
- Existing service pattern established (`src/services/*.ts`)

## Context for Implementer

> This section is critical for cross-session continuity.

### Patterns to Follow

- **Tool modules:** Follow `src/tools/workflow-tools.ts` pattern — thin handlers that delegate to a service. Each module exports a `set*MemoryStore(store)` initializer and a `*Tools` object spread into `src/tools/index.ts`.
- **Services:** Follow `src/services/workflow.service.ts` pattern — takes `MemoryStore` in constructor, stateless, all persistence via store methods.
- **Storage keys:** Follow `StorageKeys` and `WorkflowStorageKeys` pattern in `src/types.ts` — static object with key factory functions using `ws:${workspace}:` prefix.
- **Schemas:** Follow Zod schema pattern in `src/types.ts` — define schema + infer type + export both.
- **Tool registration:** In `src/tools/index.ts`, import the tools object, call `set*MemoryStore(store)` in `setMemoryStore()`, and spread `...newTools` into the `tools` export.
- **Tests:** Follow `src/services/rlm.service.test.ts` pattern — mock `MemoryStore`, test service methods.
- **IDs:** Always ULID via `ulid()` from `ulid` package.
- **Error handling:** Tool handlers use `try/catch`, return `{ content: [{ type: 'text', text }], isError: true }` on error.
- **MCP Prompts:** Follow `src/prompts/index.ts` pattern — export handler functions that return `{ description, messages }`.

### Key Files

| File                                | Purpose                                         | Relevant Lines                                       |
| ----------------------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| `src/types.ts`                      | All Zod schemas, types, storage keys            | `StorageKeys` at L278, `WorkflowStorageKeys` at L741 |
| `src/tools/index.ts`                | Tool registry, `setMemoryStore()` wiring        | `setMemoryStore` function, `tools` export            |
| `src/tools/workflow-tools.ts`       | Reference pattern for new tool modules          | Full file — thin handlers + service delegation       |
| `src/services/workflow.service.ts`  | Reference pattern for new services              | Full file — constructor DI, async methods            |
| `src/persistence/workflow-store.ts` | Reference pattern for new stores                | Full file — Redis hash + sorted set operations       |
| `src/persistence/memory-store.ts`   | MemoryStore constructor and workspace scoping   | Constructor at L42, `createMemory` pattern           |
| `src/prompts/index.ts`              | MCP prompt definitions                          | `prompts` object, `listPrompts`, `getPrompt`         |
| `src/http/types.ts`                 | `PLAN_LIMITS` constant, `TenantContext`         | `PLAN_LIMITS` at L50                                 |
| `src/http/server.ts`                | REST API endpoint definitions                   | Workspace endpoints pattern at L1977+                |
| `src/http/mcp-handler.ts`           | MCP session handler, per-tenant store injection | `setMemoryStore` call pattern                        |

### Gotchas

- `MemoryStore` is injected per-request in HTTP mode via `setMemoryStore()` — all new tool modules must follow the same DI pattern with their own `set*MemoryStore()` function.
- Tool descriptions are critical — they appear in the LLM's context and instruct when/how to use the tool. Keep them concise but informative.
- The `tools` export in `src/tools/index.ts` is a flat object — tool names must be globally unique. Use prefixes: `get_methodology`, `store_plan`, `store_review`, etc.
- Sorted sets use timestamps as scores for ordering — follow the `zadd(key, timestamp, id)` pattern.
- The `prompts` system is separate from tools — prompts are static text that clients can request. Don't confuse with tool descriptions.
- Plan limits in `PLAN_LIMITS` need extending but the billing service reads these directly — no migration needed, just add new fields.

### Redis Key Design

All new keys follow the existing `ws:${workspaceId}:` prefix pattern:

```
# Methodologies
ws:{wsId}:methodology:{id}              → hash (MethodologyTemplate)
ws:{wsId}:methodologies:all             → sorted set (id by timestamp)
builtin:methodology:{id}                → hash (built-in defaults)
builtin:methodologies:all               → sorted set

# Plans
ws:{wsId}:plan:{id}                     → hash (Plan header)
ws:{wsId}:plans:all                     → sorted set (id by timestamp)
ws:{wsId}:plan:{id}:tasks               → sorted set (task ids by order)
ws:{wsId}:plan:{id}:task:{taskId}       → hash (PlanTask)

# Reviews
ws:{wsId}:review:{id}                   → hash (ReviewEntry)
ws:{wsId}:reviews:all                   → sorted set (id by timestamp)
ws:{wsId}:plan:{planId}:reviews         → sorted set (review ids)
ws:{wsId}:workflow:{workflowId}:reviews → sorted set (review ids)

# Quality Gates
ws:{wsId}:quality-gates                 → hash (QualityGateConfig)
```

## Runtime Environment

- **Start command:** `npm run dev` (server watch mode) or `npm start` (production)
- **Build:** `npm run build` (server via tsup + web via Next.js)
- **Test:** `npm test` (vitest)
- **Single test:** `npx vitest run src/services/methodology.service.test.ts`

---

## Tasks

### Phase 1: Methodology Serving

Done: 0 | Left: 6

#### Task 1: Define Methodology Schemas and Storage Keys

- [ ] Complete

**Files:**

- Modify: `src/types.ts` (add schemas at end of file, before closing)

**What to implement:**

Add these Zod schemas and types to `src/types.ts`:

```typescript
// ============================================================================
// Methodology Types (Enhancement Layer v1)
// ============================================================================

export const MethodologyPhaseSchema = z.object({
  name: z.string().describe('Phase name (e.g., "Requirements Gathering")'),
  description: z.string().describe('What happens in this phase'),
  prompt_template: z.string().describe('The actual prompt/instructions for the AI agent'),
  order: z.number().min(0).describe('Phase order (0-indexed)'),
  required: z.boolean().default(true).describe('Whether this phase can be skipped'),
});
export type MethodologyPhase = z.infer<typeof MethodologyPhaseSchema>;

export const MethodologyTemplateSchema = z.object({
  id: z.string().describe('ULID identifier'),
  name: z.string().describe('Short name (e.g., "brainstorming", "systematic-debugging")'),
  display_name: z.string().describe('Human-readable name'),
  description: z.string().describe('What this methodology does and when to use it'),
  version: z.number().min(1).default(1).describe('Version number (auto-incremented)'),
  phases: z
    .array(MethodologyPhaseSchema)
    .min(1)
    .describe('Ordered phases of the methodology'),
  triggers: z
    .array(z.string())
    .default([])
    .describe('Keywords/patterns that suggest this methodology'),
  tags: z.array(z.string()).default([]).describe('Categorization tags'),
  is_builtin: z.boolean().default(false).describe('True for system-provided defaults'),
  forked_from: z.string().optional().describe('ID of methodology this was forked from'),
  workspace_id: z.string().describe('Workspace this belongs to'),
  created_at: z.number().describe('Unix timestamp'),
  updated_at: z.number().describe('Unix timestamp'),
});
export type MethodologyTemplate = z.infer<typeof MethodologyTemplateSchema>;

export const CreateMethodologySchema = z.object({
  name: z.string().min(1).max(100).describe('Short slug name (lowercase, hyphens)'),
  display_name: z.string().min(1).max(200).describe('Human-readable name'),
  description: z
    .string()
    .min(1)
    .max(2000)
    .describe('Description and when-to-use guidance'),
  phases: z.array(MethodologyPhaseSchema).min(1).max(20).describe('Methodology phases'),
  triggers: z.array(z.string()).default([]).describe('Auto-detection trigger keywords'),
  tags: z.array(z.string()).default([]).describe('Tags for categorization'),
});
export type CreateMethodology = z.infer<typeof CreateMethodologySchema>;

export const GetMethodologySchema = z.object({
  name: z
    .string()
    .optional()
    .describe('Get by name (checks workspace first, then built-in)'),
  id: z.string().optional().describe('Get by ID directly'),
});
export type GetMethodology = z.infer<typeof GetMethodologySchema>;

export const ListMethodologiesSchema = z.object({
  include_builtin: z.boolean().default(true).describe('Include built-in methodologies'),
  tags: z.array(z.string()).optional().describe('Filter by tags'),
});
export type ListMethodologies = z.infer<typeof ListMethodologiesSchema>;

export const ForkMethodologySchema = z.object({
  source_id: z.string().describe('ID of methodology to fork (can be built-in)'),
  name: z.string().optional().describe('New name (defaults to original name)'),
  customizations: z
    .object({
      phases: z.array(MethodologyPhaseSchema).optional(),
      description: z.string().optional(),
      triggers: z.array(z.string()).optional(),
    })
    .optional()
    .describe('Override specific fields'),
});
export type ForkMethodology = z.infer<typeof ForkMethodologySchema>;

export const RecommendMethodologySchema = z.object({
  task_description: z
    .string()
    .describe('Description of the task to get methodology recommendation for'),
  context: z
    .string()
    .optional()
    .describe('Additional context about the project or constraints'),
});
export type RecommendMethodology = z.infer<typeof RecommendMethodologySchema>;

export const MethodologyStorageKeys = {
  methodology: (workspace: string, id: string) => `ws:${workspace}:methodology:${id}`,
  methodologies: (workspace: string) => `ws:${workspace}:methodologies:all`,
  methodologyByName: (workspace: string, name: string) =>
    `ws:${workspace}:methodology:name:${name}`,
  builtinMethodology: (id: string) => `builtin:methodology:${id}`,
  builtinMethodologies: () => `builtin:methodologies:all`,
  builtinMethodologyByName: (name: string) => `builtin:methodology:name:${name}`,
} as const;
```

**Verification:** `npx tsc --noEmit` passes. Schemas export correctly.

---

#### Task 2: Implement MethodologyService

- [ ] Complete

**Files:**

- Create: `src/services/methodology.service.ts`
- Create: `src/services/methodology.service.test.ts`

**What to implement:**

`MethodologyService` with these methods:

```typescript
export class MethodologyService {
  constructor(private readonly store: MemoryStore) {}

  /** Create a new workspace-scoped methodology */
  async createMethodology(input: CreateMethodology): Promise<MethodologyTemplate>;

  /** Get by name (workspace first, then built-in) or by ID */
  async getMethodology(opts: GetMethodology): Promise<MethodologyTemplate | null>;

  /** List all methodologies (workspace + optionally built-in) */
  async listMethodologies(opts: ListMethodologies): Promise<MethodologyTemplate[]>;

  /** Fork a methodology (built-in or workspace) into workspace scope */
  async forkMethodology(input: ForkMethodology): Promise<MethodologyTemplate>;

  /** Recommend a methodology based on task description (keyword matching against triggers) */
  async recommendMethodology(input: RecommendMethodology): Promise<{
    recommended: MethodologyTemplate | null;
    alternatives: Array<{ methodology: MethodologyTemplate; match_score: number }>;
  }>;

  /** Seed built-in methodologies (called on server startup) */
  async seedBuiltins(): Promise<void>;
}
```

The service needs direct Redis access via `MemoryStore`'s underlying `StorageClient`. Follow the pattern where `MemoryStore` exposes workspace-scoped operations and the service delegates to it.

**Important:** The `seedBuiltins()` method should check if built-ins already exist before writing (idempotent). Built-in methodologies are stored in the `builtin:` key namespace, not per-workspace.

**Tests:** Mock `MemoryStore`, test each method. Verify workspace-scoped lookup falls back to built-in. Verify fork creates independent copy. Verify recommend returns ranked results.

**Verification:** `npx vitest run src/services/methodology.service.test.ts` passes.

---

#### Task 3: Define Built-in Methodology Content

- [ ] Complete

**Files:**

- Create: `src/services/methodology-builtins.ts`

**What to implement:**

Define the content for 5 built-in methodologies as TypeScript constants. Each is a `CreateMethodology` object with full phase prompts. These are the "Superpowers-equivalent" methodologies served remotely:

**1. `brainstorming`** — Socratic design refinement before coding

- Phase 1: "Understand the Problem" — Ask clarifying questions, identify stakeholders, define success criteria
- Phase 2: "Explore Alternatives" — Generate 2-3 approaches, evaluate trade-offs
- Phase 3: "Design Validation" — Present design in digestible chunks, get sign-off
- Phase 4: "Document Design" — Save design document with decisions and rationale
- Triggers: `["new feature", "design", "architecture", "how should we", "build", "implement"]`

**2. `systematic-debugging`** — 4-phase root cause analysis

- Phase 1: "Reproduce & Observe" — Reproduce consistently, read errors completely, check recent changes
- Phase 2: "Trace & Isolate" — Find working examples, compare against references, identify differences
- Phase 3: "Hypothesize & Test" — Form specific falsifiable hypothesis, test with minimal change
- Phase 4: "Fix & Verify" — Create failing test, implement fix, verify completely
- Triggers: `["bug", "error", "broken", "not working", "crash", "fail", "debug"]`

**3. `test-driven-development`** — RED-GREEN-REFACTOR enforcement

- Phase 1: "Write Failing Test" — One minimal test for desired behavior, verify it fails correctly
- Phase 2: "Implement Minimum" — Simplest code that passes, no extras
- Phase 3: "Refactor" — Improve quality while tests stay green
- Phase 4: "Commit" — Stage and commit the passing test + implementation
- Triggers: `["tdd", "test first", "red green", "new function", "new endpoint"]`

**4. `code-review`** — Two-stage review (spec compliance + quality)

- Phase 1: "Spec Compliance" — Verify all requirements met, nothing extra, nothing missing
- Phase 2: "Code Quality" — Check naming, patterns, error handling, performance, security
- Phase 3: "Report Findings" — Categorize as must_fix / should_fix / suggestion
- Triggers: `["review", "check code", "quality", "ready to merge"]`

**5. `plan-writing`** — Granular implementation planning

- Phase 1: "Analyze Requirements" — Break down feature into components, identify dependencies
- Phase 2: "Design Tasks" — Create bite-sized tasks with exact file paths and code
- Phase 3: "Define Verification" — Add test commands and expected output per task
- Phase 4: "Establish Order" — Set task dependencies, identify parallelizable work
- Triggers: `["plan", "implement", "multi-step", "complex feature"]`

Each phase's `prompt_template` should be a comprehensive prompt (200-500 words) that an AI agent can follow directly — similar to Superpowers' SKILL.md content but structured as phases.

**Verification:** Import and type-check passes. `seedBuiltins()` can consume these constants.

---

#### Task 4: Implement Methodology MCP Tools

- [ ] Complete

**Files:**

- Create: `src/tools/methodology-tools.ts`
- Modify: `src/tools/index.ts` (wire up new tools)

**What to implement:**

5 MCP tools following the thin-handler pattern:

```typescript
export const methodologyTools = {
  get_methodology: {
    description:
      'Get a development methodology by name or ID. ' +
      'Returns structured phases with prompt templates for the AI agent to follow. ' +
      'Checks workspace-specific methodologies first, then falls back to built-in defaults. ' +
      'Built-in methodologies: brainstorming, systematic-debugging, test-driven-development, code-review, plan-writing.',
    inputSchema: zodToJsonSchema(GetMethodologySchema),
    handler: async (args) => {
      /* delegate to service.getMethodology() */
    },
  },

  list_methodologies: {
    description:
      'List all available development methodologies (workspace-specific and built-in). ' +
      'Use this to discover what methodologies are available before starting a task.',
    inputSchema: zodToJsonSchema(ListMethodologiesSchema),
    handler: async (args) => {
      /* delegate to service.listMethodologies() */
    },
  },

  create_methodology: {
    description:
      'Create a custom development methodology for this workspace. ' +
      'Define phases with prompt templates that AI agents will follow. ' +
      'For customizing a built-in methodology, use fork_methodology instead.',
    inputSchema: zodToJsonSchema(CreateMethodologySchema),
    handler: async (args) => {
      /* delegate to service.createMethodology() */
    },
  },

  fork_methodology: {
    description:
      'Fork a built-in or existing methodology into your workspace for customization. ' +
      'Creates an independent copy that you can modify without affecting the original.',
    inputSchema: zodToJsonSchema(ForkMethodologySchema),
    handler: async (args) => {
      /* delegate to service.forkMethodology() */
    },
  },

  recommend_methodology: {
    description:
      'Get a methodology recommendation based on your current task description. ' +
      'Analyzes the task against methodology triggers and returns the best match. ' +
      'Call this at the start of a task to get structured guidance.',
    inputSchema: zodToJsonSchema(RecommendMethodologySchema),
    handler: async (args) => {
      /* delegate to service.recommendMethodology() */
    },
  },
};
```

In `src/tools/index.ts`:

- Import `methodologyTools` and `setMethodologyMemoryStore`
- Add `setMethodologyMemoryStore(store)` to the `setMemoryStore()` function
- Spread `...methodologyTools` into the `tools` export

**Verification:** `npm test` passes. Tools register correctly in MCP handler.

---

#### Task 5: Extend Plan Limits for Methodologies

- [ ] Complete

**Files:**

- Modify: `src/http/types.ts` (extend `PLAN_LIMITS`)

**What to implement:**

Add methodology limits to each tier:

```typescript
export const PLAN_LIMITS = {
  free: {
    maxMemories: 500,
    maxWorkspaces: 1,
    maxTeamMembers: 1,
    maxMethodologies: 3, // Can create 3 custom (built-ins always available)
    maxPlans: 5, // 5 active plans
    maxReviewsPerPlan: 20, // 20 review entries per plan
  },
  pro: {
    maxMemories: 5000,
    maxWorkspaces: 3,
    maxTeamMembers: 1,
    maxMethodologies: 20,
    maxPlans: 50,
    maxReviewsPerPlan: 100,
  },
  team: {
    maxMemories: 25000,
    maxWorkspaces: -1,
    maxTeamMembers: 10,
    maxMethodologies: -1, // unlimited
    maxPlans: -1,
    maxReviewsPerPlan: -1,
  },
  enterprise: {
    maxMemories: -1,
    maxWorkspaces: -1,
    maxTeamMembers: -1,
    maxMethodologies: -1,
    maxPlans: -1,
    maxReviewsPerPlan: -1,
  },
} as const;
```

**Verification:** TypeScript compiles. Billing service reads new fields.

---

#### Task 6: Write Methodology Tests

- [ ] Complete

**Files:**

- Create: `src/services/methodology.service.test.ts`
- Create: `src/tools/methodology-tools.test.ts` (optional — service tests are primary)

**What to test:**

Service tests:

- `createMethodology` — creates with correct fields, returns ULID, stores in sorted set
- `getMethodology` — finds by name (workspace-first, then builtin fallback), finds by ID
- `getMethodology` — returns null for nonexistent
- `listMethodologies` — includes both workspace and builtin, respects `include_builtin: false`
- `forkMethodology` — creates independent copy with `forked_from` reference
- `recommendMethodology` — returns highest-scoring match based on trigger keywords
- `recommendMethodology` — returns null when no triggers match
- `seedBuiltins` — idempotent (running twice doesn't duplicate)
- Plan limit enforcement — throws when workspace methodology count exceeds tier limit

**Verification:** `npx vitest run src/services/methodology.service.test.ts` — all tests pass.

---

### Phase 2: Plan Management

Done: 0 | Left: 6

#### Task 7: Define Plan Schemas and Storage Keys

- [ ] Complete

**Files:**

- Modify: `src/types.ts`

**What to implement:**

```typescript
// ============================================================================
// Plan Management Types (Enhancement Layer v1)
// ============================================================================

export const PlanTaskStatus = z.enum([
  'pending',
  'in_progress',
  'completed',
  'skipped',
  'blocked',
]);
export type PlanTaskStatus = z.infer<typeof PlanTaskStatus>;

export const PlanStatus = z.enum([
  'draft',
  'approved',
  'in_progress',
  'completed',
  'verified',
  'abandoned',
]);
export type PlanStatus = z.infer<typeof PlanStatus>;

export const PlanTaskSchema = z.object({
  id: z.string().describe('ULID identifier'),
  plan_id: z.string().describe('Parent plan ID'),
  order: z.number().min(0).describe('Task order (0-indexed)'),
  title: z.string().describe('Short task title'),
  description: z.string().describe('Detailed task description'),
  status: PlanTaskStatus.default('pending'),
  files: z.array(z.string()).default([]).describe('Files this task touches'),
  depends_on: z.array(z.string()).default([]).describe('Task IDs this depends on'),
  methodology_phase: z
    .string()
    .optional()
    .describe('Which methodology phase this maps to'),
  review_status: z.enum(['none', 'passed', 'failed']).default('none'),
  started_at: z.number().optional(),
  completed_at: z.number().optional(),
});
export type PlanTask = z.infer<typeof PlanTaskSchema>;

export const PlanSchema = z.object({
  id: z.string().describe('ULID identifier'),
  name: z.string().describe('Plan name (e.g., "user-authentication")'),
  goal: z.string().describe('One-sentence goal'),
  architecture: z.string().optional().describe('Architecture summary (2-3 sentences)'),
  status: PlanStatus.default('draft'),
  methodology_id: z.string().optional().describe('Methodology used for this plan'),
  workflow_id: z.string().optional().describe('Linked workflow ID'),
  task_count: z.number().default(0),
  tasks_completed: z.number().default(0),
  workspace_id: z.string(),
  created_at: z.number(),
  updated_at: z.number(),
  approved_at: z.number().optional(),
  completed_at: z.number().optional(),
});
export type Plan = z.infer<typeof PlanSchema>;

export const CreatePlanSchema = z.object({
  name: z.string().min(1).max(200).describe('Plan name'),
  goal: z.string().min(1).max(1000).describe('One-sentence goal'),
  architecture: z.string().max(2000).optional().describe('Architecture summary'),
  methodology_id: z.string().optional().describe('Methodology to associate'),
  workflow_id: z.string().optional().describe('Workflow to link to'),
  tasks: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        files: z.array(z.string()).default([]),
        depends_on_indices: z
          .array(z.number())
          .default([])
          .describe('Indices of tasks this depends on (resolved to IDs after creation)'),
      })
    )
    .min(1)
    .max(50)
    .describe('Plan tasks in order'),
});
export type CreatePlan = z.infer<typeof CreatePlanSchema>;

export const UpdatePlanTaskSchema = z.object({
  plan_id: z.string().describe('Plan ID'),
  task_id: z.string().describe('Task ID'),
  status: PlanTaskStatus.optional(),
  review_status: z.enum(['none', 'passed', 'failed']).optional(),
});
export type UpdatePlanTask = z.infer<typeof UpdatePlanTaskSchema>;

export const GetPlanSchema = z.object({
  plan_id: z
    .string()
    .optional()
    .describe('Plan ID (if omitted, returns active plan for workspace)'),
  name: z.string().optional().describe('Plan name to search for'),
  include_tasks: z.boolean().default(true).describe('Include full task list'),
});
export type GetPlan = z.infer<typeof GetPlanSchema>;

export const ListPlansSchema = z.object({
  status: PlanStatus.optional().describe('Filter by status'),
  limit: z.number().min(1).max(50).default(10),
});
export type ListPlans = z.infer<typeof ListPlansSchema>;

export const UpdatePlanStatusSchema = z.object({
  plan_id: z.string().describe('Plan ID'),
  status: PlanStatus.describe('New status'),
});
export type UpdatePlanStatus = z.infer<typeof UpdatePlanStatusSchema>;

export const GetPlanProgressSchema = z.object({
  plan_id: z.string().describe('Plan ID'),
});
export type GetPlanProgress = z.infer<typeof GetPlanProgressSchema>;

export const PlanStorageKeys = {
  plan: (workspace: string, id: string) => `ws:${workspace}:plan:${id}`,
  plans: (workspace: string) => `ws:${workspace}:plans:all`,
  planByName: (workspace: string, name: string) => `ws:${workspace}:plan:name:${name}`,
  planTasks: (workspace: string, planId: string) =>
    `ws:${workspace}:plan:${planId}:tasks`,
  planTask: (workspace: string, planId: string, taskId: string) =>
    `ws:${workspace}:plan:${planId}:task:${taskId}`,
  activePlan: (workspace: string) => `ws:${workspace}:plan:active`,
} as const;
```

**Verification:** `npx tsc --noEmit` passes.

---

#### Task 8: Implement PlanService

- [ ] Complete

**Files:**

- Create: `src/services/plan.service.ts`

**What to implement:**

```typescript
export class PlanService {
  constructor(private readonly store: MemoryStore) {}

  /** Create a plan with tasks. Resolves depends_on_indices to task IDs. Sets as active plan. */
  async createPlan(input: CreatePlan): Promise<Plan & { tasks: PlanTask[] }>;

  /** Get plan by ID or name. Optionally includes tasks. Falls back to active plan. */
  async getPlan(opts: GetPlan): Promise<(Plan & { tasks?: PlanTask[] }) | null>;

  /** List plans filtered by status */
  async listPlans(opts: ListPlans): Promise<Plan[]>;

  /** Update a specific task's status and/or review status. Auto-updates plan counters. */
  async updatePlanTask(input: UpdatePlanTask): Promise<PlanTask>;

  /** Update plan-level status (draft -> approved -> in_progress -> completed -> verified) */
  async updatePlanStatus(input: UpdatePlanStatus): Promise<Plan>;

  /** Get plan progress summary (task counts by status, percentage, blocked tasks) */
  async getPlanProgress(input: GetPlanProgress): Promise<{
    plan_id: string;
    plan_name: string;
    status: PlanStatus;
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
    skipped: number;
    blocked: number;
    percentage: number;
    next_task: PlanTask | null;
  }>;

  /** Set the active plan for this workspace */
  async setActivePlan(planId: string): Promise<void>;

  /** Clear the active plan */
  async clearActivePlan(): Promise<void>;
}
```

**Key behavior:**

- `createPlan` creates all tasks in a pipeline, resolves `depends_on_indices` to the generated task ULIDs, and sets the plan as active for the workspace.
- `updatePlanTask` to `completed` auto-increments `tasks_completed` on the plan. If all tasks complete, auto-sets plan status to `completed`.
- `getPlanProgress` computes `next_task` by finding the first `pending` task whose `depends_on` are all `completed`.
- Plan status transitions are validated: `draft` -> `approved` -> `in_progress` -> `completed` -> `verified`. Also allow `abandoned` from any status.

**Verification:** `npx vitest run src/services/plan.service.test.ts` passes.

---

#### Task 9: Implement Plan MCP Tools

- [ ] Complete

**Files:**

- Create: `src/tools/plan-tools.ts`
- Modify: `src/tools/index.ts`

**What to implement:**

7 MCP tools:

```typescript
export const planTools = {
  store_plan: {
    description:
      'Create and store an implementation plan with structured tasks. ' +
      'Plans persist across sessions and link to workflows. ' +
      'Each task has a title, description, files list, and dependency tracking. ' +
      'The plan becomes the active plan for the workspace.',
    inputSchema: zodToJsonSchema(CreatePlanSchema),
    handler: async (args) => {
      /* delegate to service.createPlan() */
    },
  },

  get_plan: {
    description:
      'Retrieve a plan by ID, name, or get the active plan for the workspace. ' +
      'Returns plan header and optionally all tasks with their current status. ' +
      'Use this at session start to resume work on an existing plan.',
    inputSchema: zodToJsonSchema(GetPlanSchema),
    handler: async (args) => {
      /* delegate to service.getPlan() */
    },
  },

  list_plans: {
    description:
      'List all plans in this workspace, optionally filtered by status. ' +
      'Returns plan headers without task details for quick scanning.',
    inputSchema: zodToJsonSchema(ListPlansSchema),
    handler: async (args) => {
      /* delegate to service.listPlans() */
    },
  },

  update_plan_task: {
    description:
      "Update a task's status within a plan. Status: pending, in_progress, completed, skipped, blocked. " +
      'Also accepts review_status: none, passed, failed. ' +
      'Automatically updates plan progress counters and auto-completes the plan when all tasks finish.',
    inputSchema: zodToJsonSchema(UpdatePlanTaskSchema),
    handler: async (args) => {
      /* delegate to service.updatePlanTask() */
    },
  },

  update_plan_status: {
    description:
      'Update the overall plan status. Lifecycle: draft -> approved -> in_progress -> completed -> verified. ' +
      'Use "abandoned" to archive a plan that\'s no longer needed.',
    inputSchema: zodToJsonSchema(UpdatePlanStatusSchema),
    handler: async (args) => {
      /* delegate to service.updatePlanStatus() */
    },
  },

  get_plan_progress: {
    description:
      'Get detailed progress summary for a plan. ' +
      'Returns task counts by status, completion percentage, and the next unblocked task to work on. ' +
      'Call this to determine what to work on next.',
    inputSchema: zodToJsonSchema(GetPlanProgressSchema),
    handler: async (args) => {
      /* delegate to service.getPlanProgress() */
    },
  },

  set_active_plan: {
    description:
      'Set which plan is the active/current plan for this workspace. ' +
      'The active plan is returned by get_plan when no ID is specified.',
    inputSchema: z.object({ plan_id: z.string() }),
    handler: async (args) => {
      /* delegate to service.setActivePlan() */
    },
  },
};
```

Wire into `src/tools/index.ts` following the same pattern as methodology tools.

**Verification:** `npm test` passes. Tools register in MCP handler.

---

#### Task 10: Write Plan Service Tests

- [ ] Complete

**Files:**

- Create: `src/services/plan.service.test.ts`

**What to test:**

- `createPlan` — creates plan + all tasks, resolves dependency indices to ULIDs, sets as active
- `createPlan` — plan limit enforcement (throws when exceeding tier)
- `getPlan` — by ID, by name, active plan fallback
- `getPlan` — includes tasks when `include_tasks: true`
- `getPlan` — returns null for nonexistent
- `listPlans` — returns all, respects status filter
- `updatePlanTask` — status transitions, auto-increments plan counters
- `updatePlanTask` — auto-completes plan when all tasks done
- `updatePlanStatus` — valid transitions only (draft -> approved -> in_progress, etc.)
- `updatePlanStatus` — rejects invalid transitions (e.g., completed -> draft)
- `getPlanProgress` — correct counts, percentage, next_task resolution
- `getPlanProgress` — next_task skips tasks with unmet dependencies
- `setActivePlan` / `clearActivePlan` — sets and clears active plan pointer

**Verification:** `npx vitest run src/services/plan.service.test.ts` — all tests pass.

---

#### Task 11: Add Plan Workflow MCP Prompt

- [ ] Complete

**Files:**

- Modify: `src/prompts/index.ts`

**What to implement:**

Add a new `plan_workflow` prompt that teaches AI agents the plan management workflow:

```typescript
const PLAN_WORKFLOW_TEXT = `# Plan Management Workflow

## Overview

Recall stores implementation plans remotely so they persist across sessions,
survive context compaction, and are accessible by any Claude instance connected
to this workspace.

## Lifecycle

1. **Create Plan** — store_plan({ name, goal, tasks: [...] })
2. **Resume Plan** — get_plan() at session start to load active plan
3. **Work Tasks** — update_plan_task({ status: "in_progress" }) then "completed"
4. **Track Progress** — get_plan_progress() to see what's next
5. **Complete** — plan auto-completes when all tasks finish

## Integration with Workflows

Plans can link to Recall workflows:
- start_workflow() → store_plan({ workflow_id }) → work tasks → complete_workflow()
- Memories stored during the workflow are auto-tagged
- Review findings link to both plan and workflow

## Integration with Methodologies

Plans can reference a methodology:
- get_methodology("brainstorming") → design phase
- store_plan({ methodology_id }) → implementation phase
- get_methodology("code-review") → review phase

## Session Continuity

At session start:
1. auto_session_start() — loads context
2. get_plan() — loads active plan and task status
3. get_plan_progress() — identifies next task
4. Resume working from where you left off
`;
```

Add to the `prompts` object and update `listPrompts`.

**Verification:** Prompt listed in MCP prompt list.

---

#### Task 12: Add Plan REST API Endpoints

- [ ] Complete

**Files:**

- Modify: `src/http/server.ts`

**What to implement:**

Add REST endpoints for dashboard visibility (read-only initially):

```
GET  /api/plans                     → List plans for workspace
GET  /api/plans/:planId             → Get plan with tasks
GET  /api/plans/:planId/progress    → Get plan progress summary
```

Follow the existing authenticated endpoint pattern with `req.tenant` context. These are for the web dashboard to display plan status — the primary write interface is via MCP tools.

**Verification:** `curl` test against running server returns correct data.

---

### Phase 3: Review Audit Trail

Done: 0 | Left: 5

#### Task 13: Define Review Schemas and Storage Keys

- [ ] Complete

**Files:**

- Modify: `src/types.ts`

**What to implement:**

```typescript
// ============================================================================
// Review Audit Trail Types (Enhancement Layer v1)
// ============================================================================

export const ReviewSeverity = z.enum(['must_fix', 'should_fix', 'suggestion', 'note']);
export type ReviewSeverity = z.infer<typeof ReviewSeverity>;

export const ReviewType = z.enum([
  'spec_compliance',
  'code_quality',
  'security',
  'performance',
  'general',
]);
export type ReviewType = z.infer<typeof ReviewType>;

export const ReviewFindingSchema = z.object({
  description: z.string().describe('What was found'),
  severity: ReviewSeverity,
  file: z.string().optional().describe('File path if applicable'),
  line: z.number().optional().describe('Line number if applicable'),
  suggestion: z.string().optional().describe('Recommended fix'),
});
export type ReviewFinding = z.infer<typeof ReviewFindingSchema>;

export const ReviewEntrySchema = z.object({
  id: z.string().describe('ULID identifier'),
  plan_id: z.string().optional().describe('Linked plan ID'),
  plan_task_id: z.string().optional().describe('Linked plan task ID'),
  workflow_id: z.string().optional().describe('Linked workflow ID'),
  review_type: ReviewType,
  approved: z.boolean().describe('Whether the review passed overall'),
  findings: z.array(ReviewFindingSchema).default([]),
  summary: z.string().optional().describe('Review summary'),
  reviewer: z
    .string()
    .default('ai')
    .describe('Who performed the review (ai, human name)'),
  workspace_id: z.string(),
  created_at: z.number(),
});
export type ReviewEntry = z.infer<typeof ReviewEntrySchema>;

export const StoreReviewSchema = z.object({
  plan_id: z.string().optional().describe('Plan this review belongs to'),
  plan_task_id: z.string().optional().describe('Specific task being reviewed'),
  workflow_id: z.string().optional().describe('Workflow this review belongs to'),
  review_type: ReviewType,
  approved: z.boolean().describe('Did the review pass?'),
  findings: z.array(ReviewFindingSchema).default([]),
  summary: z.string().optional(),
  reviewer: z.string().default('ai'),
});
export type StoreReview = z.infer<typeof StoreReviewSchema>;

export const GetReviewHistorySchema = z.object({
  plan_id: z.string().optional().describe('Filter by plan'),
  workflow_id: z.string().optional().describe('Filter by workflow'),
  review_type: ReviewType.optional().describe('Filter by review type'),
  limit: z.number().min(1).max(100).default(20),
});
export type GetReviewHistory = z.infer<typeof GetReviewHistorySchema>;

export const QualityGateConfigSchema = z.object({
  coverage_threshold: z
    .number()
    .min(0)
    .max(100)
    .default(70)
    .describe('Minimum test coverage percentage'),
  required_review_types: z.array(ReviewType).default(['spec_compliance', 'code_quality']),
  blocking_severities: z.array(ReviewSeverity).default(['must_fix']),
  auto_approve_suggestions: z
    .boolean()
    .default(true)
    .describe('Auto-pass reviews with only suggestions/notes'),
});
export type QualityGateConfig = z.infer<typeof QualityGateConfigSchema>;

export const SetQualityGatesSchema = z.object({
  config: QualityGateConfigSchema,
});
export type SetQualityGates = z.infer<typeof SetQualityGatesSchema>;

export const CheckQualityGatesSchema = z.object({
  plan_id: z.string().describe('Plan to check quality gates for'),
});
export type CheckQualityGates = z.infer<typeof CheckQualityGatesSchema>;

export const ReviewStorageKeys = {
  review: (workspace: string, id: string) => `ws:${workspace}:review:${id}`,
  reviews: (workspace: string) => `ws:${workspace}:reviews:all`,
  planReviews: (workspace: string, planId: string) =>
    `ws:${workspace}:plan:${planId}:reviews`,
  workflowReviews: (workspace: string, workflowId: string) =>
    `ws:${workspace}:workflow:${workflowId}:reviews`,
  qualityGates: (workspace: string) => `ws:${workspace}:quality-gates`,
} as const;
```

**Verification:** `npx tsc --noEmit` passes.

---

#### Task 14: Implement ReviewService

- [ ] Complete

**Files:**

- Create: `src/services/review.service.ts`

**What to implement:**

```typescript
export class ReviewService {
  constructor(private readonly store: MemoryStore) {}

  /** Store a review entry, linking to plan/task/workflow as specified */
  async storeReview(input: StoreReview): Promise<ReviewEntry>;

  /** Get review history with optional filters */
  async getReviewHistory(opts: GetReviewHistory): Promise<ReviewEntry[]>;

  /** Set quality gate configuration for this workspace */
  async setQualityGates(input: SetQualityGates): Promise<QualityGateConfig>;

  /** Get quality gate configuration (returns defaults if none set) */
  async getQualityGates(): Promise<QualityGateConfig>;

  /** Check if all quality gates pass for a plan (all required review types passed, no blocking findings) */
  async checkQualityGates(input: CheckQualityGates): Promise<{
    passed: boolean;
    gates: Array<{
      review_type: ReviewType;
      required: boolean;
      status: 'passed' | 'failed' | 'missing';
      blocking_findings: number;
    }>;
    summary: string;
  }>;
}
```

**Key behavior:**

- `storeReview` creates the review entry and adds to all relevant sorted sets (global, plan-specific, workflow-specific). Also updates `review_status` on the linked plan task if `plan_task_id` is provided.
- `checkQualityGates` looks at the most recent review per required type for the plan. If any required type has no review or a failed review, or if there are unresolved `must_fix` findings, the gate fails.
- `getQualityGates` returns workspace config or sensible defaults if none configured.

**Verification:** `npx vitest run src/services/review.service.test.ts` passes.

---

#### Task 15: Implement Review MCP Tools

- [ ] Complete

**Files:**

- Create: `src/tools/review-tools.ts`
- Modify: `src/tools/index.ts`

**What to implement:**

5 MCP tools:

```typescript
export const reviewTools = {
  store_review: {
    description:
      'Store a code review result with structured findings. ' +
      'Link to a plan, task, and/or workflow for audit trail. ' +
      'Findings are categorized by severity: must_fix, should_fix, suggestion, note. ' +
      'Call this after completing a spec compliance or code quality review.',
    inputSchema: zodToJsonSchema(StoreReviewSchema),
    handler: async (args) => {
      /* delegate to service.storeReview() */
    },
  },

  get_review_history: {
    description:
      'Get review history for a plan, workflow, or the entire workspace. ' +
      'Returns review entries with findings, sorted by most recent. ' +
      'Use this to check what reviews have been done and their outcomes.',
    inputSchema: zodToJsonSchema(GetReviewHistorySchema),
    handler: async (args) => {
      /* delegate to service.getReviewHistory() */
    },
  },

  set_quality_gates: {
    description:
      'Configure quality gate requirements for this workspace. ' +
      'Define required review types, blocking severity levels, and coverage thresholds. ' +
      'These gates are checked before a plan can be marked as verified.',
    inputSchema: zodToJsonSchema(SetQualityGatesSchema),
    handler: async (args) => {
      /* delegate to service.setQualityGates() */
    },
  },

  get_quality_gates: {
    description:
      'Get the current quality gate configuration for this workspace. ' +
      'Returns the configured thresholds and requirements.',
    inputSchema: z.object({}),
    handler: async () => {
      /* delegate to service.getQualityGates() */
    },
  },

  check_quality_gates: {
    description:
      'Check if all quality gates pass for a specific plan. ' +
      'Evaluates required reviews, blocking findings, and coverage. ' +
      'Call this before marking a plan as verified to ensure all standards are met.',
    inputSchema: zodToJsonSchema(CheckQualityGatesSchema),
    handler: async (args) => {
      /* delegate to service.checkQualityGates() */
    },
  },
};
```

Wire into `src/tools/index.ts`.

**Verification:** `npm test` passes. Tools register in MCP handler.

---

#### Task 16: Write Review Service Tests

- [ ] Complete

**Files:**

- Create: `src/services/review.service.test.ts`

**What to test:**

- `storeReview` — creates entry, links to sorted sets, updates plan task review_status
- `storeReview` — enforces review count limits per plan (tier-based)
- `getReviewHistory` — unfiltered returns all, filtered by plan/workflow/type
- `setQualityGates` — stores config, retrieves correctly
- `getQualityGates` — returns defaults when none configured
- `checkQualityGates` — passes when all required reviews pass
- `checkQualityGates` — fails when required review type is missing
- `checkQualityGates` — fails when must_fix findings exist
- `checkQualityGates` — auto-approves when only suggestions (if configured)

**Verification:** `npx vitest run src/services/review.service.test.ts` — all tests pass.

---

#### Task 17: Add Review REST API Endpoints

- [ ] Complete

**Files:**

- Modify: `src/http/server.ts`

**What to implement:**

```
GET  /api/plans/:planId/reviews     → Review history for a plan
GET  /api/quality-gates             → Current quality gate config
POST /api/quality-gates             → Set quality gate config
GET  /api/plans/:planId/gates       → Check quality gates for a plan
```

**Verification:** Endpoints return correct data.

---

### Phase 4: Integration & Intelligence

Done: 0 | Left: 3

#### Task 18: Enhance auto_session_start with Methodology Recommendations

- [ ] Complete

**Files:**

- Modify: `src/tools/context-tools.ts` (enhance `auto_session_start` handler)

**What to implement:**

Extend the `auto_session_start` response to include:

1. **Active plan** — If there's an active plan, include its name, progress summary, and next task
2. **Methodology recommendation** — If `task_hint` is provided, call `recommendMethodology` and include the suggestion
3. **Quality gate status** — If there's an active plan, include whether quality gates are met

The response structure should add these fields to the existing output:

```typescript
{
  // ...existing context fields...
  active_plan: {
    id: string;
    name: string;
    status: string;
    progress: { completed: number; total: number; percentage: number };
    next_task: { id: string; title: string } | null;
  } | null;
  recommended_methodology: {
    name: string;
    display_name: string;
    description: string;
    match_score: number;
  } | null;
  quality_gates: {
    configured: boolean;
    all_passing: boolean;
  } | null;
}
```

This requires importing and using `PlanService`, `MethodologyService`, and `ReviewService`. Follow the existing DI pattern — these services need their own `set*MemoryStore` calls.

**Verification:** `auto_session_start` with a `task_hint` returns methodology recommendation. Active plan appears when one exists.

---

#### Task 19: Add Enhancement Layer Overview MCP Prompt

- [ ] Complete

**Files:**

- Modify: `src/prompts/index.ts`

**What to implement:**

Add an `enhancement_layer` prompt that teaches AI agents about all three domains:

```typescript
const ENHANCEMENT_LAYER_TEXT = `# Recall Enhancement Layer

## Three Domains Beyond Memory

### 1. Methodologies — How to Work
Recall serves development methodologies as structured, phased prompt templates.
Built-in: brainstorming, systematic-debugging, test-driven-development, code-review, plan-writing.
Fork and customize for your team's specific practices.

Tools: get_methodology, list_methodologies, create_methodology, fork_methodology, recommend_methodology

### 2. Plans — What to Build
Implementation plans stored remotely with task-level tracking.
Plans persist across sessions and link to workflows and methodologies.

Tools: store_plan, get_plan, list_plans, update_plan_task, update_plan_status, get_plan_progress

### 3. Reviews — Quality Assurance
Structured review findings with severity levels and quality gate enforcement.
Full audit trail linked to plans and workflows.

Tools: store_review, get_review_history, set_quality_gates, check_quality_gates

## Recommended Session Flow

1. auto_session_start({ task_hint: "..." })
   → Gets memories + active plan + methodology recommendation

2. If new feature:
   a. get_methodology("brainstorming") → Follow brainstorming phases
   b. store_plan({ name, goal, tasks }) → Create implementation plan
   c. start_workflow({ name }) → Link workflow for memory tagging

3. For each task:
   a. update_plan_task({ status: "in_progress" })
   b. Do the work (locally)
   c. store_review({ review_type: "spec_compliance", findings: [...] })
   d. update_plan_task({ status: "completed" })

4. Before marking complete:
   a. check_quality_gates({ plan_id }) → Ensure all gates pass
   b. update_plan_status({ status: "verified" })

5. End of session:
   a. summarize_session()
   b. complete_workflow() (if done)
`;
```

**Verification:** Prompt listed and served correctly.

---

#### Task 20: Methodology Seed on Server Startup

- [ ] Complete

**Files:**

- Modify: `src/http/mcp-handler.ts` or `src/tools/index.ts` (wherever initialization happens)

**What to implement:**

Call `methodologyService.seedBuiltins()` during server initialization to populate built-in methodologies. This should run once at startup and be idempotent. Built-ins are stored in the `builtin:` namespace (not per-tenant), so this only needs to run once globally, not per-request.

Find the appropriate initialization point — likely in `initializeDefaultMemoryStore()` in `src/tools/index.ts` or in the server startup sequence in `src/http/server.ts`.

**Verification:** Server starts without errors. `list_methodologies` returns built-in entries.

---

## Definition of Done

- [ ] All 20 tasks implemented
- [ ] All new services have comprehensive tests
- [ ] `npm test` passes (all existing + new tests)
- [ ] `npx tsc --noEmit` passes (no type errors)
- [ ] New tools register correctly in MCP handler (verify with a test MCP client)
- [ ] Built-in methodologies seed on server startup
- [ ] Plan limits extended for all tiers
- [ ] `auto_session_start` returns plan/methodology context
- [ ] REST API endpoints respond correctly
- [ ] No regressions to existing memory, workflow, consolidation, or RLM functionality

## Risks and Mitigations

| Risk                                                       | Impact                              | Mitigation                                                                          |
| ---------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| Tool count bloat (40 existing + 17 new = 57)               | Higher context cost per MCP session | Group tools logically; consider tool-level feature flags by plan tier               |
| Redis memory growth from plans/reviews                     | Storage costs                       | Add TTL for abandoned plans (30 days); review entries capped per plan               |
| Methodology prompt templates are large                     | Token cost when served              | Return phase list by default; full prompt only for requested phase                  |
| Conflict between remote plans and local plan files (Pilot) | Confusion about source of truth     | Document clearly: Recall is the source of truth; local files are for reference only |
| Built-in methodology content quality                       | Agent follows bad instructions      | Start with battle-tested content (adapted from Superpowers); iterate based on usage |

## Future Work (Not in Scope)

- **Dashboard UI** — Web pages for viewing/managing methodologies, plans, and reviews
- **Methodology Marketplace** — Team-shared methodology library with publish/subscribe
- **Per-Task Review** — Trigger review automatically after each task completion (like Superpowers' two-stage review)
- **Intelligent Plan Generation** — Use Claude API to auto-generate plan tasks from a goal + methodology
- **Plan Diffing** — Compare plan vs. actual implementation for drift detection
- **Webhook Notifications** — Notify team when quality gates fail or plans complete
