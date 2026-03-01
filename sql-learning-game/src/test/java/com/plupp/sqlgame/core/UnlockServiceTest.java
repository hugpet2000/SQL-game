package com.plupp.sqlgame.core;

import com.plupp.sqlgame.model.LevelDefinition;
import com.plupp.sqlgame.model.ProgressState;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.assertEquals;

class UnlockServiceTest {

    private final UnlockService service = new UnlockService();

    @Test
    void defaultsToLinearProgressionWhenNoPrerequisitesConfigured() {
        List<LevelDefinition> levels = IntStream.rangeClosed(1, 3)
                .mapToObj(i -> level("level-" + i))
                .toList();

        ProgressState progress = new ProgressState();
        assertEquals(List.of("level-1"), ids(service.unlockedLevels(levels, progress)));

        progress.completedLevels.add("level-1");
        assertEquals(List.of("level-1", "level-2"), ids(service.unlockedLevels(levels, progress)));
    }

    @Test
    void supportsBranchingWhenPrerequisitesAreProvided() {
        LevelDefinition level1 = level("level-1");
        LevelDefinition level2 = level("level-2");
        LevelDefinition level3 = level("level-3");
        level3.prerequisites = List.of("level-1");

        List<LevelDefinition> levels = List.of(level1, level2, level3);

        ProgressState progress = new ProgressState();
        progress.completedLevels.add("level-1");

        assertEquals(List.of("level-1", "level-2", "level-3"), ids(service.unlockedLevels(levels, progress)));
    }

    private static LevelDefinition level(String id) {
        LevelDefinition level = new LevelDefinition();
        level.id = id;
        return level;
    }

    private static List<String> ids(List<LevelDefinition> levels) {
        return levels.stream().map(l -> l.id).toList();
    }
}
