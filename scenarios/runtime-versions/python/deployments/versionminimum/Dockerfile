FROM python:3.9.0-alpine
WORKDIR /app
COPY ./deployments/versionminimum/requirements.txt /app/requirements.txt
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt
COPY ./src /app
EXPOSE 8080
CMD ["python", "main.py"] 