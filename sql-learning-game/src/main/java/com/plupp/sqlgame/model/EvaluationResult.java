package com.plupp.sqlgame.model;

import java.util.ArrayList;
import java.util.List;

public class EvaluationResult {
    public boolean success;
    public String feedback;
    public QueryResult playerResult;
    public int xpAwarded;
    public int score;
    public int planScore;
    public List<String> unlockedAchievements = new ArrayList<>();
}
