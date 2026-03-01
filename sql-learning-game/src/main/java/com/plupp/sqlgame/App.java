package com.plupp.sqlgame;

import com.plupp.sqlgame.core.EvaluationEngine;
import com.plupp.sqlgame.core.LevelRepository;
import com.plupp.sqlgame.core.SqlRunner;
import com.plupp.sqlgame.core.UnlockService;
import com.plupp.sqlgame.model.LeaderboardEntry;
import com.plupp.sqlgame.model.LevelDefinition;
import com.plupp.sqlgame.model.ProgressState;
import com.plupp.sqlgame.store.LeaderboardStore;
import com.plupp.sqlgame.store.ProgressStore;
import io.javalin.Javalin;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class App {
    public static Javalin create(LevelRepository levels, SqlRunner runner, ProgressStore progressStore, LeaderboardStore leaderboardStore) {
        EvaluationEngine evaluator = new EvaluationEngine(runner, progressStore);
        UnlockService unlockService = new UnlockService();

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

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("id", level.id);
            payload.put("title", level.title);
            payload.put("difficulty", level.difficulty);
            payload.put("objective", level.objective);
            payload.put("prompt", level.prompt);
            payload.put("hints", level.hints == null ? List.of() : level.hints);
            payload.put("allowedCommands", level.allowedCommands == null ? List.of() : level.allowedCommands);

            ctx.json(payload);
        });

        app.get("/api/levels/{id}/schema", ctx -> {
            String id = ctx.pathParam("id");
            LevelDefinition level = levels.byId(id).orElseThrow(() -> new IllegalArgumentException("Unknown level"));
            ctx.json(runner.schemaForLevel(level));
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

        app.get("/api/levels/unlocked", ctx -> {
            ProgressState progress = progressStore.load();
            List<LevelDefinition> allLevels = levels.list();
            List<String> unlocked = unlockService.unlockedLevels(allLevels, progress).stream().map(l -> l.id).toList();
            ctx.json(Map.of("unlockedLevels", unlocked));
        });

        app.get("/api/unlocked-levels", ctx -> {
            ProgressState progress = progressStore.load();
            List<LevelDefinition> allLevels = levels.list();
            List<String> unlocked = unlockService.unlockedLevels(allLevels, progress).stream().map(l -> l.id).toList();
            ctx.json(Map.of("unlocked", unlocked));
        });

        app.post("/api/leaderboard/submit", ctx -> {
            SubmitRequest request = ctx.bodyAsClass(SubmitRequest.class);
            String nickname = sanitizeNickname(request.nickname);
            if (nickname.isBlank()) nickname = "Anonymous";
            if (request.score <= 0) {
                ctx.status(400).json(Map.of("ok", false, "error", "Score must be > 0"));
                return;
            }

            String levelId = request.levelId == null || request.levelId.isBlank() ? "unknown" : request.levelId;
            LeaderboardEntry entry = new LeaderboardEntry(nickname, request.score, levelId, System.currentTimeMillis());
            leaderboardStore.submit(entry);
            ctx.json(Map.of("ok", true, "entry", entry));
        });

        app.get("/api/leaderboard/top", ctx -> {
            int limit = Math.max(1, ctx.queryParamAsClass("limit", Integer.class).getOrDefault(10));
            ctx.json(leaderboardStore.top(limit));
        });

        app.exception(IllegalArgumentException.class, (e, ctx) -> ctx.status(404).json(Map.of("error", e.getMessage())));

        return app;
    }

    private static String sanitizeNickname(String raw) {
        if (raw == null) return "";
        String trimmed = raw.trim();
        if (trimmed.length() > 20) trimmed = trimmed.substring(0, 20);
        return trimmed.replaceAll("[^A-Za-z0-9 _.-]", "");
    }

    public static class SubmitRequest {
        public String nickname;
        public int score;
        public String levelId;
    }
}
