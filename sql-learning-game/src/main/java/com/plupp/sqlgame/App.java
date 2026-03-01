package com.plupp.sqlgame;

import com.plupp.sqlgame.core.EvaluationEngine;
import com.plupp.sqlgame.core.LevelRepository;
import com.plupp.sqlgame.core.SqlRunner;
import com.plupp.sqlgame.core.UnlockService;
import com.plupp.sqlgame.model.LeaderboardEntry;
import com.plupp.sqlgame.model.LevelDefinition;
import com.plupp.sqlgame.model.PlayerProfile;
import com.plupp.sqlgame.model.ProgressState;
import com.plupp.sqlgame.model.TelemetryEvent;
import com.plupp.sqlgame.store.LeaderboardStore;
import com.plupp.sqlgame.store.PlayerStore;
import com.plupp.sqlgame.store.ProgressStore;
import com.plupp.sqlgame.store.TelemetryStore;
import io.javalin.Javalin;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class App {
    private static final Set<String> ALLOWED_TELEMETRY_TYPES = Set.of("level_attempt", "hint_used", "solve_time");

    public static Javalin create(LevelRepository levels, SqlRunner runner, ProgressStore progressStore, LeaderboardStore leaderboardStore, PlayerStore playerStore) {
        return create(levels, runner, progressStore, leaderboardStore, playerStore, null, RuntimeConfig.localDefaults());
    }

    public static Javalin create(LevelRepository levels, SqlRunner runner, ProgressStore progressStore, LeaderboardStore leaderboardStore, PlayerStore playerStore, TelemetryStore telemetryStore) {
        return create(levels, runner, progressStore, leaderboardStore, playerStore, telemetryStore, RuntimeConfig.localDefaults());
    }

    public static Javalin create(LevelRepository levels, SqlRunner runner, ProgressStore progressStore, LeaderboardStore leaderboardStore, PlayerStore playerStore, TelemetryStore telemetryStore, RuntimeConfig runtimeConfig) {
        EvaluationEngine evaluator = new EvaluationEngine(runner, progressStore);
        UnlockService unlockService = new UnlockService();

        levels.list().forEach(runner::reset);

        Javalin app = Javalin.create(config -> config.staticFiles.add("static"));
        HostedAuthGuard authGuard = new HostedAuthGuard(runtimeConfig);
        BackupService backupService = new BackupService(runtimeConfig);
        ExportService exportService = new ExportService(runtimeConfig);

        app.beforeMatched(ctx -> {
            if (ctx.path().startsWith("/api") && !ctx.path().equals("/api/health")) {
                authGuard.enforce(ctx);
            }
        });

        app.get("/api/health", ctx -> ctx.json(Map.of("ok", true)));

        app.get("/api/player", ctx -> ctx.json(playerStore.loadOrCreate()));

        app.post("/api/player", ctx -> {
            PlayerRequest request = ctx.bodyAsClass(PlayerRequest.class);
            String nickname = sanitizeNickname(request.nickname);
            if (nickname.isBlank()) nickname = "Anonymous";
            ctx.json(playerStore.updateNickname(nickname));
        });

        app.get("/api/levels", ctx -> ctx.json(levels.list().stream().map(l -> Map.of(
                "id", l.id,
                "title", l.title,
                "difficulty", l.difficulty,
                "objective", l.objective,
                "xp", l.xp
        )).toList()));

        app.get("/api/levels/unlocked", ctx -> {
            ProgressState progress = progressStore.load();
            List<LevelDefinition> allLevels = levels.list();
            List<String> unlocked = unlockService.unlockedLevels(allLevels, progress).stream().map(l -> l.id).toList();
            ctx.json(unlockedPayload(unlocked));
        });

        app.get("/api/unlocked-levels", ctx -> {
            ProgressState progress = progressStore.load();
            List<LevelDefinition> allLevels = levels.list();
            List<String> unlocked = unlockService.unlockedLevels(allLevels, progress).stream().map(l -> l.id).toList();
            ctx.json(unlockedPayload(unlocked));
        });

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

        app.post("/api/telemetry/event", ctx -> {
            TelemetryRequest request = ctx.bodyAsClass(TelemetryRequest.class);
            if (telemetryStore == null || !isValidTelemetryRequest(request)) {
                ctx.json(Map.of("ok", false));
                return;
            }

            PlayerProfile profile = playerStore.loadOrCreate();
            TelemetryEvent event = new TelemetryEvent(
                    request.type,
                    request.levelId,
                    profile.playerId,
                    request.durationMs,
                    request.hintIndex,
                    System.currentTimeMillis()
            );
            ctx.json(Map.of("ok", telemetryStore.record(event)));
        });

        app.get("/api/telemetry/recent", ctx -> {
            if (telemetryStore == null) {
                ctx.json(List.of());
                return;
            }
            int limit = Math.max(1, ctx.queryParamAsClass("limit", Integer.class).getOrDefault(50));
            ctx.json(telemetryStore.recent(limit));
        });

        app.post("/api/leaderboard/submit", ctx -> {
            SubmitRequest request = ctx.bodyAsClass(SubmitRequest.class);
            if (request.score <= 0) {
                ctx.status(400).json(Map.of("ok", false, "error", "Score must be > 0"));
                return;
            }

            PlayerProfile profile = playerStore.loadOrCreate();
            String nickname = sanitizeNickname(request.nickname);
            if (!nickname.isBlank() && !nickname.equals(profile.nickname)) {
                profile = playerStore.updateNickname(nickname);
            }

            String levelId = request.levelId == null || request.levelId.isBlank() ? "unknown" : request.levelId;
            LeaderboardEntry entry = new LeaderboardEntry(
                    profile.playerId,
                    profile.nickname,
                    request.score,
                    levelId,
                    System.currentTimeMillis()
            );
            LeaderboardEntry saved = leaderboardStore.submit(entry);
            ctx.json(Map.of("ok", true, "entry", saved));
        });

        app.get("/api/leaderboard/top", ctx -> {
            int limit = Math.max(1, ctx.queryParamAsClass("limit", Integer.class).getOrDefault(10));
            ctx.json(leaderboardStore.top(limit));
        });

        app.get("/api/leaderboard/view", ctx -> {
            int limit = Math.max(1, ctx.queryParamAsClass("limit", Integer.class).getOrDefault(10));
            ctx.json(Map.of(
                    "globalTop", leaderboardStore.globalTop(limit),
                    "perLevelTop", leaderboardStore.perLevelTop(limit)
            ));
        });

        app.post("/api/admin/backup", ctx -> {
            Map<String, Object> result = backupService.backupNow();
            if (Boolean.FALSE.equals(result.get("ok"))) {
                ctx.status(500);
            }
            ctx.json(result);
        });

        app.get("/api/admin/export", ctx -> {
            Map<String, Object> result = exportService.exportSnapshot();
            if (Boolean.FALSE.equals(result.get("ok"))) {
                ctx.status(500);
            }
            ctx.json(result);
        });

        app.exception(IllegalArgumentException.class, (e, ctx) -> ctx.status(404).json(Map.of("error", e.getMessage())));

        return app;
    }

    private static boolean isValidTelemetryRequest(TelemetryRequest request) {
        return request != null
                && request.levelId != null
                && !request.levelId.isBlank()
                && request.type != null
                && ALLOWED_TELEMETRY_TYPES.contains(request.type);
    }

    private static String sanitizeNickname(String raw) {
        if (raw == null) return "";
        String trimmed = raw.trim();
        if (trimmed.length() > 20) trimmed = trimmed.substring(0, 20);
        return trimmed.replaceAll("[^A-Za-z0-9 _.-]", "");
    }

    private static Map<String, Object> unlockedPayload(List<String> unlocked) {
        return Map.of(
                "unlocked", unlocked,
                "unlockedLevels", unlocked
        );
    }


    public static class SubmitRequest {
        public String nickname;
        public int score;
        public String levelId;
    }

    public static class PlayerRequest {
        public String nickname;
    }

    public static class TelemetryRequest {
        public String type;
        public String levelId;
        public Long durationMs;
        public Long hintIndex;
    }
}
