package com.plupp.sqlgame;

import io.javalin.http.Context;
import io.javalin.http.UnauthorizedResponse;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

public class HostedAuthGuard {

    private final RuntimeConfig config;

    public HostedAuthGuard(RuntimeConfig config) {
        this.config = config;
    }

    public void enforce(Context ctx) {
        if (config.authMode == RuntimeConfig.AuthMode.OFF) {
            return;
        }

        String authHeader = ctx.header("Authorization");
        boolean ok = switch (config.authMode) {
            case TOKEN -> matchesBearerToken(authHeader, config.authToken);
            case BASIC -> matchesBasicAuth(authHeader, config.authUsername, config.authPassword);
            case OFF -> true;
        };

        if (!ok) {
            if (config.authMode == RuntimeConfig.AuthMode.BASIC) {
                ctx.header("WWW-Authenticate", "Basic realm=\"SQL Learning Game\"");
            }
            throw new UnauthorizedResponse("Unauthorized");
        }
    }

    private static boolean matchesBearerToken(String header, String expectedToken) {
        if (header == null || !header.startsWith("Bearer ")) return false;
        String token = header.substring("Bearer ".length()).trim();
        return expectedToken != null && expectedToken.equals(token);
    }

    private static boolean matchesBasicAuth(String header, String expectedUser, String expectedPass) {
        if (header == null || !header.startsWith("Basic ")) return false;
        String encoded = header.substring("Basic ".length()).trim();
        try {
            String decoded = new String(Base64.getDecoder().decode(encoded), StandardCharsets.UTF_8);
            int idx = decoded.indexOf(':');
            if (idx < 0) return false;
            String username = decoded.substring(0, idx);
            String password = decoded.substring(idx + 1);
            return expectedUser.equals(username) && expectedPass.equals(password);
        } catch (Exception e) {
            return false;
        }
    }
}
