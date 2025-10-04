# Refactor FastAPI for Concurrency

**Exported:** 10/3/2025 17:54:38  
**Link:** [https://gemini.google.com/app/a65d754385509136](https://gemini.google.com/app/a65d754385509136)

## Prompt:
> main - PY

review the file and suggest any refactoring to follow best practices

## Response:
Of course! Your code provides a solid, decoupled foundation using FastAPI and `asyncio` queues. The use of the `lifespan` manager and type hints is excellent.

The most significant refactoring opportunity is to **move from a global state model to an encapsulated, class-based approach**. This will make your application robust, easier to maintain, and capable of handling multiple concurrent clients correctly.

Here are the suggested refactorings, from most impactful to minor cleanup.

* * *

### 1\. Encapsulate Connection State for Concurrency 🏢

The biggest issue is the use of global variables (`binary_input_queue`, `text_input_queue`, `client_output_queue`, and `conversation_state`). This architecture means that if two clients connect at the same time, they will share the same queues and conversation state, leading to mixed-up messages and incorrect behavior.

The best practice is to create a class that manages the state and logic for a single client connection.

**Recommendation:** Create a `ConnectionManager` class.

*   Each time a client connects, you create a **new instance** of this class.
*   This instance will have its **own queues** and its **own conversation state**.
*   The logic from `agent_loop` and `text_input_handler_loop` will become methods of this class.

Here’s a conceptual example of how your code would be restructured:

```
# (Imports and reasoning_engine setup remain similar)

class ConnectionManager:
    def __init__(self, reasoning_engine, websocket: WebSocket):
        self.ws = websocket
        self.reasoning_engine = reasoning_engine
        # Each connection gets its own set of queues
        self.binary_in_q = Queue()
        self.text_in_q = Queue()
        self.client_out_q = Queue()
        # Each connection gets its own state
        self.state: GraphState = {
            "messages": [],
            "username": DEFAULT_USERNAME,
            "transcribed_text": "",
            "voice": TTS_VOICE
        }

    # The agent_loop logic becomes a method
    async def _agent_loop(self):
        # Access queues and state via `self.binary_in_q`, `self.state`, etc.
        # This logic is almost identical to your global agent_loop,
        # but uses instance variables instead of global ones.
        ...

    # The text_input_handler_loop logic becomes a method
    async def _text_input_handler_loop(self):
        # Logic from your global text_input_handler_loop goes here,
        # using `self.text_in_q` and `self.state`.
        ...

    # The WebSocket reader/writer logic can also be methods
    async def _client_reader(self):
        # Reads from `self.ws` and puts into `self.text_in_q` or `self.binary_in_q`
        ...

    async def _client_writer(self):
        # Gets from `self.client_out_q` and sends to `self.ws`
        ...

    # This is the main entry point for the class
    async def handle_connection(self):
        """Manages all tasks for a single client connection."""
        tasks = [
            asyncio.create_task(self._agent_loop()),
            asyncio.create_task(self._text_input_handler_loop()),
            asyncio.create_task(self._client_reader()),
            asyncio.create_task(self._client_writer())
        ]
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)

        for task in pending:
            task.cancel()
        for task in done:
            # Propagate exceptions if any task failed
            if task.exception():
                logging.error(f"A task failed: {task.exception()}")

# The WebSocket endpoint becomes extremely simple
@app.websocket("/ws")
async def websocket_endpoint(client_ws: WebSocket):
    await client_ws.accept()
    # The reasoning_engine is now passed in from the application state
    manager = ConnectionManager(reasoning_engine, client_ws)
    try:
        await manager.handle_connection()
    except Exception as e:
        logging.error(f"Connection handler failed: {e}", exc_info=True)
    finally:
        logging.info("Client connection handler finished.")

```

* * *

### 2\. Make Startup More Robust 💪

Initializing the `reasoning_engine` in a background task is a good non-blocking pattern, but it allows the server to start even if the engine—a critical component—fails to build. This can lead to the server running in a broken state.

A more robust "fail-fast" approach is to `await` the engine's creation directly during the startup phase. If it fails, the entire application will fail to start, which is often the desired behavior for critical failures.

**Recommendation:** Await engine creation in `lifespan` and store it in `app.state`.

```
# This will hold the compiled engine. No longer needs to be a global.
reasoning_engine = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages the application's startup and shutdown logic.
    """
    logging.info("Application startup...")

    # Await the engine creation directly. The app won't start if this fails.
    logging.info("Initializing the reasoning engine...")
    global reasoning_engine
    reasoning_engine = await create_reasoning_engine()
    if not reasoning_engine:
        raise RuntimeError("Failed to initialize the reasoning engine.")
    logging.info("Reasoning engine is ready.")

    # The agent and text handler tasks are now managed per-connection,
    # so they are removed from the global lifespan manager.

    yield

    logging.info("Shutdown complete.")

app = FastAPI(lifespan=lifespan)
```

* * *

### 3\. Minor Code Cleanup and Bug Fixes 🧹

1.  **Fix Undefined `HOST` Variable:** The `uvicorn.run` call at the bottom of your file uses a `HOST` variable that isn't defined or imported. You should import it from your config file.
    ```
    # At the top of your file
    from .config import HOST, PORT, ...
    # At the bottom of your file
    if __name__ == "__main__":
        uvicorn.run(app, host=HOST, port=PORT)
    ```
2.  **Remove Dead Code:** The commented-out line `# reasoning_engine = create_reasoning_engine()` near the end of the file is a remnant and should be deleted to keep the code clean.

By implementing these changes, you'll transform your script into a scalable, robust, and professional-grade application architecture. ✨

## Prompt:
for #2, can i start async tasks for all required services and then use a async gather

## Response:
Yes, absolutely! Using `asyncio.gather` is an excellent and highly recommended practice for initializing multiple services during application startup.

It's more efficient than awaiting each service one by one because it allows all the independent, I/O-bound initialization tasks (like connecting to APIs, databases, or loading models) to run concurrently. The total startup time will be determined by the single longest-running task, not the sum of all of them.

This approach still maintains the "fail-fast" principle. If any of the tasks in `asyncio.gather` fails with an exception, the `gather` call itself will raise that exception, which will stop your application from starting in an incomplete or broken state.

* * *

### \## Concurrent Initialization with `asyncio.gather`

Here’s how you can modify the `lifespan` manager to initialize multiple services concurrently and make them available to your application. A common FastAPI pattern is to attach the initialized services to the `app.state` object.

**Example Implementation:**

Let's imagine you need to initialize your `reasoning_engine`, and also connect to a hypothetical database and an external metrics service on startup.

```
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI

# Assume these are your async initializers for different services
from .graph import create_reasoning_engine
from .some_db import connect_to_database
from .metrics import initialize_metrics_client

# This will hold the application instance
app = FastAPI()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Initializes all required services concurrently on startup.
    """
    logging.info("Application startup: Initializing services...")

    # Schedule all initialization coroutines to run concurrently
    initialization_tasks = [
        create_reasoning_engine(),
        connect_to_database(),
        initialize_metrics_client()
    ]

    try:
        # The `gather` function waits for all tasks to complete
        engine, db_conn, metrics_client = await asyncio.gather(*initialization_tasks)

        # Attach initialized services to the app's state for access in endpoints
        app.state.reasoning_engine = engine
        app.state.db_connection = db_conn
        app.state.metrics_client = metrics_client

        logging.info("All services initialized successfully. Application is ready. ✅")

    except Exception as e:
        # If any service fails, the app will not start
        logging.critical(f"Service initialization failed: {e}", exc_info=True)
        # You might want to raise the exception to ensure startup is halted
        raise RuntimeError("Failed to initialize a critical service.") from e

    yield

    # Shutdown logic (e.g., closing connections) would go here
    logging.info("Application shutdown...")
    if app.state.db_connection:
        await app.state.db_connection.close()
    logging.info("Shutdown complete.")

# Now, you need to update the app instance to use the lifespan manager
app.router.lifespan_context = lifespan
```

Now, in your WebSocket endpoint, you can access the pre-initialized engine from the `request` or `app` object instead of a global variable, which is a cleaner pattern.

```
from fastapi import Request, WebSocket

@app.websocket("/ws")
async def websocket_endpoint(client_ws: WebSocket):
    await client_ws.accept()
    # Access the engine from the application state
    reasoning_engine = client_ws.app.state.reasoning_engine
    manager = ConnectionManager(reasoning_engine, client_ws)
    # ... rest of your connection handling logic
```



---
Powered by [Gemini Exporter](https://www.geminiexporter.com)