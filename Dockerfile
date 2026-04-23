# Build React Frontend
FROM node:18 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json ./
# Use npm install if user has node, else we skip this for a pure python dockerfile if we want, but standard Vite needs it.
# Actually, the user doesn't need Node on their host, the Docker container handles it!
RUN npm install
COPY frontend/ ./
RUN npm run build

# Build Python Backend
FROM python:3.10-slim
WORKDIR /app

# Install backend dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY . .

# Copy built frontend to static directory for FastAPI to serve
# (Optional: If we want FastAPI to serve the React files directly, 
#  we would need to add static file serving in app.py. 
#  For simplicity, we can just run both or have a reverse proxy, but let's serve static from FastAPI)
COPY --from=frontend-build /app/frontend/dist /app/static

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
