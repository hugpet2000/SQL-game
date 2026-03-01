package com.plupp.sqlgame;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.LinkedHashMap;
import java.util.Map;

public class BackupService {
    private final RuntimeConfig config;

    public BackupService(RuntimeConfig config) {
        this.config = config;
    }

    public Map<String, Object> backupNow() {
        String label = config.newBackupLabel();
        Path backupRoot = config.backupDir.resolve(label);

        Map<String, Object> copied = new LinkedHashMap<>();

        try {
            Files.createDirectories(backupRoot);

            copied.put("progress", copyIfExists(config.progressPath, backupRoot.resolve("progress.json")));
            copied.put("leaderboard", copyIfExists(config.leaderboardPath, backupRoot.resolve("leaderboard.json")));
            copied.put("player", copyIfExists(config.playerPath, backupRoot.resolve("player.json")));
            copied.put("telemetry", copyIfExists(config.telemetryPath, backupRoot.resolve("telemetry.ndjson")));

            return Map.of(
                    "ok", true,
                    "label", label,
                    "backupDir", backupRoot.toString(),
                    "files", copied
            );
        } catch (IOException e) {
            return Map.of(
                    "ok", false,
                    "error", "Failed to create backup: " + e.getMessage()
            );
        }
    }

    private static boolean copyIfExists(Path source, Path destination) throws IOException {
        if (!Files.exists(source)) return false;
        Files.createDirectories(destination.getParent());
        Files.copy(source, destination, StandardCopyOption.REPLACE_EXISTING);
        return true;
    }
}
