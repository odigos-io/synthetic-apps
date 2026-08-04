FROM python:3.11.13-alpine
WORKDIR /app
RUN apk add --no-cache libpq-dev gcc musl-dev
COPY postgres-stack/orders-python/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY postgres-stack/orders-python/src .
EXPOSE 8080
CMD ["python", "app.py"]
