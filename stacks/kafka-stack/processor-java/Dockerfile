FROM eclipse-temurin:17.0.15_6-jdk AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y maven && rm -rf /var/lib/apt/lists/*
COPY kafka-stack/processor-java/pom.xml .
COPY kafka-stack/processor-java/src ./src
RUN mvn clean package -DskipTests -q

FROM eclipse-temurin:17.0.15_6-jre
WORKDIR /app
COPY --from=builder /app/target/processor-java-1.0.0.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
