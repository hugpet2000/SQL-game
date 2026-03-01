package com.plupp.sqlgame.core;

import com.plupp.sqlgame.model.LevelDefinition;
import com.plupp.sqlgame.store.ProgressStore;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class EvaluationEngineTest {

    @Test
    void evaluatesCorrectQuery() {
        LevelRepository repo = new LevelRepository();
        SqlRunner runner = new SqlRunner();
        LevelDefinition level = repo.byId("level-1").orElseThrow();
        runner.reset(level);

        EvaluationEngine engine = new EvaluationEngine(runner, new ProgressStore(Path.of("target", "test-progress.json")));
        var result = engine.evaluate(level, "SELECT name FROM customers ORDER BY name;");
        assertTrue(result.success);
    }
}
