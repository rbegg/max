# Use the official image from the creator of FastAPI, specifying your Python version
FROM python:3.11-slim-bookworm

# Set the working directory inside the container
WORKDIR /app

# Copy your application's requirements file and install dependencies
COPY ./requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# Copy your application code into the container
COPY . .

# The base image already has a CMD to run the server.
# It automatically looks for a FastAPI variable named "app"
# in a file located at /app/main.py or /app/app/main.py.
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "80"]