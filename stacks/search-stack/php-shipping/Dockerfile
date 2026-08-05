FROM composer:2 AS vendor
WORKDIR /app
COPY search-stack/php-shipping/composer.json .
RUN composer install --no-dev --optimize-autoloader

FROM php:8.3-cli-alpine
RUN docker-php-ext-install pdo_mysql
WORKDIR /app
COPY --from=vendor /app/vendor ./vendor
COPY search-stack/php-shipping/src ./src
EXPOSE 8080
CMD ["php", "-S", "0.0.0.0:8080", "-t", "src", "src/index.php"]
