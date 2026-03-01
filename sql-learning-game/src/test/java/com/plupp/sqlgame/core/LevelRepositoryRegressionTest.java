package com.plupp.sqlgame.core;

import com.plupp.sqlgame.model.LevelDefinition;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Comparator;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class LevelRepositoryRegressionTest {

    @Test
    void loadsAllYamlMissionFilesFromResources() throws Exception {
        List<String> yamlFiles = listMissionFiles();
        LevelRepository repository = new LevelRepository();

        List<LevelDefinition> levels = repository.list();

        assertEquals(yamlFiles.size(), levels.size(), "All YAML levels should be loaded");
        assertTrue(levels.stream().allMatch(level -> level.id != null && !level.id.isBlank()));
        assertTrue(levels.stream().allMatch(level -> level.seedSql != null && !level.seedSql.isBlank()));
        assertTrue(levels.stream().allMatch(level -> level.expectedQuery != null && !level.expectedQuery.isBlank()));
    }

    @Test
    void eachLoadedMissionCanResetAndRunExpectedQuery() {
        LevelRepository repository = new LevelRepository();
        SqlRunner runner = new SqlRunner();

        for (LevelDefinition level : repository.list()) {
            assertDoesNotThrow(() -> runner.reset(level), "Reset should work for " + level.id);
            var result = runner.runExpected(level);
            assertNull(result.error, "Expected query should execute for " + level.id);
        }
    }

    private List<String> listMissionFiles() throws IOException, URISyntaxException {
        Path levelsDir = Paths.get(getClass().getClassLoader().getResource("levels").toURI());
        try (var stream = Files.list(levelsDir)) {
            return stream
                    .filter(path -> path.getFileName().toString().endsWith(".yml"))
                    .map(path -> path.getFileName().toString())
                    .sorted(Comparator.naturalOrder())
                    .toList();
        }
    }
}
