package com.plupp.sqlgame.store;

import com.plupp.sqlgame.model.TelemetryEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class TelemetryStoreTest {

    @TempDir
    Path tempDir;

    @Test
    void writesAndReadsRecentTelemetryEvents() {
        Path telemetryPath = tempDir.resolve("telemetry.ndjson");
        TelemetryStore store = new TelemetryStore(telemetryPath);

        assertTrue(store.record(new TelemetryEvent("level_attempt", "level-1", "p1", null, null, 1000)));
        assertTrue(store.record(new TelemetryEvent("hint_used", "level-1", "p1", null, 1L, 2000)));
        assertTrue(store.record(new TelemetryEvent("solve_time", "level-1", "p1", 1234L, null, 3000)));

        List<TelemetryEvent> recent = store.recent(2);
        assertEquals(2, recent.size());
        assertEquals("hint_used", recent.get(0).type);
        assertEquals("solve_time", recent.get(1).type);
        assertEquals(1234L, recent.get(1).durationMs);

        assertTrue(Files.exists(telemetryPath));
    }

    @Test
    void gracefullyFallsBackWhenPathIsNotWritable() {
        Path asFile = tempDir.resolve("not-a-dir");
        assertDoesNotThrow(() -> Files.writeString(asFile, "x"));

        TelemetryStore store = new TelemetryStore(asFile.resolve("telemetry.ndjson"));

        assertDoesNotThrow(() -> {
            boolean ok = store.record(new TelemetryEvent("level_attempt", "level-1", "p1", null, null, 1000));
            assertFalse(ok);
        });
        assertDoesNotThrow(() -> assertTrue(store.recent(10).isEmpty()));
    }
}
