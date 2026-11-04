# Vultr VM deployment

1. Create a small Vultr VM with Docker installed (Ubuntu is sufficient). `cloud-init.yaml` is a
   starting point for a fresh VM; review the clone path and add `deploy/env.sh` out-of-band.
2. Clone this public repository and run from `vultr-agent-rush-2026/`:

```bash
docker build -t containment-foreman .
docker run --rm --init -p 8080:8080 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e LLM_BASE_URL="${LLM_BASE_URL}" \
  -e LLM_API_KEY="${LLM_API_KEY}" \
  -e LLM_MODEL="${LLM_MODEL}" \
  containment-foreman
```

Or, from the `deploy/` directory, create a root-owned `env.sh` (mode `600`) and run
`docker compose up -d --build` using `docker-compose.yml`.

The application container needs access to the Docker socket to dispatch disposable worker
containers. On a demo VM, use a dedicated host and restrict port 8080 with the VM firewall.
The worker receives no host environment, API keys, or host mounts other than its disposable staging
directory. Each worker has network disabled, read-only root, a tmpfs `/tmp`, memory/CPU/PID caps,
an unprivileged UID, all capabilities dropped, `no-new-privileges`, and `--rm` lifecycle cleanup.

## Vultr Serverless Inference adapter

Use the OpenAI-compatible Serverless Inference endpoint supplied by Vultr:

```bash
export LLM_BASE_URL="https://<vultr-serverless-endpoint>/v1"
export LLM_API_KEY="<loaded from the host secret store>"
export LLM_MODEL="<vultr-model-id>"
```

Do not commit this file with values. Keep the actual exports in a root-owned `env.sh` with mode
`600`, source it only in the deployment shell, and never pass it into worker containers.
