package com.plupp.sqlgame;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plupp.sqlgame.core.LevelRepository;
import com.plupp.sqlgame.core.SqlRunner;
import com.plupp.sqlgame.store.LeaderboardStore;
import com.plupp.sqlgame.store.PlayerStore;
import com.plupp.sqlgame.store.ProgressStore;
import com.plupp.sqlgame.store.TelemetryStore;
import io.javalin.Javalin;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;
import java.util.Base64;
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
                new LeaderboardStore(tempDir.resolve("leaderboard.json")),
                new PlayerStore(tempDir.resolve("player.json")),
                new TelemetryStore(tempDir.resolve("telemetry.ndjson"))
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

        Map<String, Object> unlockedCompat = getJson(baseUrl + "/api/unlocked-levels", new TypeReference<>() {});
        assertTrue(((List<?>) unlockedCompat.get("unlocked")).contains("level-1"));
        assertTrue(((List<?>) unlockedCompat.get("unlockedLevels")).contains("level-1"));

        Map<String, Object> unlockedCanonical = getJson(baseUrl + "/api/levels/unlocked", new TypeReference<>() {});
        assertTrue(((List<?>) unlockedCanonical.get("unlocked")).contains("level-1"));
        assertTrue(((List<?>) unlockedCanonical.get("unlockedLevels")).contains("level-1"));

        Map<String, Object> resetResult = postEmpty(baseUrl + "/api/levels/level-1/reset");
        assertEquals(true, resetResult.get("ok"));

        Map<String, Object> sandbox = postSql(baseUrl + "/api/sandbox/run", "SELECT 1 AS n;");
        assertNull(sandbox.get("error"));
        assertEquals(List.of("N"), sandbox.get("columns"));
    }


    @Test
    void unlockedRoutesAreNotShadowedByLevelIdRoute() throws Exception {
        app = App.create(
                new LevelRepository(),
                new SqlRunner(),
                new ProgressStore(tempDir.resolve("progress.json")),
                new LeaderboardStore(tempDir.resolve("leaderboard.json")),
                new PlayerStore(tempDir.resolve("player.json")),
                new TelemetryStore(tempDir.resolve("telemetry.ndjson"))
        ).start(0);

        String baseUrl = "http://localhost:" + app.port();

        Map<String, Object> canonical = getJson(baseUrl + "/api/levels/unlocked", new TypeReference<>() {});
        assertNotNull(canonical.get("unlocked"));
        assertNotNull(canonical.get("unlockedLevels"));

        Map<String, Object> compat = getJson(baseUrl + "/api/unlocked-levels", new TypeReference<>() {});
        assertNotNull(compat.get("unlocked"));
        assertNotNull(compat.get("unlockedLevels"));
    }


    @Test
    void telemetryEventEndpointRecordsAndReturnsRecentEvents() throws Exception {
        app = App.create(
                new LevelRepository(),
                new SqlRunner(),
                new ProgressStore(tempDir.resolve("progress.json")),
                new LeaderboardStore(tempDir.resolve("leaderboard.json")),
                new PlayerStore(tempDir.resolve("player.json")),
                new TelemetryStore(tempDir.resolve("telemetry.ndjson"))
        ).start(0);

        String baseUrl = "http://localhost:" + app.port();

        Map<String, Object> accepted = postJson(baseUrl + "/api/telemetry/event", Map.of(
                "type", "level_attempt",
                "levelId", "level-1"
        ));
        assertEquals(true, accepted.get("ok"));

        Map<String, Object> invalid = postJson(baseUrl + "/api/telemetry/event", Map.of(
                "type", "made_up",
                "levelId", "level-1"
        ));
        assertEquals(false, invalid.get("ok"));

        List<Map<String, Object>> recent = getJson(baseUrl + "/api/telemetry/recent?limit=5", new TypeReference<>() {});
        assertFalse(recent.isEmpty());
        assertEquals("level_attempt", recent.get(recent.size() - 1).get("type"));
    }

    @Test
    void returns404ForUnknownLevelRoute() throws Exception {
        app = App.create(
                new LevelRepository(),
                new SqlRunner(),
                new ProgressStore(tempDir.resolve("progress.json")),
                new LeaderboardStore(tempDir.resolve("leaderboard.json")),
                new PlayerStore(tempDir.resolve("player.json")),
                new TelemetryStore(tempDir.resolve("telemetry.ndjson"))
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


    @Test
    void playerPostSanitizesNicknameAndReadReflectsIt() throws Exception {
        app = App.create(
                new LevelRepository(),
                new SqlRunner(),
                new ProgressStore(tempDir.resolve("progress.json")),
                new LeaderboardStore(tempDir.resolve("leaderboard.json")),
                new PlayerStore(tempDir.resolve("player.json")),
                new TelemetryStore(tempDir.resolve("telemetry.ndjson"))
        ).start(0);

        String baseUrl = "http://localhost:" + app.port();

        Map<String, Object> created = getJson(baseUrl + "/api/player", new TypeReference<>() {});
        Map<String, Object> updated = postJson(baseUrl + "/api/player", Map.of("nickname", "  ka!rl??  "));

        assertEquals(created.get("playerId"), updated.get("playerId"));
        assertEquals("karl", updated.get("nickname"));

        Map<String, Object> reloaded = getJson(baseUrl + "/api/player", new TypeReference<>() {});
        assertEquals("karl", reloaded.get("nickname"));
    }

    @Test
    void playerProfilePersistsAndLeaderboardDedupIsUsedByTopEndpoint() throws Exception {
        app = App.create(
                new LevelRepository(),
                new SqlRunner(),
                new ProgressStore(tempDir.resolve("progress.json")),
                new LeaderboardStore(tempDir.resolve("leaderboard.json")),
                new PlayerStore(tempDir.resolve("player.json")),
                new TelemetryStore(tempDir.resolve("telemetry.ndjson"))
        ).start(0);

        String baseUrl = "http://localhost:" + app.port();

        Map<String, Object> player1 = getJson(baseUrl + "/api/player", new TypeReference<>() {});
        assertNotNull(player1.get("playerId"));
        assertEquals("Anonymous", player1.get("nickname"));

        Map<String, Object> updated = postJson(baseUrl + "/api/player", Map.of("nickname", "Hugo"));
        assertEquals("Hugo", updated.get("nickname"));
        assertEquals(player1.get("playerId"), updated.get("playerId"));

        postJson(baseUrl + "/api/leaderboard/submit", Map.of("score", 100, "levelId", "level-1"));
        postJson(baseUrl + "/api/leaderboard/submit", Map.of("score", 120, "levelId", "level-1"));
        postJson(baseUrl + "/api/leaderboard/submit", Map.of("score", 90, "levelId", "level-1"));
        postJson(baseUrl + "/api/leaderboard/submit", Map.of("score", 80, "levelId", "level-2"));

        List<Map<String, Object>> top = getJson(baseUrl + "/api/leaderboard/top", new TypeReference<>() {});
        assertEquals(1, top.size());
        assertEquals(200, top.get(0).get("score"));

        Map<String, Object> view = getJson(baseUrl + "/api/leaderboard/view", new TypeReference<>() {});
        List<Map<String, Object>> globalTop = (List<Map<String, Object>>) view.get("globalTop");
        Map<String, List<Map<String, Object>>> perLevelTop = (Map<String, List<Map<String, Object>>>) view.get("perLevelTop");

        assertEquals(1, globalTop.size());
        assertEquals("Hugo", globalTop.get(0).get("nickname"));
        assertEquals(120, perLevelTop.get("level-1").get(0).get("score"));

        Map<String, Object> playerReloaded = getJson(baseUrl + "/api/player", new TypeReference<>() {});
        assertEquals(player1.get("playerId"), playerReloaded.get("playerId"));
        assertEquals("Hugo", playerReloaded.get("nickname"));
    }

    @Test
    void hostedTokenAuthBlocksApiWithoutBearerToken() throws Exception {
        RuntimeConfig runtime = RuntimeConfig.forTesting(
                "localhost",
                7070,
                tempDir.resolve("progress.json"),
                tempDir.resolve("leaderboard.json"),
                tempDir.resolve("player.json"),
                tempDir.resolve("telemetry.ndjson"),
                tempDir.resolve("backups"),
                RuntimeConfig.AuthMode.TOKEN,
                "secret-token",
                null,
                null
        );

        app = App.create(
                new LevelRepository(),
                new SqlRunner(),
                new ProgressStore(runtime.progressPath),
                new LeaderboardStore(runtime.leaderboardPath),
                new PlayerStore(runtime.playerPath),
                new TelemetryStore(runtime.telemetryPath),
                runtime
        ).start(0);

        String baseUrl = "http://localhost:" + app.port();

        HttpResponse<String> blocked = client.send(
                HttpRequest.newBuilder(URI.create(baseUrl + "/api/progress"))
                        .GET()
                        .build(),
                HttpResponse.BodyHandlers.ofString()
        );
        assertEquals(401, blocked.statusCode());

        HttpResponse<String> allowed = client.send(
                HttpRequest.newBuilder(URI.create(baseUrl + "/api/progress"))
                        .header("Authorization", "Bearer secret-token")
                        .GET()
                        .build(),
                HttpResponse.BodyHandlers.ofString()
        );
        assertEquals(200, allowed.statusCode());

        HttpResponse<String> health = client.send(
                HttpRequest.newBuilder(URI.create(baseUrl + "/api/health"))
                        .GET()
                        .build(),
                HttpResponse.BodyHandlers.ofString()
        );
        assertEquals(200, health.statusCode());
    }


    @Test
    void hostedBasicAuthBlocksApiWithoutCredentials() throws Exception {
        RuntimeConfig runtime = RuntimeConfig.forTesting(
                "localhost",
                7070,
                tempDir.resolve("progress.json"),
                tempDir.resolve("leaderboard.json"),
                tempDir.resolve("player.json"),
                tempDir.resolve("telemetry.ndjson"),
                tempDir.resolve("backups"),
                RuntimeConfig.AuthMode.BASIC,
                null,
                "student",
                "secret"
        );

        app = App.create(
                new LevelRepository(),
                new SqlRunner(),
                new ProgressStore(runtime.progressPath),
                new LeaderboardStore(runtime.leaderboardPath),
                new PlayerStore(runtime.playerPath),
                new TelemetryStore(runtime.telemetryPath),
                runtime
        ).start(0);

        String baseUrl = "http://localhost:" + app.port();

        HttpResponse<String> blocked = client.send(
                HttpRequest.newBuilder(URI.create(baseUrl + "/api/progress"))
                        .GET()
                        .build(),
                HttpResponse.BodyHandlers.ofString()
        );
        assertEquals(401, blocked.statusCode());

        String encoded = Base64.getEncoder().encodeToString("student:secret".getBytes(StandardCharsets.UTF_8));
        HttpResponse<String> allowed = client.send(
                HttpRequest.newBuilder(URI.create(baseUrl + "/api/progress"))
                        .header("Authorization", "Basic " + encoded)
                        .GET()
                        .build(),
                HttpResponse.BodyHandlers.ofString()
        );
        assertEquals(200, allowed.statusCode());

        HttpResponse<String> health = client.send(
                HttpRequest.newBuilder(URI.create(baseUrl + "/api/health"))
                        .GET()
                        .build(),
                HttpResponse.BodyHandlers.ofString()
        );
        assertEquals(200, health.statusCode());
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

    private Map<String, Object> postJson(String url, Object body) throws IOException, InterruptedException {
        HttpResponse<String> response = client.send(
                HttpRequest.newBuilder(URI.create(url))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
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
