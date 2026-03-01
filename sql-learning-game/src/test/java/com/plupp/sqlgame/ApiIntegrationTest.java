package com.plupp.sqlgame;

import com.plupp.sqlgame.core.LevelRepository;
import com.plupp.sqlgame.core.SqlRunner;
import com.plupp.sqlgame.store.LeaderboardStore;
import com.plupp.sqlgame.store.ProgressStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertNotNull;

class ApiIntegrationTest {

    @TempDir
    Path tempDir;

    @Test
    void appCanBeCreatedWithStores() {
        var app = App.create(
                new LevelRepository(),
                new SqlRunner(),
                new ProgressStore(tempDir.resolve("progress.json")),
                new LeaderboardStore(tempDir.resolve("leaderboard.json"))
        );

        assertNotNull(app);
        app.stop();
    }
}
