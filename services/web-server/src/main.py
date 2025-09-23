from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn



app = FastAPI()

# The static directory is located one level above the `src` directory where main.py is.
# Path(__file__).parent resolves to the `src` directory.
# .parent goes one level up to `web-server`.
static_dir = Path(__file__).parent.parent / "static"
favicon_path = static_dir / "images/favicon.ico"

# Mount the `static` directory at the `/static` URL path
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get('/favicon.ico', include_in_schema=False)
async def favicon():
    return FileResponse(favicon_path)

@app.get("/")
async def get_index():
    """Serves the main index.html file from the static directory."""
    index_path = static_dir / "index.html"
    return FileResponse(index_path)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.0", port=80)
