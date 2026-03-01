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

        Map<String, List<String>> schema = runner.schemaForLevel(level);

        assertTrue(schema.containsKey("CUSTOMERS"));
        assertEquals(List.of("ID", "NAME", "CITY"), schema.get("CUSTOMERS"));
    }

    @Test
    void blocksMultipleStatementsInLevelRun() {
        LevelRepository repo = new LevelRepository();
        SqlRunner runner = new SqlRunner();
        LevelDefinition level = repo.byId("level-1").orElseThrow();
        runner.reset(level);

        var result = runner.runForLevel(level, "SELECT name FROM customers; SELECT city FROM customers;");

        assertFalse(result.isOk());
        assertEquals("Please run exactly one SQL statement at a time.", result.error);
    }

    @Test
    void singleStatementValidationHandlesCommentsAndSemicolonsInStrings() {
        assertTrue(SqlRunner.isSingleStatement("SELECT ';' AS semi;"));
        assertTrue(SqlRunner.isSingleStatement("-- one query\nSELECT 1;"));
        assertFalse(SqlRunner.isSingleStatement("SELECT 1; /* split */ SELECT 2;"));
    }

    @Test
    void commandAllowlistChecksFirstToken() {
        SqlRunner runner = new SqlRunner();
        LevelDefinition level = new LevelDefinition();
        level.allowedCommands = List.of("SELECT");

        assertTrue(runner.isAllowed(level, "  -- a comment\nSELECT * FROM t"));
        assertFalse(runner.isAllowed(level, "DELETE FROM t"));
    }
}
