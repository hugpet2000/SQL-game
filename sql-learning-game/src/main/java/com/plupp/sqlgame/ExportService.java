package com.plupp.sqlgame;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plupp.sqlgame.model.LeaderboardEntry;
import com.plupp.sqlgame.model.PlayerProfile;
import com.plupp.sqlgame.model.ProgressState;

import java.nio.file.Files;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class ExportService {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<LeaderboardEntry>> LEADERBOARD_TYPE = new TypeReference<>() {};
    private static final TypeReference<Map<String, Object>> TELEMETRY_TYPE = new TypeReference<>() {};

    private final RuntimeConfig config;

    public ExportService(RuntimeConfig config) {
        this.config = config;
    }

    public Map<String, Object> exportSnapshot() {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("ok", true);
            payload.put("exportedAt", Instant.now().toString());
            payload.put("progress", readJson(config.progressPath, ProgressState.class, new ProgressState()));
            payload.put("leaderboard", readJson(config.leaderboardPath, LEADERBOARD_TYPE, List.of()));
            payload.put("player", readJson(config.playerPath, PlayerProfile.class, new PlayerProfile()));
            payload.put("telemetry", readNdjson(config.telemetryPath));
            return payload;
        } catch (Exception e) {
            return Map.of(
                    "ok", false,
                    "error", "Failed to export snapshot: " + e.getMessage()
            );
        }
    }

    private static <T> T readJson(java.nio.file.Path path, Class<T> type, T fallback) {
        try {
            if (!Files.exists(path)) return fallback;
            T value = MAPPER.readValue(path.toFile(), type);
            return value == null ? fallback : value;
        } catch (Exception e) {
            return fallback;
        }
    }

    private static <T> T readJson(java.nio.file.Path path, TypeReference<T> type, T fallback) {
        try {
            if (!Files.exists(path)) return fallback;
            T value = MAPPER.readValue(path.toFile(), type);
            return value == null ? fallback : value;
        } catch (Exception e) {
            return fallback;
        }
    }

    private static List<Map<String, Object>> readNdjson(java.nio.file.Path path) {
        try {
            if (!Files.exists(path)) return List.of();
            List<String> lines = Files.readAllLines(path);
            if (lines.isEmpty()) return List.of();

            List<Map<String, Object>> rows = new ArrayList<>();
            for (String line : lines) {
                if (line == null || line.isBlank()) continue;
                try {
                    Map<String, Object> row = MAPPER.readValue(line, TELEMETRY_TYPE);
                    if (row != null) {
                        rows.add(row);
                    }
                } catch (Exception ignored) {
                    // tolerate malformed lines
                }
            }
            return rows;
        } catch (Exception e) {
            return List.of();
        }
    }
}
