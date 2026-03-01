package com.plupp.sqlgame.model;

public class PlayerProfile {
    public String playerId;
    public String nickname;
    public long createdAt;
    public long lastSeenAt;

    public PlayerProfile() {
    }

    public PlayerProfile(String playerId, String nickname, long createdAt, long lastSeenAt) {
        this.playerId = playerId;
        this.nickname = nickname;
        this.createdAt = createdAt;
        this.lastSeenAt = lastSeenAt;
    }
}
