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
    void persistsEntriesAndReturnsTopSortedByScore() {
        LeaderboardStore store = new LeaderboardStore(tempDir.resolve("leaderboard.json"));

        store.submit(new LeaderboardEntry("alice", 120, "level-1", 2000));
        store.submit(new LeaderboardEntry("bob", 220, "level-2", 3000));
        store.submit(new LeaderboardEntry("cara", 220, "level-3", 1000));

        List<LeaderboardEntry> top = store.top(2);

        assertEquals(2, top.size());
        assertEquals("cara", top.get(0).nickname);
        assertEquals("bob", top.get(1).nickname);

        LeaderboardStore reloaded = new LeaderboardStore(tempDir.resolve("leaderboard.json"));
        assertEquals(3, reloaded.top(10).size());
    }
}
