Project: SQL Learning Game (Java) 

Target Group: Young Tech Students (16–25)

1\. Vision



Create a game-based learning platform in Java where players learn SQL and database design through interactive missions, progressive challenges, and realistic datasets.



The game must feel like a developer tool, not a school exercise.



2\. Core Objectives



Teach SQL from beginner to advanced level



Simulate real relational databases



Provide instant feedback on queries



Gamify learning with progression, XP, and achievements



Encourage experimentation through sandbox mode



3\. User Demands

3.1 Learning Demands



Users want:



Real SQL execution, not multiple-choice quizzes



Immediate feedback on errors



Clear learning goals per level



Realistic schemas and datasets



Progressive difficulty structure



Visual representation of database structure



Optional hints



Explanation of why concepts matter in real-world development



3.2 Gameplay Demands



Users want:



Mission-based challenges



Story-driven progression



Boss levels with multi-step queries



Time-based challenges



Competitive scoring



Achievements and unlockables



XP and skill progression system



Fail without punishment



3.3 Technical Demands



Users expect:



Clean SQL editor with syntax highlighting



Error highlighting



Fast query execution



Autocomplete (optional advanced feature)



Dark mode



Reset / undo functionality



Sandbox free-play mode



3.4 Advanced User Demands



Advanced students want:



JOIN-heavy challenges



GROUP BY / HAVING mastery levels



Subqueries



Index optimization



Query performance scoring



Execution plan explanation



Normalization puzzles



Broken schema debugging missions



4\. System Architecture

4.1 Core Modules



Game Engine



Level system



Progress tracking



XP and achievement system



SQL Engine



Embedded database (H2 / SQLite)



Query validation



Result comparison engine



Error parsing and hint generation



Schema Manager



Dynamic database setup per level



Reset functionality



ER diagram generation



UI Module



SQL editor



Result table viewer



Schema visualization



Dashboard screen



Scoring System



Correctness check



Efficiency scoring



Time-based scoring



Query complexity evaluation



5\. Gameplay Structure

5.1 Level Progression



Level 1–3:



SELECT



WHERE



ORDER BY



Level 4–6:



JOIN



Aliases



Aggregation



Level 7–9:



GROUP BY



HAVING



Subqueries



Level 10+:



Index optimization



Query efficiency



Complex schema challenges



5.2 Game Modes



Campaign Mode



Story-driven missions



Progressive difficulty



Sandbox Mode



Create tables



Insert data



Free experimentation



Challenge Mode



Timed tasks



Leaderboard scoring



6\. Scoring Model



Each mission evaluates:



Query correctness



Query efficiency



Execution time



Clean structure (optional advanced)



Bonus for optimal solution



7\. Database Simulation Requirements



Real relational schema



Primary keys



Foreign keys



Constraints



Indexed columns (advanced levels)



Datasets should include:



E-commerce



University management



Game leaderboard



Social media system



Startup backend system



8\. UX Requirements



Dark mode default



Developer-style UI



Minimalist dashboard



Responsive feedback



Clear error messages



Schema viewer panel



Progress tracker panel



**Roadmap Level Select (NEW, high priority)**

- A visual level roadmap with circular nodes (Mario/Duolingo style).
- An avatar marker that moves along the path to the current/unlocked level.
- Clicking a node opens the SQL play view for that level.
- Locked nodes are visible but disabled.



9\. Non-Functional Requirements



Fast execution (< 100ms query evaluation for normal levels)



Local execution (offline support)



Modular architecture



Extensible level system



Clean, testable Java code



MVC-based structure recommended



10\. Future Extensions



Multiplayer mode



Online leaderboard



AI-powered hint engine



REST API simulation



Integration with real database servers



Performance visualization graphs



11\. Definition of Done



The system is complete when:



A user can install and run the game locally



At least 10 fully playable levels exist



SQL execution behaves realistically



Progress is saved



Sandbox mode works



Scoring system is functional



The UI is stable and responsive



REQUIREMENTS:

1\) User Requirements



Players must be able to write SQL queries directly (not only multiple-choice).



Players must get immediate feedback: syntax errors, logical errors, and “correct but not what the mission asked for.”



Players must see the schema (tables, columns, relationships) for the current mission.



Players must be able to view query results in a readable table format.



Players must be able to retry freely without losing progress (no harsh punishment loops).



Players must have optional hints that escalate (small nudge → bigger hint → near-solution).



Players must have visible progression (levels, XP, mastery, achievements).



Players must have a “sandbox” mode for experimentation (create tables, insert data, run queries).



Players must have a reset button per level to restore the database to a known state.



