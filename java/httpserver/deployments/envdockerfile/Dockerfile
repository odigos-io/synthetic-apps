FROM eclipse-temurin:17.0.10_7-jdk AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y maven && rm -rf /var/lib/apt/lists/*
COPY pom.xml .
COPY src ./src
# Add Maven configuration for better ARM64 performance
RUN mvn clean package -DskipTests -Dmaven.test.skip=true -Dmaven.javadoc.skip=true

FROM eclipse-temurin:17.0.10_7-jre
WORKDIR /app
COPY --from=builder /app/target/httpserver-1.0.0.jar app.jar
ENV JAVA_OPTS="-Xmx512m -Xms256m"
ENV SPRING_PROFILES_ACTIVE="default"
EXPOSE 8080
CMD ["java", "-jar", "app.jar"] 