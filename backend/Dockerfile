# Multi-stage Dockerfile for Enterprise AI Assistant Backend
# Build stage
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app

# Cache dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Build application
COPY src ./src
RUN mvn clean package -DskipTests -B

# Runtime stage
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Create unprivileged user for security
RUN groupadd -r appgroup && useradd -r -g appgroup -d /app appuser
RUN mkdir -p /app/storage/documents && chown -R appuser:appgroup /app

USER appuser

COPY --from=build --chown=appuser:appgroup /app/target/knowledge-assistant-*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-XX:+UseG1GC", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
