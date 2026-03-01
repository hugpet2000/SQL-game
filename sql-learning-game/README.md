# SQL Learning Game (Java)

A developer-style SQL learning game for young tech students (16–25), built in Java.

## What is included

- Campaign with **10 progressive missions** (beginner → boss)
- Real SQL execution via **H2 embedded DB**
- Deterministic level reset (schema + seed SQL)
- Query evaluator: correctness, timing, score, XP, achievements
- Friendly SQL error feedback
- Optional hints with escalation
- Persistent progress (`data/progress.json`)
- Sandbox mode for free experimentation
- Dark-mode web UI (local/offline-first)

## Tech

- Java 17+
- Javalin (lightweight local web server)
- H2 (embedded SQL engine)
- Jackson (YAML/JSON)

## Run

```bash
mvn -q exec:java
```

Open: http://localhost:7070

## Project structure

- `src/main/java/com/plupp/sqlgame/core` — level loading, SQL execution, evaluation
- `src/main/java/com/plupp/sqlgame/store` — progress persistence
- `src/main/resources/levels` — data-driven level definitions
- `src/main/resources/static` — frontend UI

## Notes

- This environment currently lacks `javac`, so local compile/test may require installing a JDK package.
- Designed to be extensible: add more YAML levels without changing evaluator logic.
