package com.plupp.sqlgame.store;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.plupp.sqlgame.model.ProgressState;

import java.nio.file.Files;
import java.nio.file.Path;

public class ProgressStore {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private final Path path;

    public ProgressStore(Path path) {
        this.path = path;
    }

    public ProgressState load() {
        try {
            if (!Files.exists(path)) return new ProgressState();
            return MAPPER.readValue(path.toFile(), ProgressState.class);
        } catch (Exception e) {
            return new ProgressState();
        }
    }

    public void save(ProgressState state) {
        try {
            Files.createDirectories(path.getParent());
            MAPPER.writerWithDefaultPrettyPrinter().writeValue(path.toFile(), state);
        } catch (Exception e) {
            throw new RuntimeException("Failed to save progress", e);
        }
    }
}