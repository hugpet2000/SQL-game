package com.plupp.sqlgame.core;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import com.plupp.sqlgame.model.LevelDefinition;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;

public class LevelRepository {
    private final Map<String, LevelDefinition> levels = new LinkedHashMap<>();

    public LevelRepository() {
        loadDefaults();
    }

    private void loadDefaults() {
        List<String> files = List.of("level1.yml", "level2.yml", "level3.yml", "level4.yml", "level5.yml", "level6.yml", "level7.yml", "level8.yml", "level9.yml", "level10.yml", "level11.yml", "level12.yml", "level13.yml", "level14.yml", "level15.yml");
        ObjectMapper mapper = new ObjectMapper(new YAMLFactory());
        for (String file : files) {
            try (InputStream is = getClass().getClassLoader().getResourceAsStream("levels/" + file)) {
                if (is == null) throw new IllegalStateException("Missing level file: " + file);
                LevelDefinition level = mapper.readValue(is, LevelDefinition.class);
                levels.put(level.id, level);
            } catch (Exception e) {
                throw new RuntimeException("Failed to load " + file, e);
            }
        }
    }

    public List<LevelDefinition> list() {
        return new ArrayList<>(levels.values());
    }

    public Optional<LevelDefinition> byId(String id) {
        return Optional.ofNullable(levels.get(id));
    }
}