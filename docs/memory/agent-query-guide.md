# Agent query guide — `multilanetesting`

Which memory file to read for which question. Read the **smallest** file that answers the question;
escalate only if it does not.

| If you need to know… | Read |
|---|---|
| Does this screen/target exist? what channel? | [`route-map.md`](route-map.md) |
| How do I locate control X? is it frozen? what tier? | [`selector-index.md`](selector-index.md) |
| What does this status/oracle/partition mean? | [`feature-index.md`](feature-index.md) |
| Why can't we test Y? is it blocked? | [`blocker-index.md`](blocker-index.md) |
| Which requirement does spec Z map to? | [`requirement-index.md`](requirement-index.md) |
| Where does this *kind* of truth live? | [`source-map.md`](source-map.md) |
| The store/recall/update policy | [`memory-system-flow.md`](memory-system-flow.md) |

## Query order per task type

- **New screen / discovery** → `route-map` → `selector-index` (is anything already frozen?) →
  `blocker-index` (known dead ends?).
- **Author a spec** → `selector-index` (frozen locators) → `feature-index` (oracle/partition) →
  `requirement-index` (which `requirement_ref`).
- **Flaky/drift** → `selector-index` (current freeze) → `blocker-index` (known noise sources).
- **PR validation** → `source-map` (where each fact should be) → `requirement-index` + `coverage-map`.

If the graph exists, a single `graphify query "<question>"` often replaces several of these reads.
