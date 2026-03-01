package com.plupp.sqlgame.store;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plupp.sqlgame.model.LeaderboardEntry;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public class LeaderboardStore {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<LeaderboardEntry>> TYPE = new TypeReference<>() {};

    private final Path path;

    public LeaderboardStore(Path path) {
        this.path = path;
    }

    public synchronized void submit(LeaderboardEntry entry) {
        List<LeaderboardEntry> entries = loadAll();
        entries.add(entry);
        saveAll(entries);
    }

    public synchronized List<LeaderboardEntry> top(int limit) {
        int normalizedLimit = Math.max(1, Math.min(100, limit));
        return loadAll().stream()
                .sorted(Comparator
                        .comparingInt((LeaderboardEntry e) -> e.score).reversed()
                        .thenComparingLong(e -> e.achievedAtEpochMs))
                .limit(normalizedLimit)
                .toList();
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
}
