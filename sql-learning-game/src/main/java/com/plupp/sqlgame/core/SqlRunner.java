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

        if (!isSingleStatement(sql)) {
            QueryResult blocked = new QueryResult();
            blocked.error = "Please run exactly one SQL statement at a time.";
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

    public List<Map<String, Object>> schemaForLevel(LevelDefinition level) {
        String sql = """
                SELECT TABLE_NAME, COLUMN_NAME, IS_NULLABLE, ORDINAL_POSITION
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = 'PUBLIC'
                ORDER BY TABLE_NAME, ORDINAL_POSITION
                """;

        try (Connection con = DriverManager.getConnection(jdbcUrl(level.id));
             PreparedStatement st = con.prepareStatement(sql);
             ResultSet rs = st.executeQuery()) {
            Map<String, List<Map<String, String>>> byTable = new LinkedHashMap<>();
            while (rs.next()) {
                String tableName = rs.getString("TABLE_NAME");
                Map<String, String> col = new LinkedHashMap<>();
                col.put("name", rs.getString("COLUMN_NAME"));
                col.put("type", "");
                col.put("nullable", rs.getString("IS_NULLABLE"));
                byTable.computeIfAbsent(tableName, ignored -> new ArrayList<>()).add(col);
            }

            List<Map<String, Object>> tables = new ArrayList<>();
            byTable.forEach((name, columns) -> {
                Map<String, Object> table = new LinkedHashMap<>();
                table.put("name", name);
                table.put("columns", columns);
                tables.add(table);
            });
            return tables;
        } catch (Exception e) {
            return List.of();
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

    public static boolean isSingleStatement(String sql) {
        int statements = 0;
        boolean inSingleQuote = false;
        boolean inLineComment = false;
        boolean inBlockComment = false;
        boolean hasNonWhitespaceInCurrent = false;

        for (int i = 0; i < sql.length(); i++) {
            char c = sql.charAt(i);
            char n = i + 1 < sql.length() ? sql.charAt(i + 1) : '\0';

            if (inLineComment) {
                if (c == '\n') inLineComment = false;
                continue;
            }
            if (inBlockComment) {
                if (c == '*' && n == '/') {
                    inBlockComment = false;
                    i++;
                }
                continue;
            }
            if (!inSingleQuote && c == '-' && n == '-') {
                inLineComment = true;
                i++;
                continue;
            }
            if (!inSingleQuote && c == '/' && n == '*') {
                inBlockComment = true;
                i++;
                continue;
            }
            if (c == '\'') {
                inSingleQuote = !inSingleQuote;
                hasNonWhitespaceInCurrent = true;
                continue;
            }
            if (!inSingleQuote && c == ';') {
                if (hasNonWhitespaceInCurrent) {
                    statements++;
                    hasNonWhitespaceInCurrent = false;
                }
                continue;
            }
            if (!Character.isWhitespace(c)) {
                hasNonWhitespaceInCurrent = true;
            }
        }

        if (hasNonWhitespaceInCurrent) statements++;
        return statements == 1;
    }

    private String friendlySqlError(String raw) {
        if (raw == null) return "Unknown SQL error";
        if (raw.contains("Syntax error")) return "Syntax issue detected. Check commas, aliases, and clause order.";
        if (raw.contains("Column") && raw.contains("not found")) return "Column not found. Open the schema panel and verify names.";
        if (raw.contains("Table") && raw.contains("not found")) return "Table not found. Did you use the correct table name/alias?";
        return raw;
    }
}
