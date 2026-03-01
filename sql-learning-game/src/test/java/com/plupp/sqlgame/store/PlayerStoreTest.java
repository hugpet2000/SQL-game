package com.plupp.sqlgame.store;

import com.plupp.sqlgame.model.PlayerProfile;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class PlayerStoreTest {

    @TempDir
    Path tempDir;

    @Test
    void createsAndPersistsProfileAndAllowsNicknameUpdate() {
        Path file = tempDir.resolve("player.json");
        PlayerStore store = new PlayerStore(file);

        PlayerProfile created = store.loadOrCreate();
        assertNotNull(created.playerId);
        assertEquals("Anonymous", created.nickname);
        assertTrue(created.createdAt > 0);
        assertTrue(created.lastSeenAt > 0);

        PlayerProfile updated = store.updateNickname("Alice");
        assertEquals(created.playerId, updated.playerId);
        assertEquals("Alice", updated.nickname);
        assertTrue(updated.lastSeenAt >= created.lastSeenAt);

        PlayerStore reloadedStore = new PlayerStore(file);
        PlayerProfile reloaded = reloadedStore.loadOrCreate();
        assertEquals(created.playerId, reloaded.playerId);
        assertEquals("Alice", reloaded.nickname);
        assertEquals(created.createdAt, reloaded.createdAt);
    }
}
