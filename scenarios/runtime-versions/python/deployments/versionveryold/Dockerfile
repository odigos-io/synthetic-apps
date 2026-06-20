FROM python:3.6.15-alpine
WORKDIR /app
COPY ./deployments/versionveryold/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY ./src /app
EXPOSE 8080
ENV PYTHON_VERSION=""
CMD ["python", "main.py"] 