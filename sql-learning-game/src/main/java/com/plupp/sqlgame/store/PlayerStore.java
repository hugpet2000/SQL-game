package com.plupp.sqlgame.store;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.plupp.sqlgame.model.PlayerProfile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

public class PlayerStore {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final Path path;

    public PlayerStore(Path path) {
        this.path = path;
    }

    public synchronized PlayerProfile loadOrCreate() {
        PlayerProfile existing = loadRaw();
        long now = System.currentTimeMillis();
        if (existing == null || isBlank(existing.playerId)) {
            PlayerProfile created = new PlayerProfile(
                    UUID.randomUUID().toString(),
                    normalizeNickname(existing == null ? null : existing.nickname),
                    now,
                    now
            );
            save(created);
            return created;
        }

        if (isBlank(existing.nickname)) {
            existing.nickname = "Anonymous";
        }
        if (existing.createdAt <= 0) {
            existing.createdAt = now;
        }
        existing.lastSeenAt = now;
        save(existing);
        return existing;
    }

    public synchronized PlayerProfile updateNickname(String nickname) {
        PlayerProfile profile = loadOrCreate();
        profile.nickname = normalizeNickname(nickname);
        profile.lastSeenAt = System.currentTimeMillis();
        save(profile);
        return profile;
    }

    private PlayerProfile loadRaw() {
        try {
            if (!Files.exists(path)) return null;
            return MAPPER.readValue(path.toFile(), PlayerProfile.class);
        } catch (Exception e) {
            return null;
        }
    }

    private void save(PlayerProfile profile) {
        try {
            Files.createDirectories(path.getParent());
            MAPPER.writerWithDefaultPrettyPrinter().writeValue(path.toFile(), profile);
        } catch (Exception e) {
            throw new RuntimeException("Failed to save player profile", e);
        }
    }

    private static String normalizeNickname(String raw) {
        if (raw == null) return "Anonymous";
        String trimmed = raw.trim();
        if (trimmed.length() > 20) trimmed = trimmed.substring(0, 20);
        String sanitized = trimmed.replaceAll("[^A-Za-z0-9 _.-]", "");
        return sanitized.isBlank() ? "Anonymous" : sanitized;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
