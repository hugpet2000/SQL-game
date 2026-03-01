package com.plupp.sqlgame.store;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plupp.sqlgame.model.LeaderboardEntry;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class LeaderboardStore {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<LeaderboardEntry>> TYPE = new TypeReference<>() {};

    private final Path path;

    public LeaderboardStore(Path path) {
        this.path = path;
    }

    public synchronized LeaderboardEntry submit(LeaderboardEntry entry) {
        List<LeaderboardEntry> entries = loadAll();

        int existingIndex = -1;
        for (int i = 0; i < entries.size(); i++) {
            LeaderboardEntry existing = entries.get(i);
            if (sameScoreKey(existing, entry)) {
                existingIndex = i;
                break;
            }
        }

        if (existingIndex >= 0) {
            LeaderboardEntry existing = entries.get(existingIndex);
            if (entry.score > existing.score) {
                entries.set(existingIndex, new LeaderboardEntry(
                        canonicalPlayerId(entry),
                        safeNickname(entry.nickname),
                        entry.score,
                        safeLevelId(entry.levelId),
                        entry.achievedAtEpochMs
                ));
            } else if (entry.score == existing.score && entry.achievedAtEpochMs < existing.achievedAtEpochMs) {
                existing.achievedAtEpochMs = entry.achievedAtEpochMs;
                if (!safeNickname(entry.nickname).isBlank()) {
                    existing.nickname = safeNickname(entry.nickname);
                }
            }
        } else {
            entries.add(new LeaderboardEntry(
                    canonicalPlayerId(entry),
                    safeNickname(entry.nickname),
                    entry.score,
                    safeLevelId(entry.levelId),
                    entry.achievedAtEpochMs
            ));
        }

        saveAll(entries);

        return entries.stream().filter(e -> sameScoreKey(e, entry)).findFirst().orElse(entry);
    }

    public synchronized List<LeaderboardEntry> top(int limit) {
        int normalizedLimit = Math.max(1, Math.min(100, limit));
        return globalTop(normalizedLimit);
    }

    public synchronized List<LeaderboardEntry> globalTop(int limit) {
        int normalizedLimit = Math.max(1, Math.min(100, limit));
        List<LeaderboardEntry> deduped = dedupedBestPerPlayerPerLevel(loadAll());

        Map<String, PlayerAggregate> byPlayer = new HashMap<>();
        for (LeaderboardEntry row : deduped) {
            String key = canonicalPlayerKey(row);
            PlayerAggregate agg = byPlayer.computeIfAbsent(key, k -> new PlayerAggregate(canonicalPlayerId(row), safeNickname(row.nickname)));
            agg.scoreSum += row.score;
            agg.bestAchievedAt = Math.min(agg.bestAchievedAt, row.achievedAtEpochMs);
            if (!safeNickname(row.nickname).isBlank()) {
                agg.nickname = safeNickname(row.nickname);
            }
        }

        return byPlayer.values().stream()
                .map(a -> new LeaderboardEntry(a.playerId, a.nickname, a.scoreSum, "all", a.bestAchievedAt == Long.MAX_VALUE ? System.currentTimeMillis() : a.bestAchievedAt))
                .sorted(Comparator
                        .comparingInt((LeaderboardEntry e) -> e.score).reversed()
                        .thenComparingLong(e -> e.achievedAtEpochMs)
                        .thenComparing(e -> safeNickname(e.nickname)))
                .limit(normalizedLimit)
                .toList();
    }

    public synchronized Map<String, List<LeaderboardEntry>> perLevelTop(int limitPerLevel) {
        int normalizedLimit = Math.max(1, Math.min(100, limitPerLevel));
        List<LeaderboardEntry> deduped = dedupedBestPerPlayerPerLevel(loadAll());

        Map<String, List<LeaderboardEntry>> grouped = new HashMap<>();
        for (LeaderboardEntry row : deduped) {
            grouped.computeIfAbsent(safeLevelId(row.levelId), k -> new ArrayList<>()).add(row);
        }

        Map<String, List<LeaderboardEntry>> sorted = new LinkedHashMap<>();
        grouped.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(e -> sorted.put(e.getKey(), e.getValue().stream()
                        .sorted(Comparator
                                .comparingInt((LeaderboardEntry r) -> r.score).reversed()
                                .thenComparingLong(r -> r.achievedAtEpochMs)
                                .thenComparing(r -> safeNickname(r.nickname)))
                        .limit(normalizedLimit)
                        .toList()));

        return sorted;
    }

    private List<LeaderboardEntry> dedupedBestPerPlayerPerLevel(List<LeaderboardEntry> rows) {
        Map<String, LeaderboardEntry> byKey = new LinkedHashMap<>();

        for (LeaderboardEntry row : rows) {
            String key = canonicalPlayerKey(row) + "|" + safeLevelId(row.levelId);
            LeaderboardEntry existing = byKey.get(key);
            if (existing == null || row.score > existing.score || (row.score == existing.score && row.achievedAtEpochMs < existing.achievedAtEpochMs)) {
                byKey.put(key, normalize(row));
            }
        }

        return new ArrayList<>(byKey.values());
    }

    private LeaderboardEntry normalize(LeaderboardEntry row) {
        return new LeaderboardEntry(
                canonicalPlayerId(row),
                safeNickname(row.nickname),
                row.score,
                safeLevelId(row.levelId),
                row.achievedAtEpochMs
        );
    }

    private boolean sameScoreKey(LeaderboardEntry left, LeaderboardEntry right) {
        return canonicalPlayerKey(left).equals(canonicalPlayerKey(right))
                && safeLevelId(left.levelId).equals(safeLevelId(right.levelId));
    }

    private String canonicalPlayerKey(LeaderboardEntry row) {
        if (!isBlank(row.playerId)) return "id:" + row.playerId.trim();
        return "legacy:" + safeNickname(row.nickname).toLowerCase();
    }

    private String canonicalPlayerId(LeaderboardEntry row) {
        if (!isBlank(row.playerId)) return row.playerId.trim();
        return null;
    }

    private static String safeLevelId(String levelId) {
        if (levelId == null || levelId.isBlank()) return "unknown";
        return levelId;
    }

    private static String safeNickname(String nickname) {
        if (nickname == null || nickname.isBlank()) return "Anonymous";
        return nickname;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private List<LeaderboardEntry> loadAll() {
        try {
            if (!Files.exists(path)) return new ArrayList<>();
            List<LeaderboardEntry> entries = MAPPER.readValue(path.toFile(), TYPE);
            return entries == null ? new ArrayList<>() : new ArrayList<>(entries);
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private void saveAll(List<LeaderboardEntry> entries) {
        try {
            Files.createDirectories(path.getParent());
            MAPPER.writerWithDefaultPrettyPrinter().writeValue(path.toFile(), entries);
        } catch (Exception e) {
            throw new RuntimeException("Failed to save leaderboard", e);
        }
    }

    private static class PlayerAggregate {
        String playerId;
        String nickname;
        int scoreSum;
        long bestAchievedAt = Long.MAX_VALUE;

        PlayerAggregate(String playerId, String nickname) {
            this.playerId = playerId;
            this.nickname = nickname;
        }
    }
}
