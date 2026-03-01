package com.plupp.sqlgame;

import java.nio.file.Path;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

public class RuntimeConfig {
    public enum AuthMode {
        OFF,
        TOKEN,
        BASIC;

        static AuthMode fromEnv(String raw) {
            if (raw == null || raw.isBlank()) return OFF;
            String normalized = raw.trim().toLowerCase(Locale.ROOT);
            return switch (normalized) {
                case "off", "none", "disabled" -> OFF;
                case "token", "bearer" -> TOKEN;
                case "basic" -> BASIC;
                default -> throw new IllegalArgumentException("Unsupported SQLGAME_AUTH_MODE: " + raw);
            };
        }
    }

    public final String host;
    public final int port;
    public final Path progressPath;
    public final Path leaderboardPath;
    public final Path playerPath;
    public final Path telemetryPath;
    public final Path backupDir;
    public final AuthMode authMode;
    public final String authToken;
    public final String authUsername;
    public final String authPassword;

    private RuntimeConfig(
            String host,
            int port,
            Path progressPath,
            Path leaderboardPath,
            Path playerPath,
            Path telemetryPath,
            Path backupDir,
            AuthMode authMode,
            String authToken,
            String authUsername,
            String authPassword
    ) {
        this.host = host;
        this.port = port;
        this.progressPath = progressPath;
        this.leaderboardPath = leaderboardPath;
        this.playerPath = playerPath;
        this.telemetryPath = telemetryPath;
        this.backupDir = backupDir;
        this.authMode = authMode;
        this.authToken = authToken;
        this.authUsername = authUsername;
        this.authPassword = authPassword;
    }

    public static RuntimeConfig fromEnv() {
        String host = envOrDefault("SQLGAME_HOST", "localhost");
        int port = parseInt(envOrDefault("SQLGAME_PORT", "7070"), "SQLGAME_PORT");

        Path dataDir = Path.of(envOrDefault("SQLGAME_DATA_DIR", "data"));

        Path progressPath = pathFromEnv("SQLGAME_PROGRESS_PATH", dataDir.resolve("progress.json"));
        Path leaderboardPath = pathFromEnv("SQLGAME_LEADERBOARD_PATH", dataDir.resolve("leaderboard.json"));
        Path playerPath = pathFromEnv("SQLGAME_PLAYER_PATH", dataDir.resolve("player.json"));
        Path telemetryPath = pathFromEnv("SQLGAME_TELEMETRY_PATH", dataDir.resolve("telemetry.ndjson"));
        Path backupDir = pathFromEnv("SQLGAME_BACKUP_DIR", dataDir.resolve("backups"));

        AuthMode authMode = AuthMode.fromEnv(System.getenv("SQLGAME_AUTH_MODE"));
        String authToken = trimToNull(System.getenv("SQLGAME_AUTH_TOKEN"));
        String authUsername = trimToNull(System.getenv("SQLGAME_AUTH_USERNAME"));
        String authPassword = trimToNull(System.getenv("SQLGAME_AUTH_PASSWORD"));
        authMode = normalizeAuthMode(authMode, authToken, authUsername, authPassword);

        RuntimeConfig config = new RuntimeConfig(
                host,
                port,
                progressPath,
                leaderboardPath,
                playerPath,
                telemetryPath,
                backupDir,
                authMode,
                authToken,
                authUsername,
                authPassword
        );
        config.validate();
        return config;
    }

    public static RuntimeConfig forTesting(
            String host,
            int port,
            Path progressPath,
            Path leaderboardPath,
            Path playerPath,
            Path telemetryPath,
            Path backupDir,
            AuthMode authMode,
            String authToken,
            String authUsername,
            String authPassword
    ) {
        AuthMode normalizedMode = normalizeAuthMode(authMode, authToken, authUsername, authPassword);
        RuntimeConfig cfg = new RuntimeConfig(
                host,
                port,
                progressPath,
                leaderboardPath,
                playerPath,
                telemetryPath,
                backupDir,
                normalizedMode,
                authToken,
                authUsername,
                authPassword
        );
        cfg.validate();
        return cfg;
    }

    public static RuntimeConfig localDefaults() {
        return new RuntimeConfig(
                "localhost",
                7070,
                Path.of("data", "progress.json"),
                Path.of("data", "leaderboard.json"),
                Path.of("data", "player.json"),
                Path.of("data", "telemetry.ndjson"),
                Path.of("data", "backups"),
                AuthMode.OFF,
                null,
                null,
                null
        );
    }

    private static AuthMode normalizeAuthMode(AuthMode authMode, String authToken, String authUsername, String authPassword) {
        if (authMode == AuthMode.TOKEN && (authToken == null || authToken.isBlank())) {
            System.err.println("WARN: SQLGAME_AUTH_MODE=token set without SQLGAME_AUTH_TOKEN; auth disabled");
            return AuthMode.OFF;
        }
        if (authMode == AuthMode.BASIC && (authUsername == null || authUsername.isBlank() || authPassword == null || authPassword.isBlank())) {
            System.err.println("WARN: SQLGAME_AUTH_MODE=basic set without SQLGAME_AUTH_USERNAME/SQLGAME_AUTH_PASSWORD; auth disabled");
            return AuthMode.OFF;
        }
        return authMode;
    }

    private static void warnIfMissingAuthSecrets(AuthMode authMode, String authToken, String authUsername, String authPassword) {
        if (authMode == AuthMode.TOKEN && (authToken == null || authToken.isBlank())) {
            System.err.println("WARN: SQLGAME_AUTH_MODE=token set without SQLGAME_AUTH_TOKEN; auth disabled");
        }
        if (authMode == AuthMode.BASIC && (authUsername == null || authUsername.isBlank() || authPassword == null || authPassword.isBlank())) {
            System.err.println("WARN: SQLGAME_AUTH_MODE=basic set without SQLGAME_AUTH_USERNAME/SQLGAME_AUTH_PASSWORD; auth disabled");
        }
    }

    public String newBackupLabel() {
        return DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss").format(ZonedDateTime.now(ZoneOffset.UTC));
    }

    private void validate() {
        if (port < 1 || port > 65535) {
            throw new IllegalArgumentException("SQLGAME_PORT must be between 1 and 65535");
        }

        if (authMode != AuthMode.OFF) {
            warnIfMissingAuthSecrets(authMode, authToken, authUsername, authPassword);
        }
    }

    private static String envOrDefault(String key, String defaultValue) {
        String raw = System.getenv(key);
        if (raw == null || raw.isBlank()) return defaultValue;
        return raw.trim();
    }

    private static Path pathFromEnv(String key, Path fallback) {
        String raw = System.getenv(key);
        if (raw == null || raw.isBlank()) return fallback;
        return Path.of(raw.trim());
    }

    private static int parseInt(String raw, String key) {
        try {
            return Integer.parseInt(raw);
        } catch (Exception e) {
            throw new IllegalArgumentException(key + " must be an integer");
        }
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
