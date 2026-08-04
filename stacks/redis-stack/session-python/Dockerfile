FROM python:3.11.13-alpine
WORKDIR /app
COPY redis-stack/session-python/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY redis-stack/session-python/src .
EXPOSE 8080
CMD ["python", "app.py"]
