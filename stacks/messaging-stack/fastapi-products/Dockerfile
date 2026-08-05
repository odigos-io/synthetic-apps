FROM python:3.11.13-slim
WORKDIR /app
COPY messaging-stack/fastapi-products/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY messaging-stack/fastapi-products/src .
EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
