FROM eclipse-temurin:8-jdk AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y maven && rm -rf /var/lib/apt/lists/*
COPY pom.xml .
COPY src ./src
# Add Maven configuration for better ARM64 performance
RUN mvn clean package -DskipTests -Dmaven.test.skip=true -Dmaven.javadoc.skip=true

FROM eclipse-temurin:8-jre
WORKDIR /app
COPY --from=builder /app/target/httpserver-1.0.0.jar app.jar
EXPOSE 8080
ENV JAVA_VERSION=""
CMD ["java", "-jar", "app.jar"] 