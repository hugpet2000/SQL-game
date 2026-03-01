package com.plupp.sqlgame.core;

import com.plupp.sqlgame.model.LevelDefinition;
import com.plupp.sqlgame.model.ProgressState;
import com.plupp.sqlgame.store.ProgressStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class EvaluationEngineTest {

    @TempDir
    Path tempDir;

    private LevelDefinition level;
    private SqlRunner runner;
    private ProgressStore progressStore;
    private EvaluationEngine engine;

    @BeforeEach
    void setUp() {
        LevelRepository repo = new LevelRepository();
        level = repo.byId("level-1").orElseThrow();
        runner = new SqlRunner();
        runner.reset(level);
        progressStore = new ProgressStore(tempDir.resolve("progress.json"));
        engine = new EvaluationEngine(runner, progressStore);
    }

    @Test
    void evaluatesCorrectQueryAsSuccess() {
        var result = engine.evaluate(level, "SELECT name FROM customers ORDER BY name;");

        assertTrue(result.success);
        assertTrue(result.feedback != null && !result.feedback.isBlank());
        assertTrue(result.xpAwarded > 0);
        assertTrue(result.score >= 100);
    }

    @Test
    void evaluatesMismatchedResultAsFailure() {
        var result = engine.evaluate(level, "SELECT name FROM customers ORDER BY name DESC;");

        assertFalse(result.success);
        assertTrue(result.feedback != null && !result.feedback.isBlank());
        assertEquals(0, result.xpAwarded);
    }

    @Test
    void rejectsBlockedCommandsForSafety() {
        var result = engine.evaluate(level, "DROP DATABASE training;");

        assertFalse(result.success);
        assertEquals("That command is blocked in learning mode for safety.", result.feedback);
        assertEquals(0, result.xpAwarded);
    }

    @Test
    void deniesCommandsOutsideLevelWhitelist() {
        var result = engine.evaluate(level, "UPDATE customers SET city='Lund';");

        assertFalse(result.success);
        assertEquals("This level only allows: SELECT", result.feedback);
        assertEquals(0, result.xpAwarded);
    }

    @Test
    void persistsProgressAndIncrementsXpOnSuccess() {
        var result = engine.evaluate(level, "SELECT name FROM customers ORDER BY name;");

        ProgressState persisted = progressStore.load();
        assertEquals(result.xpAwarded, persisted.totalXp);
        assertTrue(persisted.completedLevels.contains(level.id));
        assertEquals(1, persisted.attemptsByLevel.get(level.id));
        assertTrue(persisted.bestTimeMsByLevel.containsKey(level.id));
    }
}
