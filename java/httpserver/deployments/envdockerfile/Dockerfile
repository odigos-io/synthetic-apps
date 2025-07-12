FROM openjdk:8-jdk-alpine AS builder
WORKDIR /app
RUN apk add --no-cache maven
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

FROM openjdk:8-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/httpserver-1.0.0.jar app.jar
ENV JAVA_OPTS="-Xmx512m -Xms256m"
ENV SPRING_PROFILES_ACTIVE="default"
EXPOSE 8080
CMD ["java", "-jar", "app.jar"] 