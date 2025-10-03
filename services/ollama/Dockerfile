# Use an official NVIDIA CUDA runtime image as a parent image.
ARG BASE_IMAGE=nvidia/cuda:12.3.2-cudnn9-runtime-ubuntu22.04

FROM ${BASE_IMAGE}

# Set environment variables for non-root user and new models path
ENV OLLAMA_HOST=0.0.0.0 \
    OLLAMA_MODELS=/home/ollama/.ollama \
    DEBUG=${OLLAMA_DEBUG:-0}

# Install dependencies needed for the Ollama install script
RUN apt-get update && apt-get install -y curl

# Install Ollama using the official script (as root)
RUN curl -fsSL https://ollama.com/install.sh | sh

# Create a non-root user 'ollama' with UID/GID 1000
# and create the home directory.
RUN groupadd -g 1000 ollama && \
    useradd -u 1000 -g 1000 -m -s /bin/bash ollama

# Create the models directory and set permissions
RUN mkdir -p ${OLLAMA_MODELS} && \
    chown -R ollama:ollama /home/ollama

# Switch to the non-root user
USER ollama

# Expose the port Ollama listens on
EXPOSE 80

# Set the entrypoint to run Ollama as the 'ollama' user
ENTRYPOINT [ "ollama", "serve" ]