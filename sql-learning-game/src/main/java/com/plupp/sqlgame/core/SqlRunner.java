package com.plupp.sqlgame.core;

import com.plupp.sqlgame.model.LevelDefinition;
import com.plupp.sqlgame.model.QueryResult;

import java.sql.*;
import java.util.*;
import java.util.regex.Pattern;

public class SqlRunner {
    private static final Pattern FORBIDDEN = Pattern.compile("\\b(DROP\\s+DATABASE|ATTACH\\s+DATABASE|SCRIPT\\s+TO|RUNSCRIPT|CSVWRITE|FILE_READ|FILE_WRITE)\\b", Pattern.CASE_INSENSITIVE);

    private String jdbcUrl(String levelId) {
        return "jdbc:h2:mem:" + levelId + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1";
    }

    public void reset(LevelDefinition level) {
        try (Connection con = DriverManager.getConnection(jdbcUrl(level.id))) {
            executeSqlBatch(con, "DROP ALL OBJECTS;");
            executeSqlBatch(con, level.seedSql);
        } catch (Exception e) {
            throw new RuntimeException("Reset failed", e);
        }
    }

    public QueryResult runForLevel(LevelDefinition level, String sql) {
        if (FORBIDDEN.matcher(sql).find()) {
            QueryResult blocked = new QueryResult();
            blocked.error = "That command is blocked in learning mode for safety.";
            return blocked;
        }

        if (!isAllowed(level, sql)) {
            QueryResult blocked = new QueryResult();
            blocked.error = "This level only allows: " + String.join(", ", level.allowedCommands);
            return blocked;
        }

        try (Connection con = DriverManager.getConnection(jdbcUrl(level.id))) {
            long start = System.nanoTime();
            QueryResult out = executeSingle(con, sql);
            out.executionMs = (System.nanoTime() - start) / 1_000_000;
            return out;
        } catch (Exception e) {
            QueryResult out = new QueryResult();
            out.error = friendlySqlError(e.getMessage());
            return out;
        }
    }

    public QueryResult runExpected(LevelDefinition level) {
        try (Connection con = DriverManager.getConnection(jdbcUrl(level.id))) {
            return executeSingle(con, level.expectedQuery);
        } catch (Exception e) {
            QueryResult out = new QueryResult();
            out.error = e.getMessage();
            return out;
        }
    }

    public QueryResult runSandbox(String sql) {
        if (FORBIDDEN.matcher(sql).find()) {
            QueryResult blocked = new QueryResult();
            blocked.error = "That command is blocked in sandbox mode for safety.";
            return blocked;
        }

        try (Connection con = DriverManager.getConnection("jdbc:h2:mem:sandbox;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")) {
            return executeSingle(con, sql);
        } catch (Exception e) {
            QueryResult out = new QueryResult();
            out.error = friendlySqlError(e.getMessage());
            return out;
        }
    }

    private QueryResult executeSingle(Connection con, String sql) throws SQLException {
        QueryResult out = new QueryResult();
        Statement st = con.createStatement();
        boolean hasResult = st.execute(sql);
        if (!hasResult) return out;

        ResultSet rs = st.getResultSet();
        ResultSetMetaData md = rs.getMetaData();
        for (int i = 1; i <= md.getColumnCount(); i++) {
            out.columns.add(md.getColumnLabel(i));
        }
        while (rs.next()) {
            List<String> row = new ArrayList<>();
            for (int i = 1; i <= md.getColumnCount(); i++) {
                Object val = rs.getObject(i);
                row.add(Objects.toString(val, "NULL"));
            }
            out.rows.add(row);
        }
        return out;
    }

    private void executeSqlBatch(Connection con, String sql) throws SQLException {
        for (String stmt : sql.split(";")) {
            String trimmed = stmt.trim();
            if (trimmed.isEmpty()) continue;
            try (Statement st = con.createStatement()) {
                st.execute(trimmed);
            }
        }
    }

    private boolean isAllowed(LevelDefinition level, String sql) {
        if (level.allowedCommands == null || level.allowedCommands.isEmpty()) return true;
        String normalized = sql.trim().toUpperCase(Locale.ROOT);
        for (String cmd : level.allowedCommands) {
            if (normalized.startsWith(cmd.toUpperCase(Locale.ROOT))) return true;
        }
        return false;
    }

    private String friendlySqlError(String raw) {
        if (raw == null) return "Unknown SQL error";
        if (raw.contains("Syntax error")) return "Syntax issue detected. Check commas, aliases, and clause order.";
        if (raw.contains("Column") && raw.contains("not found")) return "Column not found. Open the schema panel and verify names.";
        if (raw.contains("Table") && raw.contains("not found")) return "Table not found. Did you use the correct table name/alias?";
        return raw;
    }
}