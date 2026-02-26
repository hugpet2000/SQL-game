package com.plupp.inkommande;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

public class Database {
    private final String jdbcUrl;

    public Database(Path dbPath) {
        this.jdbcUrl = "jdbc:sqlite:" + dbPath.toAbsolutePath();
    }

    private Connection connect() throws SQLException {
        Connection c = DriverManager.getConnection(jdbcUrl);
        try (Statement s = c.createStatement()) {
            s.execute("PRAGMA busy_timeout=5000");
        }
        return c;
    }

    public void init() throws SQLException {
        try (Connection c = connect();
             Statement s = c.createStatement()) {
            s.execute("PRAGMA journal_mode=WAL");
            s.execute("PRAGMA synchronous=NORMAL");
            s.execute("""
                CREATE TABLE IF NOT EXISTS files (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  original_filename TEXT NOT NULL,
                  stored_filename TEXT NOT NULL,
                  stored_path TEXT NOT NULL,
                  file_size INTEGER NOT NULL,
                  import_timestamp TEXT NOT NULL,
                  status TEXT NOT NULL,
                  title TEXT,
                  description TEXT,
                  category TEXT,
                  tags TEXT,
                  document_date TEXT,
                  source TEXT
                )
            """);
            s.execute("CREATE INDEX IF NOT EXISTS idx_files_title ON files(title)");
            s.execute("CREATE INDEX IF NOT EXISTS idx_files_original ON files(original_filename)");
            s.execute("CREATE INDEX IF NOT EXISTS idx_files_category ON files(category)");
            s.execute("CREATE INDEX IF NOT EXISTS idx_files_tags ON files(tags)");
            s.execute("CREATE INDEX IF NOT EXISTS idx_files_import_timestamp ON files(import_timestamp)");
        }
    }

    public long insertImportedFile(String originalFilename, String storedFilename, String storedPath, long fileSize, String importTimestamp) throws SQLException {
        String sql = """
            INSERT INTO files(original_filename, stored_filename, stored_path, file_size, import_timestamp, status)
            VALUES(?, ?, ?, ?, ?, 'NeedsMetadata')
        """;
        try (Connection c = connect();
             PreparedStatement ps = c.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            c.setAutoCommit(false);
            try {
                ps.setString(1, originalFilename);
                ps.setString(2, storedFilename);
                ps.setString(3, storedPath);
                ps.setLong(4, fileSize);
                ps.setString(5, importTimestamp);
                int updated = ps.executeUpdate();
                if (updated != 1) {
                    throw new SQLException("Unexpected insert result: " + updated);
                }

                try (ResultSet rs = ps.getGeneratedKeys()) {
                    if (rs.next()) {
                        long id = rs.getLong(1);
                        c.commit();
                        return id;
                    }
                }
                throw new SQLException("No generated key");
            } catch (Exception e) {
                c.rollback();
                if (e instanceof SQLException se) throw se;
                throw new SQLException("Failed to insert imported file", e);
            } finally {
                c.setAutoCommit(true);
            }
        }
    }

    public void saveMetadata(long id, String title, String description, String category, String tags, String documentDate, String source) throws SQLException {
        String sql = """
            UPDATE files
            SET title = ?, description = ?, category = ?, tags = ?, document_date = ?, source = ?, status = 'Ready'
            WHERE id = ?
        """;
        try (Connection c = connect();
             PreparedStatement ps = c.prepareStatement(sql)) {
            c.setAutoCommit(false);
            try {
                ps.setString(1, title);
                ps.setString(2, description);
                ps.setString(3, category);
                ps.setString(4, tags);
                ps.setString(5, documentDate);
                ps.setString(6, source);
                ps.setLong(7, id);
                int updated = ps.executeUpdate();
                if (updated != 1) {
                    throw new SQLException("Metadata save affected " + updated + " rows for id=" + id);
                }
                c.commit();
            } catch (Exception e) {
                c.rollback();
                if (e instanceof SQLException se) throw se;
                throw new SQLException("Failed to save metadata", e);
            } finally {
                c.setAutoCommit(true);
            }
        }
    }

