package com.plupp.sqlgame;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plupp.sqlgame.core.LevelRepository;
import com.plupp.sqlgame.core.SqlRunner;
import com.plupp.sqlgame.store.LeaderboardStore;
import com.plupp.sqlgame.store.ProgressStore;
import io.javalin.Javalin;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ApiIntegrationTest {

    @TempDir
    Path tempDir;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient client = HttpClient.newHttpClient();

    private Javalin app;

    @AfterEach
    void tearDown() {
        if (app != null) {
            app.stop();
        }
    }

    @Test
    void coreGameplayLoopEndpointsWorkTogether() throws Exception {
        app = App.create(
                new LevelRepository(),
                new SqlRunner(),
                new ProgressStore(tempDir.resolve("progress.json")),
                new LeaderboardStore(tempDir.resolve("leaderboard.json"))
        ).start(0);

        String baseUrl = "http://localhost:" + app.port();

        Map<String, Object> health = getJson(baseUrl + "/api/health", new TypeReference<>() {});
        assertEquals(true, health.get("ok"));

        List<Map<String, Object>> levels = getJson(baseUrl + "/api/levels", new TypeReference<>() {});
        assertFalse(levels.isEmpty());
        assertEquals("level-1", levels.get(0).get("id"));

        Map<String, Object> level = getJson(baseUrl + "/api/levels/level-1", new TypeReference<>() {});
        assertEquals("level-1", level.get("id"));

        List<Map<String, Object>> schema = getJson(baseUrl + "/api/levels/level-1/schema", new TypeReference<>() {});
        assertFalse(schema.isEmpty());

        Map<String, Object> runResult = postSql(baseUrl + "/api/levels/level-1/run", "SELECT name FROM customers ORDER BY name;");
        assertEquals(true, runResult.get("success"));
        assertTrue(runResult.get("feedback") != null && !runResult.get("feedback").toString().isBlank());

        Map<String, Object> progress = getJson(baseUrl + "/api/progress", new TypeReference<>() {});
        assertTrue(((List<?>) progress.get("completedLevels")).contains("level-1"));
        assertTrue((Integer) progress.get("totalXp") > 0);

        Map<String, Object> unlocked = getJson(baseUrl + "/api/unlocked-levels", new TypeReference<>() {});
        assertTrue(((List<?>) unlocked.get("unlocked")).contains("level-1"));

        Map<String, Object> resetResult = postEmpty(baseUrl + "/api/levels/level-1/reset");
        assertEquals(true, resetResult.get("ok"));

        Map<String, Object> sandbox = postSql(baseUrl + "/api/sandbox/run", "SELECT 1 AS n;");
        assertNull(sandbox.get("error"));
        assertEquals(List.of("N"), sandbox.get("columns"));
    }

    @Test
    void returns404ForUnknownLevelRoute() throws Exception {
        app = App.create(
                new LevelRepository(),
                new SqlRunner(),
                new ProgressStore(tempDir.resolve("progress.json")),
                new LeaderboardStore(tempDir.resolve("leaderboard.json"))
        ).start(0);

        HttpResponse<String> response = client.send(
                HttpRequest.newBuilder(URI.create("http://localhost:" + app.port() + "/api/levels/nope"))
                        .GET()
                        .build(),
                HttpResponse.BodyHandlers.ofString()
        );

        assertEquals(404, response.statusCode());
        Map<String, Object> payload = mapper.readValue(response.body(), new TypeReference<>() {});
        assertEquals("Unknown level", payload.get("error"));
    }

    private Map<String, Object> postSql(String url, String sql) throws IOException, InterruptedException {
        HttpResponse<String> response = client.send(
                HttpRequest.newBuilder(URI.create(url))
                        .header("Content-Type", "text/plain")
                        .POST(HttpRequest.BodyPublishers.ofString(sql))
                        .build(),
                HttpResponse.BodyHandlers.ofString()
        );
        assertEquals(200, response.statusCode());
        return mapper.readValue(response.body(), new TypeReference<>() {});
    }

    private Map<String, Object> postEmpty(String url) throws IOException, InterruptedException {
        HttpResponse<String> response = client.send(
                HttpRequest.newBuilder(URI.create(url))
                        .POST(HttpRequest.BodyPublishers.noBody())
                        .build(),
                HttpResponse.BodyHandlers.ofString()
        );
        assertEquals(200, response.statusCode());
        return mapper.readValue(response.body(), new TypeReference<>() {});
    }

    private <T> T getJson(String url, TypeReference<T> typeRef) throws IOException, InterruptedException {
        HttpResponse<String> response = client.send(
                HttpRequest.newBuilder(URI.create(url)).GET().build(),
                HttpResponse.BodyHandlers.ofString()
        );
        assertEquals(200, response.statusCode());
        return mapper.readValue(response.body(), typeRef);
    }
}
