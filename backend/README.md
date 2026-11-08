# Backend – AI Location Intelligence

Agente construido con LangGraph y LangChain (proveedores: Groq y OpenAI).

## Requisitos

- Python 3.12
- [uv](https://docs.astral.sh/uv/)

## Uso

```bash
uv sync                          # instala dependencias en .venv
uv run ai-location-intelligence  # ejecuta el punto de entrada
```

Las variables de entorno (API keys, etc.) van en un archivo `.env` dentro de `backend/`; no se suben al repositorio.
