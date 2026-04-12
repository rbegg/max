# Use an official NVIDIA CUDA runtime image as a parent image.
#ARG BASE_IMAGE=nvidia/cuda:12.3.2-cudnn9-runtime-ubuntu22.04
ARG BASE_IMAGE=nvidia/cuda:13.2.0-cudnn-runtime-ubuntu24.04
#ARG BASE_IMAGE=nvidia/cuda:13.2.0-cudnn-runtime-ubuntu26.04
ARG OLLAMA_DEBUG=0

FROM ${BASE_IMAGE}
ARG OLLAMA_DEBUG

# Set environment variables for non-root user and new models path
ENV OLLAMA_HOST=0.0.0.0 \
    OLLAMA_MODELS=/home/ollama/.ollama \
    DEBUG=$OLLAMA_DEBUG

# Install dependencies needed for the Ollama install script
RUN apt-get update && apt-get install -y \
    curl \
    zstd \
    && rm -rf /var/lib/apt/lists/*

# Install Ollama using the official script (as root)
#RUN curl -fsSL https://ollama.com/install.sh | sh
RUN curl -fsSL https://ollama.com/install.sh | OLLAMA_INSTALL_IN_CONTAINER=1 sh

# Rename the existing 'ubuntu' group to 'ollama'
RUN groupmod -n ollama ubuntu && \
    # Rename the user 'ubuntu' to 'ollama', set the new home path, and move the content
    usermod -l ollama -d /home/ollama -m ubuntu

# Create the models directory and set permissions
RUN mkdir -p ${OLLAMA_MODELS} && \
    chown -R ollama:ollama /home/ollama

# Switch to the non-root user
USER ollama

# Expose the port Ollama listens on
EXPOSE 11434

# Set the entrypoint to run Ollama as the 'ollama' user
ENTRYPOINT [ "ollama", "serve" ]