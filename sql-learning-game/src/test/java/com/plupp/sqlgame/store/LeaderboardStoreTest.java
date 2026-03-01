package com.plupp.sqlgame.store;

import com.plupp.sqlgame.model.LeaderboardEntry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class LeaderboardStoreTest {

    @TempDir
    Path tempDir;

    @Test
    void upsertsBestPerPlayerAndLevelAndReturnsDedupedTop() {
        LeaderboardStore store = new LeaderboardStore(tempDir.resolve("leaderboard.json"));

        store.submit(new LeaderboardEntry("p1", "alice", 100, "level-1", 2000));
        store.submit(new LeaderboardEntry("p1", "alice", 120, "level-1", 3000));
        store.submit(new LeaderboardEntry("p1", "alice", 110, "level-1", 4000));
        store.submit(new LeaderboardEntry("p1", "alice", 80, "level-2", 5000));

        List<LeaderboardEntry> top = store.top(10);

        assertEquals(1, top.size());
        assertEquals("alice", top.get(0).nickname);
        assertEquals(200, top.get(0).score); // 120 + 80

        List<LeaderboardEntry> level1Top = store.perLevelTop(10).get("level-1");
        assertEquals(1, level1Top.size());
        assertEquals(120, level1Top.get(0).score);
    }


    @Test
    void upsertWithSameScoreKeepsEarliestTimestamp() {
        LeaderboardStore store = new LeaderboardStore(tempDir.resolve("leaderboard.json"));

        store.submit(new LeaderboardEntry("p1", "alice", 120, "level-1", 3000));
        store.submit(new LeaderboardEntry("p1", "alice", 120, "level-1", 1000));

        List<LeaderboardEntry> level1Top = store.perLevelTop(10).get("level-1");
        assertEquals(1, level1Top.size());
        assertEquals(120, level1Top.get(0).score);
        assertEquals(1000, level1Top.get(0).achievedAtEpochMs);
    }

    @Test
    void migratesLegacyEntriesWithoutPlayerIdByNicknameFallback() {
        LeaderboardStore store = new LeaderboardStore(tempDir.resolve("leaderboard.json"));

        store.submit(new LeaderboardEntry(null, "Legacy", 90, "level-1", 1000));
        store.submit(new LeaderboardEntry(null, "Legacy", 95, "level-1", 1100));
        store.submit(new LeaderboardEntry(null, "Legacy", 30, "level-2", 1200));

        List<LeaderboardEntry> top = store.top(10);
        assertEquals(1, top.size());
        assertEquals(125, top.get(0).score);

        LeaderboardStore reloaded = new LeaderboardStore(tempDir.resolve("leaderboard.json"));
        assertEquals(2, reloaded.perLevelTop(10).values().stream().mapToInt(List::size).sum());
    }
}
