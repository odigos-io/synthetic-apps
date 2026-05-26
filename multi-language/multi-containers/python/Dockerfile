FROM python:3.11.13-alpine
WORKDIR /app
COPY ./requirements.txt /app
RUN pip install --no-cache-dir -r requirements.txt
COPY ./main.py /app
ENV PORT=8070
EXPOSE 8070
CMD ["python", "main.py"]
