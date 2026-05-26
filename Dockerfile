FROM python:3.12-slim

WORKDIR /app

# Install system dependencies needed by faiss-cpu and PyPDF2
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create directories that the app writes to at runtime
RUN mkdir -p logs

EXPOSE 7860

CMD ["python", "Chatbot.py"]
