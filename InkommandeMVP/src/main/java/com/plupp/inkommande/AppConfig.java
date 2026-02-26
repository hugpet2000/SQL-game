package com.plupp.inkommande;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

public class AppConfig {
    private static final String APP_DIR_NAME = ".inkommande-mvp";
    private static final String CONFIG_FILE_NAME = "config.properties";
    private static final String KEY_BASE_DIR = "base.dir";

    private final Path appDir;
    private final Path configFile;

    public AppConfig() {
        this.appDir = Path.of(System.getProperty("user.home"), APP_DIR_NAME);
        this.configFile = appDir.resolve(CONFIG_FILE_NAME);
    }

    public Path getAppDir() {
        return appDir;
    }

    public Path getDatabasePath() {
        return appDir.resolve("inkommande.db");
    }

    public Path loadBaseDir() {
        try {
            if (!Files.exists(configFile)) return null;
            Properties p = new Properties();
            try (var in = Files.newInputStream(configFile)) {
                p.load(in);
            }
            String value = p.getProperty(KEY_BASE_DIR);
            if (value == null || value.isBlank()) return null;
            return Path.of(value);
        } catch (Exception e) {
            return null;
        }
    }

    public void saveBaseDir(Path baseDir) throws IOException {
        Files.createDirectories(appDir);
        Properties p = new Properties();
        p.setProperty(KEY_BASE_DIR, baseDir.toAbsolutePath().toString());
        try (var out = Files.newOutputStream(configFile)) {
            p.store(out, "Inkommande MVP config");
        }
    }
}
