import uvicorn

if __name__ == "__main__":
    print("Starting CodeAtlas API server on 127.0.0.1:8000...", flush=True)
    uvicorn.run("apps.api.app.main:app", host="127.0.0.1", port=8000, log_level="info")
