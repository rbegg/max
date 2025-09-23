import uvicorn
from fastapi import FastAPI
from fastapi.responses import FileResponse

app = FastAPI()

@app.get("/")
async def get_index():
    """Serves the main index.html file."""
    return FileResponse('./index.html')

if __name__ == "__main__":
    # This host/port is for running outside Docker. Inside Docker, Uvicorn will use the CMD in the Dockerfile.
    uvicorn.run(app, host="127.0.0.1", port=8765)