    public List<FileRecord> listFiles(String search) throws SQLException {
        String like = "%" + (search == null ? "" : search.trim()) + "%";
        String sql = """
            SELECT * FROM files
            WHERE (? = '' OR COALESCE(title,'') LIKE ? OR original_filename LIKE ? OR COALESCE(tags,'') LIKE ? OR COALESCE(category,'') LIKE ?)
            ORDER BY import_timestamp DESC
        """;
        try (Connection c = connect();
             PreparedStatement ps = c.prepareStatement(sql)) {
            String base = search == null ? "" : search.trim();
            ps.setString(1, base);
            ps.setString(2, like);
            ps.setString(3, like);
            ps.setString(4, like);
            ps.setString(5, like);
            try (ResultSet rs = ps.executeQuery()) {
                List<FileRecord> out = new ArrayList<>();
                while (rs.next()) {
                    out.add(map(rs));
                }
                return out;
            }
        }
    }

    public List<String> autocomplete(String prefix, int limit) throws SQLException {
        String q = (prefix == null ? "" : prefix.trim()) + "%";
        String sql = """
            SELECT value FROM (
              SELECT title AS value FROM files WHERE title LIKE ?
              UNION
              SELECT original_filename AS value FROM files WHERE original_filename LIKE ?
              UNION
              SELECT category AS value FROM files WHERE category LIKE ?
              UNION
              SELECT tags AS value FROM files WHERE tags LIKE ?
            ) WHERE value IS NOT NULL AND value <> ''
            LIMIT ?
        """;
        try (Connection c = connect();
             PreparedStatement ps = c.prepareStatement(sql)) {
            ps.setString(1, q);
            ps.setString(2, q);
            ps.setString(3, q);
            ps.setString(4, q);
            ps.setInt(5, limit);
            try (ResultSet rs = ps.executeQuery()) {
                List<String> out = new ArrayList<>();
                while (rs.next()) out.add(rs.getString(1));
                return out;
            }
        }
    }

    public List<FileRecord> listMissingFromPaths(List<Path> paths) throws SQLException {
        if (paths == null || paths.isEmpty()) return List.of();

        StringBuilder placeholders = new StringBuilder();
        for (int i = 0; i < paths.size(); i++) {
            if (i > 0) placeholders.append(",");
            placeholders.append("?");
        }

        String sql = "SELECT stored_path FROM files WHERE stored_path IN (" + placeholders + ")";
        List<String> existing = new ArrayList<>();
        try (Connection c = connect();
             PreparedStatement ps = c.prepareStatement(sql)) {
            for (int i = 0; i < paths.size(); i++) {
                ps.setString(i + 1, paths.get(i).toAbsolutePath().toString());
            }
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    existing.add(rs.getString(1));
                }
            }
        }

        java.util.Set<String> existingSet = new java.util.HashSet<>(existing);
        List<FileRecord> inserted = new ArrayList<>();
        for (Path path : paths) {
            String abs = path.toAbsolutePath().toString();
            if (existingSet.contains(abs)) continue;
            if (!Files.isRegularFile(path)) continue;

            String filename = path.getFileName().toString();
            long size;
            try {
                size = Files.size(path);
            } catch (Exception e) {
                continue;
            }
            long id = insertImportedFile(
                    filename,
                    filename,
                    abs,
                    size,
                    LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            );
            FileRecord rec = new FileRecord();
            rec.id = id;
            rec.originalFilename = filename;
            rec.storedFilename = filename;
            rec.storedPath = abs;
            rec.fileSize = size;
            rec.importTimestamp = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            rec.status = "NeedsMetadata";
            inserted.add(rec);
        }
        return inserted;
    }

    private FileRecord map(ResultSet rs) throws SQLException {
        FileRecord r = new FileRecord();
        r.id = rs.getLong("id");
        r.originalFilename = rs.getString("original_filename");
        r.storedFilename = rs.getString("stored_filename");
        r.storedPath = rs.getString("stored_path");
        r.fileSize = rs.getLong("file_size");
        r.importTimestamp = rs.getString("import_timestamp");
        r.status = rs.getString("status");
        r.title = rs.getString("title");
        r.description = rs.getString("description");
        r.category = rs.getString("category");
        r.tags = rs.getString("tags");
        r.documentDate = rs.getString("document_date");
        r.source = rs.getString("source");
        return r;
    }
}
