# Use Python 3.8 slim image with platform specification
FROM --platform=linux/amd64 python:3.8-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ app/
COPY wsgi.py .

# Create directory for external config
RUN mkdir /config

# Set environment variables
ENV FLASK_APP=wsgi.py
ENV FLASK_ENV=development
ENV FLASK_DEBUG=1
ENV PYTHONUNBUFFERED=1
ENV PORT=5001

# Expose port
EXPOSE 5001

# Command to run the application
CMD ["python", "wsgi.py"]