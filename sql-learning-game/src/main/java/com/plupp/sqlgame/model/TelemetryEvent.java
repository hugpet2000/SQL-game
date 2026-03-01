package com.plupp.sqlgame.model;

import java.util.LinkedHashMap;
import java.util.Map;

public class TelemetryEvent {
    public String type;
    public String levelId;
    public String playerId;
    public Long durationMs;
    public Long hintIndex;
    public long ts;

    public TelemetryEvent() {
    }

    public TelemetryEvent(String type, String levelId, String playerId, Long durationMs, Long hintIndex, long ts) {
        this.type = type;
        this.levelId = levelId;
        this.playerId = playerId;
        this.durationMs = durationMs;
        this.hintIndex = hintIndex;
        this.ts = ts;
    }

    public Map<String, Object> toPayload() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", type);
        payload.put("levelId", levelId);
        payload.put("playerId", playerId);
        if (durationMs != null) payload.put("durationMs", durationMs);
        if (hintIndex != null) payload.put("hintIndex", hintIndex);
        payload.put("ts", ts);
        return payload;
    }
}
