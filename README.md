# MAX: Multi-Service AI Application Stack

This project provides a robust, containerized environment for running a suite of AI services. It uses Docker Compose to
orchestrate a Speech-to-Text (STT) application, a LangChain agent service (`max`), an Ollama Large Language Model (LLM)
service, and an NGINX reverse proxy.

The architecture is designed for both development and production, with GPU acceleration support for high-performance
inference.

## Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Configuration](#configuration)
- [Running the Application](#Running-the-Application)
    - [Development](#development-mode)
    - [Production](#production-mode)
- [NVIDA GPU Support](#NVIDA-GPU-Support)

---

## Architecture

The application is composed of the following services:

- **`web-server`**: A FastAPI service that provides the user interface. It serves a static single-page application that
  acts as the client for the real-time transcription service.

- **`stt`**: The core Speech-to-Text (STT) engine. This FastAPI service uses the `faster-whisper` model to perform
  real-time audio transcription over a WebSocket connection.

- **`assistant`**: An AI assistant service responsible for handling more complex queries and tasks, leveraging the
  underlying language model.

- **`ollama`**: Provides the core Large Language Model (LLM) capabilities that are utilized by other services, such as
  the `assistant`.

- **`proxy`**: An Nginx reverse proxy that acts as the single entry point for all incoming traffic. It handles SSL
  termination and routes requests to the appropriate backend service.

Docker named volumes (`model_cache`, `ollama_models`) are used to persist AI models and cache, preventing re-downloads
on container restarts.

## Prerequisites

Before you begin, ensure you have the following installed:

* **Docker Engine**: [Installation Guide](https://docs.docker.com/engine/install/)
* **Docker Compose**: [Installation Guide](https://docs.docker.com/compose/install/)
* **Docker Plugin**: `docker plugin install grafana/loki-docker-driver:latest --alias loki --grant-all-permissions`
* **NVIDIA Container Toolkit**: Required for GPU
  support. [Installation Guide](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)
* **make**: A build automation tool, typically pre-installed on Linux and macOS.

## Setup

1. **Clone the Repository**:
   ```bash
   git clone <your-repository-url>
   cd <your-project-directory>
   ```

2. **Initialize Git Submodules** (if any are used):
   ```bash
   git submodule update --init --recursive
   ```

3. **Configure Environment**:
   **Configure Your Environment**
   The project uses `.env` files for configuration. Start by copying the template file for both development and
   to test the production environment. <mark> Live production should never use a file but use ENV Variables managed 
   in the host system</mark>

    ```bash
    cp .env.template .env
    cp .env.template .env.dev
    ```
    Next, review the variables in `.env` and `.env.dev` and customize them as needed (e.g., ports, model configurations).

4. **Run the Setup Script**:
   This script creates the necessary external Docker volumes (`model_cache` and `ollama_models`) for persisting model 
   data.  The server-name (hostname of the the server running max) must be passed as a parameter or be defined as an 
   environment variable.
   ```bash
   bash scripts/setup.sh <server-name>
   ```
5. **Run the proxy setup script**:
   This script will generate SLL Certificates for development and test usage, execute from the `max/proxy/` directory.
   ```bash
   cd proxy
   sudo bash scripts/setup.sh
   cd ..
   ```
6. **Run the max-assistant setup script**:
   This script will load the sample data from max/services/max-assistant/csv_data
   and authenticate the gmail client.
   The scripts are dependent on ```env.local``` located in the max-assistant directory.
 
   **TODO** cleanup use of .env files.

   To run the script:
   ```bash
   cd services/max-assistant
   bash scripts/setup.sh
   cd ..
   ```   

## Configuration

This project uses a `Makefile` to simplify common commands for development and to test the production environments.
The docker commands in the makefile will utilize the .env file for production and .env.dev for development.

### SSL

**TODO** update to inline comments in .env.template

For production, you **must** update the server name in your `.env` file:

1. Open the `.env` file.
2. Change the `PROD_SERVER_NAME` variable to your actual domain:
   ```env
   PROD_SERVER_NAME=your-actual-domain.com
   ```
3. Ensure your SSL certificates are correctly mounted in `docker-compose.prod.yaml`.
### GPU vs. CPU
By default, a system with nvida CUDA support is assumed.

To switch the `stt` service to run on CPU:

1. Open the `.env` file.
2. Change the following variables:
   ```env
   STT_DEVICE=cpu
   STT_COMPUTE_TYPE=int8
   ```
3. In `docker-compose.yaml`, comment out the `deploy` section under the `stt` service to disable the GPU reservation.

**TODO** and instructions for switching OLLAMA to CPU MODE

## Running the Application

### Optional Logging Services

If the env variable LOG is set, Grafana and Loki will be started to provide logging services.
```bash
    export LOG=1
```

### Development Mode

To start all services in development mode with hot-reloading enabled for the custom services:

```bash
make dev
```

- The NGINX proxy service will be avail from your browser via  http  `http://localhost:8080` and https 
  `https://localhost:8443` if the default ports are not in use.  Browsers will only allow microphone access over 
  http to localhost.  When using a hostname, you must use https.

To stop and remove the development containers:

```bash
make dev-down
```

### Production Mode

To build and run the services in detached production like mode:

```bash
make prod
```

- The NGINX proxy will redirect HTTP (port 80) to HTTPS (port 443).
- Either localhost or the configured domain name can be used to access the web interface.  
- Ensure you have configured your DNS and SSL certificates correctly in `docker-compose.prod.yaml` and
  `./proxy/nginx/prod.conf.template`.

To stop and remove the production containers:

```bash
make prod-down
```

To bring the services down and clear the build caches:
```bash
make clean
```

### Client (Browser) access
Once the application is running, you can access the web interface at either the server-name or localhost and port you 
configured.

For example if PROXY_HTTPS_PORT=9443:
```
https://127.0.0.1:9443
```


## NVIDA GPU Support

In a WSL Docker environment running the `nvidia/cuda:12.3.2-cudnn9-devel-ubuntu22.04` image, the GPU driver utilized is
the one installed on your **Windows host operating system**. You do not need to install any NVIDIA drivers within the
Docker container itself.

Here's a breakdown of how it works:

* **Windows NVIDIA Driver is Key**: The primary GPU driver is the standard NVIDIA driver you install on your Windows
  machine. This driver includes support for WSL 2, allowing it to communicate with the Linux kernel running in the WSL
  environment.
* **WSL 2 GPU Passthrough**: Windows Subsystem for Linux 2 (WSL 2) has a feature called GPU paravirtualization. This
  allows the Linux distributions running in WSL 2 to access the host machine's GPU. The Windows driver essentially
  exposes the GPU to the WSL 2 virtual machine.
* **NVIDIA Container Toolkit**: When you run a Docker container with GPU support (using the `--gpus all` flag), the
  NVIDIA Container Toolkit is responsible for mounting the necessary user-mode driver libraries and device files from
  the WSL 2 environment into your container. This allows the CUDA applications inside the container to communicate with
  the GPU.

Therefore, the architecture looks like this:

**Docker Container (e.g., `nvidia/cuda`) -> WSL 2 Environment -> Windows Host OS with NVIDIA Driver -> Physical GPU**

This setup offers a streamlined experience as you only need to manage one set of GPU drivers on your Windows host. The
`nvidia/cuda` container comes pre-packaged with the necessary CUDA Toolkit and cuDNN libraries, but it relies on the
host's driver for the low-level interaction with the GPU hardware.

---

## Verifying GPU Access

You can verify that your Docker container is correctly accessing the GPU by running the `nvidia-smi` command inside the
container:

```bash
docker run --gpus all nvidia/cuda:12.3.2-cudnn9-devel-ubuntu22.04 nvidia-smi

```

master-project/
├── .git/                      <-- The master Git repository
├── .gitmodules                <-- (If using submodules) File defining the sub-repos
│
├── services/                  <-- Directory containing your applications
│ ├── stt-app/               <-- Your current STT project lives here (as a sub-project)
│ │ ├── src/
│ │ ├── Dockerfile
│ │ └── ...
│ │
│ └── langchain-app/         <-- The new LangChain project (as another sub-project)
│ ├── src/
│ ├── Dockerfile
│ └── requirements.txt
│
├── proxy/                     <-- The reverse proxy configuration
│ ├── nginx/
│ │ ├── prod.conf
│ │ └── dev.conf
│ └── certs/
│ ├── cert.pem
│ └── key.pem
│
├── docker-compose.yaml        <-- The MASTER compose file that defines ALL services
├── docker-compose.dev.yaml    <-- Overrides for development
├── docker-compose.prod.yaml   <-- Overrides for production
└── Makefile                   <-- A master Makefile to control the whole system

```
