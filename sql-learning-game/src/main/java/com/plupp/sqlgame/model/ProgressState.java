package com.plupp.sqlgame.model;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

public class ProgressState {
    public int totalXp = 0;
    public Set<String> completedLevels = new HashSet<>();
    public Set<String> achievements = new HashSet<>();
    public Map<String, Integer> attemptsByLevel = new HashMap<>();
    public Map<String, Long> bestTimeMsByLevel = new HashMap<>();

    public int level() {
        return Math.max(1, (totalXp / 250) + 1);
    }
}