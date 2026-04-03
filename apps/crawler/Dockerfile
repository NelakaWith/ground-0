FROM python:3.11-slim

WORKDIR /app

# Install system dependencies that Chromium/Crawl4AI might need
RUN apt-get update && apt-get install -y \
    chromium-browser \
    chromium-common \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 3001

# Run the application
CMD ["python", "main.py"]
