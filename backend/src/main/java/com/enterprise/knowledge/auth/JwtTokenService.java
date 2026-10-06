package com.enterprise.knowledge.auth;

import java.time.Instant;

import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

import com.enterprise.knowledge.security.JwtProperties;
import com.enterprise.knowledge.user.AppUser;

@Service
public class JwtTokenService {

    private final JwtEncoder jwtEncoder;
    private final JwtProperties properties;

    public JwtTokenService(JwtEncoder jwtEncoder, JwtProperties properties) {
        this.jwtEncoder = jwtEncoder;
        this.properties = properties;
    }

    public String createAccessToken(AppUser user) {
        Instant now = Instant.now();

        JwtClaimsSet.Builder claimsBuilder = JwtClaimsSet.builder()
                .issuer("enterprise-knowledge-assistant")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(properties.expirationMinutes() * 60))
                .subject(user.getId().toString())
                .claim("tenant_id", user.getTenant().getId().toString())
                .claim("email", user.getEmail())
            .claim("role", user.getRole().name());

        if (user.getDepartment() != null) {
            claimsBuilder.claim("department_id", user.getDepartment().getId().toString());
        }

        JwtClaimsSet claims = claimsBuilder.build();

        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }
}
