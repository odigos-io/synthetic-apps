FROM python:3.11.13-alpine
WORKDIR /app
COPY kafka-stack/analytics-python/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY kafka-stack/analytics-python/src .
EXPOSE 8080
CMD ["python", "app.py"]
