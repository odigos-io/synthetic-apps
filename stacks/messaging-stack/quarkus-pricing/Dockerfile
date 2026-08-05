FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /app
COPY messaging-stack/quarkus-pricing/pom.xml .
COPY messaging-stack/quarkus-pricing/src ./src
RUN mvn -q package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=builder /app/target/quarkus-app /app
EXPOSE 8080
CMD ["java", "-jar", "quarkus-run.jar"]
