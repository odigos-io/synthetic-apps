FROM eclipse-temurin:17.0.15_6-jdk AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y maven && rm -rf /var/lib/apt/lists/*
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests -Dmaven.test.skip=true -Dmaven.javadoc.skip=true

FROM eclipse-temurin:17.0.15_6-jre
WORKDIR /app
COPY --from=builder /app/target/claims-intake-2.3.0.jar app.jar
EXPOSE 8080
# dontinline keeps every application method a real frame, so profiles show
# ClaimIntakeService -> FraudScoringEngine -> FraudModel instead of one
# JIT-merged blob, and the call graph the model sees matches the source.
CMD ["java", "-XX:CompileCommand=quiet", "-XX:CompileCommand=dontinline,com.meridian.claims.*::*", "-jar", "app.jar"]