UI must feel like a developer tool (dark mode, editor-like interaction, minimal friction).



2\) Functional Requirements

2.1 Game Progression \& Content



The game must support level definitions that include:



learning objective



dataset + schema



mission prompt



allowed SQL commands (optional per level)



evaluation rules



hints



The game must unlock levels based on completion rules (linear or branching).



The game must store player state (completed levels, XP, achievements, settings).



The game must support multiple mission types:



write query that returns correct rows/columns



fix a broken query



design schema (create tables/constraints)



data cleanup (update/delete with constraints)



optimization (index / efficiency goals)



2.2 SQL Execution \& Safety



The game must execute SQL against a real embedded database engine (e.g., H2 or SQLite).



The game must run all level SQL inside a controlled environment (sandboxed connection).



The game must prevent destructive actions outside mission rules (e.g., DROP DATABASE unless allowed).



The game must support deterministic resets (rebuild schema and seed data consistently).



2.3 Mission Evaluation



The game must validate mission success by comparing expected vs actual output.



Validation must support:



exact match (rows + columns)



order-insensitive match (when order doesn’t matter)



tolerance for equivalent queries (different SQL, same result)



The game must detect common wrong answers and map them to tailored feedback.



The game must show helpful error output (syntax + constraint violations) in a friendly format.



The game must support time-based challenges (optional mode).



2.4 Editor \& UI Features



The game must provide an SQL editor component with:



multiline editing



basic syntax highlighting (minimum viable: keywords + strings)



run button + keyboard shortcut



The game must display:



mission prompt + objectives



schema viewer (table/columns; ER diagram optional)



results panel



error/feedback panel



The game must support accessibility basics (font size, contrast, keyboard navigation).



2.5 Scoring \& Gamification



The game must award points/XP for completion.



The game should award bonus scoring for:



faster completion



fewer attempts



simpler/cleaner SQL (optional)



efficiency (optional advanced: explain/plan or timing)



The game must include achievements and unlock triggers.



3\) Non-Functional Requirements



Performance: query execution + evaluation should feel instant for small datasets (target: under ~200ms locally for most missions).



Reliability: resets must always produce the same database state.



Portability: run on Windows/macOS/Linux (Java 17+ recommended).



Maintainability: level content must be data-driven (JSON/YAML files) not hard-coded.



Testability: mission evaluation logic must be unit-testable without the UI.



Security/safety: prevent arbitrary file/network access from SQL execution context.



Offline-first: no internet required for core gameplay.



4\) Data \& Content Requirements



The game must include realistic datasets (not “Table1” nonsense).



The game must support per-level seed scripts for:



schema creation



inserts



optional “broken state” scripts (for debugging missions)



The game must support dataset scaling per difficulty (small → medium → larger).



The game should include multiple domains (e-commerce, university, game stats, social).



5\) Technical Requirements (Implementation-Oriented)



Use an embedded SQL DB (H2 is easiest in pure Java; SQLite requires JDBC driver too).



Provide a level loader (reads level definitions + SQL seed scripts).



Provide an evaluation engine:



executes player SQL



captures result set



normalizes result (order/case rules)



compares to expected result



Provide a feedback engine:



parses SQL exceptions



maps to user-friendly messages



attaches hints for known failure patterns



Provide a persistence layer for player progress (local file DB or JSON save).



Provide UI layer:



JavaFX recommended for desktop



Swing acceptable if you enjoy pain



6\) Acceptance Requirements (What “Done” Means)



A user can complete at least 10 levels end-to-end.



Levels cover SELECT→JOIN→GROUP BY→subqueries at minimum.



The database resets correctly every time.



The evaluation system correctly accepts different equivalent solutions.



Progress saves and loads reliably.



The UI consistently shows prompt, schema, editor, results, and feedback.



7\) Risk Notes (Because reality exists)



Equivalence checking is hard: “same output” is easier than “same intent.” Prefer result-set comparison first.



Scoring query “quality” is subjective unless you use explain plans and strict rules.



SQL dialect differences matter (H2 vs SQLite). Pick one and embrace it.



SYSTEM-DESIGN:



High-level Architecture



A modular desktop app with a real embedded SQL engine and a content-driven level system.



Layers



Presentation (UI)



Application (Game logic + orchestration)



Domain (Levels, evaluation, scoring, hints)



Infrastructure (DB engine, file storage, level loading)



1\) Core Components

1\. UI Layer (JavaFX recommended)



Screens / views:



Home/DashboardView: continue, level select, stats



LevelPlayView (main screen):



SQL editor panel



