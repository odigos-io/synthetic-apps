FROM python:3.6.15-slim
WORKDIR /app
COPY ./requirements.txt /app
RUN pip install --no-cache-dir -r requirements.txt
COPY ./src /app
EXPOSE 8080
ENV PYTHON_VERSION=""
CMD ["python", "main.py"] 