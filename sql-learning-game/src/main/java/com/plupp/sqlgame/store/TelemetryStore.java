package com.plupp.sqlgame.store;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plupp.sqlgame.model.TelemetryEvent;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class TelemetryStore {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final Path path;

    public TelemetryStore(Path path) {
        this.path = path;
    }

    public synchronized boolean record(TelemetryEvent event) {
        if (event == null || isBlank(event.type) || isBlank(event.levelId)) return false;

        try {
            Files.createDirectories(path.getParent());
            String line = MAPPER.writeValueAsString(event.toPayload()) + System.lineSeparator();
            Files.writeString(path, line, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public synchronized List<TelemetryEvent> recent(int limit) {
        try {
            if (!Files.exists(path)) return List.of();
            List<String> lines = Files.readAllLines(path);
            if (lines.isEmpty()) return List.of();

            List<TelemetryEvent> events = new ArrayList<>();
            for (String line : lines) {
                if (line == null || line.isBlank()) continue;
                try {
                    TelemetryEvent event = MAPPER.readValue(line, new TypeReference<>() {});
                    events.add(event);
                } catch (Exception ignored) {
                    // tolerate malformed lines
                }
            }

            if (events.isEmpty()) return List.of();
            int safeLimit = Math.max(1, limit);
            int from = Math.max(0, events.size() - safeLimit);
            return Collections.unmodifiableList(events.subList(from, events.size()));
        } catch (Exception e) {
            return List.of();
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
