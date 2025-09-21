# MAX: Multi-Service AI Application Stack

This project provides a robust, containerized environment for running a suite of AI services. It uses Docker Compose to orchestrate a Speech-to-Text (STT) application, a LangChain agent service (`max`), an Ollama Large Language Model (LLM) service, and an NGINX reverse proxy.

The architecture is designed for both development and production, with GPU acceleration support for high-performance inference.

## Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Configuration](#configuration)
- [Usage](#usage)
  - [Development](#development)
  - [Production](#production)
- [Services](#services)

---

## Architecture

The application stack consists of the following containerized services:

-   **`stt`**: A Python-based Speech-to-Text service using `aiohttp` and `faster-whisper`. It exposes a WebSocket endpoint for real-time transcription.
-   **`max`**: A LangChain application service (details to be expanded).
-   **`ollama`**: An instance of Ollama for serving large language models, configured to use a dedicated Docker volume for model storage.
-   **`proxy`**: An NGINX reverse proxy that acts as the single entry point for all services. It is configured to handle SSL termination in production.

Docker named volumes (`model_cache`, `ollama_models`) are used to persist AI models and cache, preventing re-downloads on container restarts.

## Prerequisites

Before you begin, ensure you have the following installed:
*   **Docker Engine**: [Installation Guide](https://docs.docker.com/engine/install/)
*   **Docker Compose**: [Installation Guide](https://docs.docker.com/compose/install/)
*   **NVIDIA Container Toolkit**: Required for GPU support. [Installation Guide](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)
*   **make**: A build automation tool, typically pre-installed on Linux and macOS.

## Setup

1.  **Clone the Repository**:
    ```bash
    git clone <your-repository-url>
    cd <your-project-directory>
    ```

2.  **Initialize Git Submodules** (if any are used):
    ```bash
    git submodule update --init --recursive
    ```

3.  **Configure Environment**:
    Create your local environment file by copying the template. This file will contain all the configuration variables for your services.
    ```bash
    cp .env.template .env
    ```
    **Review and edit the `.env` file** to match your local setup (e.g., domain names, ports, model settings).

4.  **Run the Setup Script**:
    This script creates the necessary Docker volumes (`model_cache` and `ollama_models`) for persisting model data.
    ```bash
    bash scripts/setup.sh
    ```

## Configuration

This project uses a `Makefile` to simplify common commands for development and production environments.

### Development

To start all services in development mode with hot-reloading enabled for the `stt` service:

```bash
make dev
```
-   The STT service will be accessible at `http://localhost:8765`.
-   The Ollama service API will be available at `http://localhost:11434`.

To stop and remove the development containers:
```bash
make dev-down
```

### Production

To build and run the services in detached production mode:
```bash
make prod
```
-   The NGINX proxy will be exposed on ports `80` and `443`.
-   Ensure you have configured your DNS and SSL certificates correctly in `docker-compose.prod.yaml` and `./proxy/nginx/prod.conf.template`.

To stop and remove the production containers:
```bash
make prod-down
```

## Services

| Service | Description                               | Development Port | Production Entry |
| :------ | :---------------------------------------- | :--------------- | :--------------- |
| **stt** | Real-time Speech-to-Text via WebSocket.   | `8765`           | `yourdomain.com` |
| **max** | LangChain application service.            | `TBD`            | `yourdomain.com` |
| **ollama**| Ollama LLM serving API.                   | `11434`          | (internal)       |
| **proxy** | NGINX Reverse Proxy                       | `8000`           | `80`, `443`      |


## Configuration

All project configuration is managed centrally in the `.env` file. This is where you can switch between GPU and CPU, change domain names, and adjust model parameters.

### GPU vs. CPU

To switch the `stt` service to run on CPU:

1.  Open the `.env` file.
2.  Change the following variables:
    ```env
    STT_DEVICE=cpu
    STT_COMPUTE_TYPE=int8
    ```
3.  In `docker-compose.yaml`, comment out the `deploy` section under the `stt` service to disable the GPU reservation.

### Production Domain

For production, you **must** update the server name in your `.env` file:

1.  Open the `.env` file.
2.  Change the `PROD_SERVER_NAME` variable to your actual domain:
    ```env
    PROD_SERVER_NAME=your-actual-domain.com
    ```
3.  Ensure your SSL certificates are correctly mounted in `docker-compose.prod.yaml`.

## Usage

In a WSL Docker environment running the `nvidia/cuda:12.3.2-cudnn9-devel-ubuntu22.04` image, the GPU driver utilized is the one installed on your **Windows host operating system**. You do not need to install any NVIDIA drivers within the Docker container itself.

Here's a breakdown of how it works:

* **Windows NVIDIA Driver is Key**: The primary GPU driver is the standard NVIDIA driver you install on your Windows machine. This driver includes support for WSL 2, allowing it to communicate with the Linux kernel running in the WSL environment.
* **WSL 2 GPU Passthrough**: Windows Subsystem for Linux 2 (WSL 2) has a feature called GPU paravirtualization. This allows the Linux distributions running in WSL 2 to access the host machine's GPU. The Windows driver essentially exposes the GPU to the WSL 2 virtual machine.
* **NVIDIA Container Toolkit**: When you run a Docker container with GPU support (using the `--gpus all` flag), the NVIDIA Container Toolkit is responsible for mounting the necessary user-mode driver libraries and device files from the WSL 2 environment into your container. This allows the CUDA applications inside the container to communicate with the GPU.

Therefore, the architecture looks like this:

**Docker Container (e.g., `nvidia/cuda`) -> WSL 2 Environment -> Windows Host OS with NVIDIA Driver -> Physical GPU**

This setup offers a streamlined experience as you only need to manage one set of GPU drivers on your Windows host. The `nvidia/cuda` container comes pre-packaged with the necessary CUDA Toolkit and cuDNN libraries, but it relies on the host's driver for the low-level interaction with the GPU hardware.

---
## Verifying GPU Access

You can verify that your Docker container is correctly accessing the GPU by running the `nvidia-smi` command inside the container:

```bash
docker run --gpus all nvidia/cuda:12.3.2-cudnn9-devel-ubuntu22.04 nvidia-smi

```
master-project/
├── .git/                      <-- The master Git repository
├── .gitmodules                <-- (If using submodules) File defining the sub-repos
│
├── services/                  <-- Directory containing your applications
│   ├── stt-app/               <-- Your current STT project lives here (as a sub-project)
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── ...
│   │
│   └── langchain-app/         <-- The new LangChain project (as another sub-project)
│       ├── src/
│       ├── Dockerfile
│       └── requirements.txt
│
├── proxy/                     <-- The reverse proxy configuration
│   ├── nginx/
│   │   ├── prod.conf
│   │   └── dev.conf
│   └── certs/
│       ├── cert.pem
│       └── key.pem
│
├── docker-compose.yaml        <-- The MASTER compose file that defines ALL services
├── docker-compose.dev.yaml    <-- Overrides for development
├── docker-compose.prod.yaml   <-- Overrides for production
└── Makefile                   <-- A master Makefile to control the whole system
```
