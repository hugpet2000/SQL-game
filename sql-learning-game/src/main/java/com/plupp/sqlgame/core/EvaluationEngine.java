package com.plupp.sqlgame.core;

import com.plupp.sqlgame.model.*;
import com.plupp.sqlgame.store.ProgressStore;

import java.util.*;

public class EvaluationEngine {
    private final SqlRunner runner;
    private final ProgressStore progressStore;

    public EvaluationEngine(SqlRunner runner, ProgressStore progressStore) {
        this.runner = runner;
        this.progressStore = progressStore;
    }

    public EvaluationResult evaluate(LevelDefinition level, String sql) {
        ProgressState progress = progressStore.load();
        progress.attemptsByLevel.merge(level.id, 1, Integer::sum);

        QueryResult player = runner.runForLevel(level, sql);
        EvaluationResult out = new EvaluationResult();
        out.playerResult = player;

        if (!player.isOk()) {
            out.success = false;
            out.feedback = player.error;
            progressStore.save(progress);
            return out;
        }

        QueryResult expected = runner.runExpected(level);
        if (!expected.isOk()) {
            out.success = false;
            out.feedback = "Level config error: expected query failed.";
            progressStore.save(progress);
            return out;
        }

        boolean matches = compare(player, expected, level.orderMatters);
        out.success = matches;

        int attempts = progress.attemptsByLevel.getOrDefault(level.id, 1);
        if (matches) {
            double multiplier = difficultyMultiplier(level.difficulty);
            int speedBonus = player.executionMs < 120 ? 35 : player.executionMs < 220 ? 20 : 0;
            int attemptBonus = attempts == 1 ? 40 : attempts <= 3 ? 20 : 0;
            int cleanSql = sql.length() < 140 ? 15 : 0;
            // TODO: Compute score contribution from EXPLAIN plan quality.
            out.planScore = 0;

            int scaledBonus = (int) Math.round((speedBonus + attemptBonus + cleanSql + out.planScore) * multiplier);
            out.score = 100 + scaledBonus;
            out.xpAwarded = level.xp + (out.score / 5) + difficultyXpBonus(level.difficulty);
            out.feedback = successFeedback(level, attempts);

            progress.totalXp += out.xpAwarded;
            progress.completedLevels.add(level.id);
            progress.bestTimeMsByLevel.merge(level.id, player.executionMs, Math::min);

            unlock(progress, out, level.id, attempts, player.executionMs);
        } else {
            out.feedback = mismatchFeedback(attempts);
        }

        progressStore.save(progress);
        return out;
    }

    private double difficultyMultiplier(String difficulty) {
        if (difficulty == null) return 1.0;
        return switch (difficulty.toLowerCase(Locale.ROOT)) {
            case "intermediate" -> 1.10;
            case "advanced" -> 1.25;
            case "boss" -> 1.40;
            default -> 1.0;
        };
    }

    private int difficultyXpBonus(String difficulty) {
        if (difficulty == null) return 0;
        return switch (difficulty.toLowerCase(Locale.ROOT)) {
            case "intermediate" -> 10;
            case "advanced" -> 25;
            case "boss" -> 45;
            default -> 0;
        };
    }

    private String successFeedback(LevelDefinition level, int attempts) {
        if (level.encouragement != null && !level.encouragement.isBlank()) {
            return level.encouragement;
        }
        if (attempts == 1) return "Great solve. First-try clear.";
        if (attempts <= 3) return "Nice recovery. Mission cleared.";
        return "You stuck with it and solved it. Strong finish.";
    }

    private String mismatchFeedback(int attempts) {
        if (attempts <= 2) return "Close. Query runs, but result shape/content is off.";
        return "Still close. Re-check joins, filters, and expected columns/order.";
    }

    private void unlock(ProgressState progress, EvaluationResult out, String levelId, int attempts, long timeMs) {
        award(progress, out, "first-mission", progress.completedLevels.size() == 1);
        award(progress, out, "one-shot-" + levelId, attempts == 1);
        award(progress, out, "speed-runner", timeMs < 100);
        award(progress, out, "sql-apprentice", progress.completedLevels.size() >= 5);
        award(progress, out, "sql-architect", progress.completedLevels.size() >= 10);
    }

    private void award(ProgressState progress, EvaluationResult out, String key, boolean cond) {
        if (cond && progress.achievements.add(key)) {
            out.unlockedAchievements.add(key);
        }
    }

    private boolean compare(QueryResult player, QueryResult expected, boolean orderMatters) {
        if (!Objects.equals(player.columns, expected.columns)) return false;

        List<List<String>> p = new ArrayList<>(player.rows);
        List<List<String>> e = new ArrayList<>(expected.rows);

        if (!orderMatters) {
            Comparator<List<String>> cmp = Comparator.comparing(Object::toString);
            p.sort(cmp);
            e.sort(cmp);
        }
        return p.equals(e);
    }
}
