package com.plupp.sqlgame.model;

import java.util.ArrayList;
import java.util.List;

public class QueryResult {
    public List<String> columns = new ArrayList<>();
    public List<List<String>> rows = new ArrayList<>();
    public long executionMs;
    public String error;

    public boolean isOk() {
        return error == null || error.isBlank();
    }
}