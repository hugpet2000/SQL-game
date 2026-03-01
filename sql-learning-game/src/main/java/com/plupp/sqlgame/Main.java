package com.plupp.sqlgame;

import com.plupp.sqlgame.core.EvaluationEngine;
import com.plupp.sqlgame.core.LevelRepository;
import com.plupp.sqlgame.core.SqlRunner;
import com.plupp.sqlgame.model.LevelDefinition;
import com.plupp.sqlgame.store.ProgressStore;
import io.javalin.Javalin;

import java.nio.file.Path;
import java.util.Map;

public class Main {
    public static void main(String[] args) {
        LevelRepository levels = new LevelRepository();
        SqlRunner runner = new SqlRunner();
        ProgressStore progressStore = new ProgressStore(Path.of("data", "progress.json"));
        EvaluationEngine evaluator = new EvaluationEngine(runner, progressStore);

        levels.list().forEach(runner::reset);

        Javalin app = Javalin.create(config -> config.staticFiles.add("static"));

        app.get("/api/health", ctx -> ctx.json(Map.of("ok", true)));

        app.get("/api/levels", ctx -> ctx.json(levels.list().stream().map(l -> Map.of(
                "id", l.id,
                "title", l.title,
                "difficulty", l.difficulty,
                "objective", l.objective,
                "xp", l.xp
        )).toList()));

        app.get("/api/levels/{id}", ctx -> {
            String id = ctx.pathParam("id");
            LevelDefinition level = levels.byId(id).orElseThrow(() -> new IllegalArgumentException("Unknown level"));
            ctx.json(Map.of(
                    "id", level.id,
                    "title", level.title,
                    "difficulty", level.difficulty,
                    "objective", level.objective,
                    "prompt", level.prompt,
                    "hints", level.hints,
                    "allowedCommands", level.allowedCommands
            ));
        });

        app.post("/api/levels/{id}/run", ctx -> {
            String id = ctx.pathParam("id");
            String sql = ctx.body();
            LevelDefinition level = levels.byId(id).orElseThrow(() -> new IllegalArgumentException("Unknown level"));
            ctx.json(evaluator.evaluate(level, sql));
        });

        app.post("/api/levels/{id}/reset", ctx -> {
            String id = ctx.pathParam("id");
            LevelDefinition level = levels.byId(id).orElseThrow(() -> new IllegalArgumentException("Unknown level"));
            runner.reset(level);
            ctx.json(Map.of("ok", true));
        });

        app.post("/api/sandbox/run", ctx -> {
            String sql = ctx.body();
            ctx.json(runner.runSandbox(sql));
        });

        app.get("/api/progress", ctx -> ctx.json(progressStore.load()));

        app.start(7070);
        System.out.println("SQL Learning Game running on http://localhost:7070");
    }
}