Schema panel (tables + relationships)



Mission panel (goal, constraints, examples)



Output panel (result set table)



Feedback panel (errors, hints, evaluation)



SandboxView: free DB playground



SettingsView: theme, font size, shortcuts



AchievementsView: badges, progress



UI components:



SqlEditorComponent (text area + highlighting optional)



ResultTableComponent (renders ResultSet)



SchemaBrowserComponent (tables/columns; ER diagram optional)



HintPanelComponent



2\. Application Layer (Orchestrators)



These coordinate the “what happens when user clicks Run.”



GameController



routes navigation



loads profile + progress



LevelController



loads a level



resets DB to level seed state



calls execution + evaluation



SandboxController



opens sandbox DB and runs queries



SettingsController



3\. Domain Layer (Game Logic)



This is where the real rules live.



Level Domain



Level



id, title, difficulty, tags



objective text



allowed SQL operations (optional restrictions)



evaluation spec



hints



schema + seed script refs



Evaluation Domain



EvaluationEngine



runs the user SQL (or set of statements if allowed)



normalizes output (sorting rules, whitespace rules)



compares to expected results or expected schema state



returns EvaluationResult



EvaluationResult



status: SUCCESS / FAIL / ERROR



message(s)



mismatch details (missing rows, extra rows, wrong columns)



hint suggestions (optional)



scoring inputs (time, attempts, efficiency)



Hint Domain



HintEngine



maps error patterns to hints



maps common wrong results to hints (optional advanced)



Scoring Domain



ScoringEngine



base XP for completion



bonuses: speed, fewer attempts, optional efficiency



Progress Domain



PlayerProfile



xp, level completions, achievements



settings



statistics (attempts, fastest time, etc.)



4\. Infrastructure Layer (DB + Storage + Content Loading)



Embedded SQL Engine

Pick one:



H2 (best for pure Java desktop simplicity)



SQLite via JDBC driver (fine, slightly more hassle)



Infrastructure services:



DatabaseService



creates per-level DB connection



applies schema + seed



runs queries



supports reset



supports “restricted mode” (block certain statements if needed)



LevelRepository



loads levels from /levels/\*.json (or YAML)



loads SQL seed scripts from /levels/sql/\*.sql



SaveGameRepository



persists PlayerProfile to local file (JSON) or embedded DB



TelemetryService (optional)



logs events locally: attempts, common errors



2\) Runtime Model (How a level works)

Per-Level Database Strategy (Recommended)



Each level has its own isolated DB state to avoid “the student nuked everything and now we’re sad.”



Two options:



In-memory DB (fast, clean reset)



On level load: create connection → apply schema.sql + seed.sql



On reset: recreate connection and rerun scripts



File-backed DB per level (persistent)



Useful if you want multi-step levels where state carries across tasks



More complexity



Recommendation: In-memory for most levels, file-backed only when needed.



3\) Key Flows

Flow A: Start Level



LevelController.load(levelId)



LevelRepository.getLevel(levelId)



DatabaseService.createLevelDb(levelId)



DatabaseService.apply(schema.sql)



DatabaseService.apply(seed.sql)



UI updates: schema viewer + mission text



Flow B: Run SQL



User writes SQL → clicks Run



LevelController.runQuery(sql)



DatabaseService.execute(sql)



If SQL error:



HintEngine.fromException(e)



show error + hint



If success:



EvaluationEngine.evaluate(resultSet | dbState)



ScoringEngine.compute(...)



SaveGameRepository.save(profile)



UI shows:



results table



evaluation feedback



XP changes + completion animation (if success)



Flow C: Reset Level



LevelController.reset()



Dispose current connection



Recreate DB



Reapply schema + seed



UI clears output + feedback



Flow D: Sandbox Mode



Single DB session with optional templates:



“Create a store DB”



“Create a leaderboard DB”



No evaluation, only feedback + optional tips



4\) Evaluation Strategies (Critical Design Choice)

Type 1: Result-set comparison (most common)



Run user query



Compare output to expected output



Support:



order-insensitive comparison



column name normalization



allow equivalent answers



Good for SELECT/JOIN/GROUP BY/subqueries.



Type 2: DB state comparison (for DDL/DML missions)



Player must:



create tables



add constraints



insert/update/delete



Evaluation checks:



schema exists



constraints present



row counts or specific records match



referential integrity holds



Good for CREATE/ALTER/INSERT/UPDATE/DELETE.



Type 3: Query pattern rules (optional)



Check presence of required concept:



must use JOIN not subquery



must use GROUP BY

This is more restrictive and can annoy students. Use sparingly.



