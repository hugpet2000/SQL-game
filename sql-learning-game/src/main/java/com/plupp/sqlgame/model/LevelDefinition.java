package com.plupp.sqlgame.model;

import java.util.ArrayList;
import java.util.List;

public class LevelDefinition {
    public String id;
    public String title;
    public String objective;
    public String prompt;
    public String difficulty;
    public int xp = 100;
    public boolean orderMatters = false;
    public List<String> allowedCommands = new ArrayList<>();
    public List<String> hints = new ArrayList<>();
    public String seedSql;
    public String expectedQuery;
}