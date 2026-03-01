package com.plupp.sqlgame;

import com.plupp.sqlgame.core.LevelRepository;
import com.plupp.sqlgame.core.SqlRunner;
import com.plupp.sqlgame.store.LeaderboardStore;
import com.plupp.sqlgame.store.PlayerStore;
import com.plupp.sqlgame.store.ProgressStore;

import java.nio.file.Path;

public class Main {
    public static void main(String[] args) {
        var app = App.create(
                new LevelRepository(),
                new SqlRunner(),
                new ProgressStore(Path.of("data", "progress.json")),
                new LeaderboardStore(Path.of("data", "leaderboard.json")),
                new PlayerStore(Path.of("data", "player.json"))
        );

        app.start(7070);
        System.out.println("SQL Learning Game running on http://localhost:7070");
    }
}
