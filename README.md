# Site Scout Agent

Monorepo con el backend (agente de IA para inteligencia de ubicaciones) y el frontend.

## Estructura

```
.
├── backend/    # Agente en Python (LangGraph + LangChain), gestionado con uv
└── frontend/   # Interfaz web
```

## Backend

```bash
cd backend
uv sync
uv run ai-location-intelligence
```

Más detalles en [backend/README.md](backend/README.md).

## Frontend

Ver [frontend/README.md](frontend/README.md).
