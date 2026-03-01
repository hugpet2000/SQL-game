package com.plupp.sqlgame;

import com.plupp.sqlgame.core.LevelRepository;
import com.plupp.sqlgame.core.SqlRunner;
import com.plupp.sqlgame.store.LeaderboardStore;
import com.plupp.sqlgame.store.PlayerStore;
import com.plupp.sqlgame.store.ProgressStore;
import com.plupp.sqlgame.store.TelemetryStore;

public class Main {
    public static void main(String[] args) {
        RuntimeConfig runtime = RuntimeConfig.fromEnv();

        var app = App.create(
                new LevelRepository(),
                new SqlRunner(),
                new ProgressStore(runtime.progressPath),
                new LeaderboardStore(runtime.leaderboardPath),
                new PlayerStore(runtime.playerPath),
                new TelemetryStore(runtime.telemetryPath),
                runtime
        );

        app.start(runtime.host, runtime.port);
        System.out.println("SQL Learning Game running on http://" + runtime.host + ":" + runtime.port);
    }
}
