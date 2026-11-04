FROM python:3.12-slim
WORKDIR /app
COPY app app
COPY sandbox sandbox
COPY README.md .
EXPOSE 8080
CMD ["python", "-m", "app.server"]