5\) Level Content Format (Data-driven)



levels/level\_001.json



{

  "id": "level\_001",

  "title": "First SELECT",

  "objective": "Return all users who are older than 18.",

  "difficulty": 1,

  "tags": \["select", "where"],

  "db": {

    "schemaScript": "sql/level\_001\_schema.sql",

    "seedScript": "sql/level\_001\_seed.sql"

  },

  "mission": {

    "prompt": "List username and age for users older than 18.",

    "allowedStatements": \["SELECT"],

    "outputRules": {

      "orderMatters": false,

      "caseSensitive": false

    }

  },

  "evaluation": {

    "type": "RESULT\_SET",

    "expectedQuery": "SELECT username, age FROM users WHERE age > 18"

  },

  "hints": \[

    "Use SELECT to choose the columns.",

    "Use WHERE to filter by age.",

    "Condition should be age > 18."

  ]

}



Evaluation trick:



expectedQuery is executed on the same DB state to generate expected output.



Then compare user output to expected output.



This avoids shipping giant expected tables in JSON.



6\) Data Model (Core Entities)



Domain entities



Level(id, title, mission, evaluation, hints, dbScripts...)



Mission(prompt, allowedStatements, outputRules, timeLimit?)



EvaluationSpec(type, expectedQuery | expectedSchemaChecks | expectedStateChecks)



PlayerProfile(xp, completedLevels, achievements, settings, stats)



LevelAttempt(levelId, attempts, startTime, bestTime, lastResult)



7\) Security / Safety Controls (Yes, even offline)



Students will try DROP TABLE because humans can’t resist chaos.



Add statement filtering when a level restricts operations:



Basic SQL statement classifier:



allow only SELECT



block PRAGMA/ATTACH (SQLite)



block file/network features (H2 has some modes too)



Implementation approach:



Before execution, parse first keyword:



SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP



If not in allowed list → reject with friendly message.



8\) Recommended Tech Stack (Pragmatic)



Java 17+



JavaFX for UI



H2 embedded DB (simple and fast)



JSON parsing: Jackson or Gson



Save game: JSON file in user home folder



Optional: RichTextFX for a nicer editor (syntax highlighting)



9\) Folder Structure

src/

  ui/

    views/

    components/

  app/

    controllers/

  domain/

    level/

    evaluation/

    scoring/

    hints/

    progress/

  infra/

    db/

    storage/

    content/

assets/

  levels/

    level\_001.json

    sql/

      level\_001\_schema.sql

      level\_001\_seed.sql

10\) MVP Scope (So it actually ships)



MVP must include:



Level loader (JSON + SQL scripts)



In-memory DB per level with reset



SQL run + result viewer



Result-set evaluation against expectedQuery



Progress saving



10 levels covering SELECT → JOIN → GROUP BY → subqueries



Basic hints (static list + SQL exception mapping)



Everything else (ER diagram rendering, leaderboards, efficiency scoring) can come after you have a game that works.



AGENT TASKS(USE ALL AVAILABLE AGENTS):

MAIN (Project Bootstrap + Integration Owner)



Goal: Create the runnable Java app skeleton and integrate all modules.



Tasks



Create repo structure, build system (Gradle recommended), Java 17 baseline.



Add core dependencies:



JavaFX



H2 (or chosen embedded DB)



JSON parser (Jackson/Gson)



Define shared interfaces/contracts (so BACKEND/FRONTEND don’t invent their own universe):



LevelRepository



DatabaseService



EvaluationEngine



ProgressStore



DTOs: Level, Mission, EvaluationSpec, EvaluationResult, PlayerProfile



Define event flow contract for “Run SQL”:



input: levelId, sqlText



output: resultSetViewModel OR error + evaluation result



Create integration tests (smoke tests) that load a level, run a query, evaluate, save progress.



Continuous integration pipeline (basic: compile + unit tests).



Deliverables



App boots to a placeholder UI screen.



Interfaces + domain model classes exist and compile.



One sample level loads end-to-end via stubbed UI.



BACKEND (Game Engine Core)



Goal: Everything that’s not pixels: DB execution, level loading, evaluation, scoring, progress.



Tasks



Level System



Implement LevelRepository:



load assets/levels/\*.json



load referenced schema/seed SQL scripts



Validate level schema (missing files, malformed JSON).



Database Service



Implement DatabaseService using H2:



create in-memory DB per level session



apply schema.sql + seed.sql



execute user SQL



reset DB deterministically



Implement SQL statement restriction (based on allowedStatements).



Evaluation Engine



Implement EvaluationEngine supporting:



