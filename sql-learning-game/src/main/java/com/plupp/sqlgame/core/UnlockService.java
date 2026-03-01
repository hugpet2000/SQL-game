package com.plupp.sqlgame.core;

import com.plupp.sqlgame.model.LevelDefinition;
import com.plupp.sqlgame.model.ProgressState;

import java.util.*;

public class UnlockService {

    public List<LevelDefinition> unlockedLevels(List<LevelDefinition> levels, ProgressState progress) {
        List<LevelDefinition> unlocked = new ArrayList<>();
        for (int i = 0; i < levels.size(); i++) {
            LevelDefinition level = levels.get(i);
            if (isUnlocked(level, i, levels, progress)) {
                unlocked.add(level);
            }
        }
        return unlocked;
    }

    public boolean isUnlocked(LevelDefinition level, int index, List<LevelDefinition> levels, ProgressState progress) {
        Set<String> done = progress.completedLevels == null ? Set.of() : progress.completedLevels;
        if (done.contains(level.id)) return true;

        List<String> prerequisites = level.prerequisites == null ? List.of() : level.prerequisites;
        if (!prerequisites.isEmpty()) {
            return done.containsAll(prerequisites);
        }

        if (index == 0) return true;
        LevelDefinition previous = levels.get(index - 1);
        return done.contains(previous.id);
    }
}
