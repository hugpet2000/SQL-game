package com.plupp.sqlgame;

import com.plupp.sqlgame.core.LevelRepository;
import com.plupp.sqlgame.core.SqlRunner;
import com.plupp.sqlgame.store.LeaderboardStore;
import com.plupp.sqlgame.store.PlayerStore;
import com.plupp.sqlgame.store.ProgressStore;
import com.plupp.sqlgame.store.TelemetryStore;

import java.nio.file.Path;

public class Main {
    public static void main(String[] args) {
        var app = App.create(
                new LevelRepository(),
                new SqlRunner(),
                new ProgressStore(Path.of("data", "progress.json")),
                new LeaderboardStore(Path.of("data", "leaderboard.json")),
                new PlayerStore(Path.of("data", "player.json")),
                new TelemetryStore(Path.of("data", "telemetry.ndjson"))
        );

        String host = envOrDefault("HOST", "localhost");
        int port = intEnvOrDefault("PORT", 7070);

        app.start(host, port);
        System.out.println("SQL Learning Game running on http://" + host + ":" + port);
    }

    private static String envOrDefault(String key, String fallback) {
        String value = System.getenv(key);
        return (value == null || value.isBlank()) ? fallback : value;
    }

    private static int intEnvOrDefault(String key, int fallback) {
        String value = System.getenv(key);
        if (value == null || value.isBlank()) return fallback;
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }
}