RESULT\_SET evaluation by running expectedQuery and comparing outputs



normalization rules: order-insensitive, case-insensitive, trim whitespace



Return rich EvaluationResult:



SUCCESS/FAIL/ERROR



mismatch details (missing/extra rows, column mismatch)



Hint Engine (MVP)



Map common SQLExceptions to friendly messages:



syntax error



table/column not found



constraint violation



Provide static hint ladder from level JSON.



Scoring + Progress



Implement ScoringEngine (MVP):



base XP per level + optional bonus for fewer attempts



Implement ProgressStore:



save/load PlayerProfile as local JSON



Backend Unit Tests



Level load tests



DB reset determinism tests



Evaluation equivalence tests (order-insensitive)



Restriction tests (block forbidden statements)



Deliverables



Backend can load a level and evaluate a query without UI.



Deterministic reset works.



Progress saves/loads.



FRONTEND (JavaFX UI + UX)



Goal: Build the player experience and wire it into backend contracts.



Tasks



Navigation + Layout



Home/Dashboard view:



Continue



Level select list (basic)



Player XP display



LevelPlay view (main screen) layout:



Mission panel (prompt/objectives)



SQL editor panel



Schema panel (table/columns list)



Results panel



Feedback/hints panel



SQL Editor MVP



Multiline editor



Run button + keyboard shortcut (Ctrl+Enter)



Clear/reset buttons



Optional basic keyword highlighting (nice-to-have)



Results Viewer



Render result sets as a table



Render empty results gracefully



Feedback \& Hints UX



Show SQL errors clearly



Show evaluation feedback (success/fail + mismatch summary)



Hint button cycles through hint ladder



Settings



Dark mode toggle (MVP: simple theme switch or stylesheet)



Font size scaling (optional)



State Wiring



Use LevelController / GameController from MAIN or directly call backend services



Maintain view model for:



current level



attempts count



timer (optional)



last result/evaluation



Deliverables



Playable UI for one level:



type SQL → run → see results → see pass/fail → progress updates.



QA (Test Strategy + Test Content + Automation)



Goal: Prevent the game from lying to students or crashing when they do normal student things (like break everything).



Tasks



Test Plan



Functional test matrix:



SELECT levels



JOIN levels



GROUP BY/HAVING



Subqueries



DDL/DML missions (if included)



UX validation checklist (errors readable, no freezes, reset works)



Automated Tests



Black-box backend tests:



For each level: expectedQuery passes



Known wrong queries fail with meaningful feedback



Regression tests for evaluation comparison (ordering, casing)



Edge Cases



Empty result set handling



Null values in result sets



Large text fields



Duplicate rows



Forbidden statements blocked properly



Level Content QA



Validate level JSON integrity



Validate SQL scripts run cleanly



Validate hints are relevant and escalate sensibly



Bug Reporting Standard



Template: steps, expected, actual, level id, SQL input, stack trace



Deliverables



Test suite runnable in CI.



Level validation report.



“Top 20 likely student screwups” test cases.



Supervisor (Coordination + Architecture Police)



Goal: Keep the project coherent and prevent agent drift.



Tasks



Finalize MVP scope and enforce it (no leaderboards before “Run SQL” works).



Own architecture decisions:



pick DB engine (H2 vs SQLite)



define level JSON schema



define evaluation rules + normalization standards



Define “contracts” and keep them stable:



DTO formats



service interfaces



error/evaluation payload shapes



Define milestone gates:



Gate 1: load level + show UI



Gate 2: run SQL + show results



Gate 3: evaluation + save progress



Gate 4: 10 levels playable



Review PRs for:



modularity



test coverage



deterministic resets



Maintain docs/:



architecture.md



level\_schema.md



contributor guidelines



Deliverables



Single source of truth docs + decisions.



Milestone checklist with acceptance criteria.



MILESTONES:

Milestone 1: Skeleton app + LevelPlay screen placeholder (MAIN + FRONTEND)



Milestone 2: Level loading + DB seed/reset + run query result rendering (BACKEND + FRONTEND)



Milestone 3: Evaluation engine + progress saving (BACKEND + MAIN)



Milestone 4: 10 levels + QA regression suite (QA + BACKEND)



Milestone 5: Polish (hints UX, dark mode, nicer schema view) (FRONTEND)



PLUPP YOU ARE THE COMPANY CEO IM THE MAIN STAKEHOLDER, YOU GOAL LEAD THIS COMPANY TO SUCCESS. USE SCRUM, BE ITERATIVE!



PLEASE UPDATE THIS PLAN IF YOU NEED TO

