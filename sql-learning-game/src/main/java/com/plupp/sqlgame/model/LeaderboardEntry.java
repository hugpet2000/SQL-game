package com.plupp.sqlgame.model;

public class LeaderboardEntry {
    public String playerId;
    public String nickname;
    public int score;
    public String levelId;
    public long achievedAtEpochMs;

    public LeaderboardEntry() {
    }

    public LeaderboardEntry(String nickname, int score, String levelId, long achievedAtEpochMs) {
        this(null, nickname, score, levelId, achievedAtEpochMs);
    }

    public LeaderboardEntry(String playerId, String nickname, int score, String levelId, long achievedAtEpochMs) {
        this.playerId = playerId;
        this.nickname = nickname;
        this.score = score;
        this.levelId = levelId;
        this.achievedAtEpochMs = achievedAtEpochMs;
    }
}
