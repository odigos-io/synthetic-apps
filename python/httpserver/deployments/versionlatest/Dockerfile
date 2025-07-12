FROM python:latest
WORKDIR /app
COPY ./requirements.txt /app
RUN pip install --no-cache-dir -r requirements.txt
COPY ./src /app
EXPOSE 8080
CMD ["python", "main.py"] 