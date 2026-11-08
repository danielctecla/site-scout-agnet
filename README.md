# Business Management

MVP de una aplicación para que dueños de negocio (o quienes planean abrir uno) creen una cuenta y registren su negocio.

Incluye autenticación, onboarding de información personal y del negocio, y acceso protegido al dashboard.

La aplicación corre **solo en tu computadora** (`http://localhost:3000`) y no se despliega. Un único proyecto de Supabase es el backend y el único servicio remoto (ver [docs/architecture.md §11](docs/architecture.md)).

## Stack

- Next.js 16 (App Router) + TypeScript estricto + Tailwind CSS 4
- Supabase Auth y PostgreSQL con Row Level Security
- Vitest, pgTAP y Playwright
- GitHub Actions solo para checks (no despliega y no tiene credenciales de Supabase)

## Estructura

```
.
├── app/                     # Next.js App Router
├── scripts/                 # Utilidades de desarrollo (escáner de secretos)
├── supabase/
│   ├── config.toml          # Configuración del stack local y de Auth
│   ├── migrations/          # Migraciones SQL versionadas
│   └── tests/
│       ├── database/        # Pruebas pgTAP (*.test.sql)
│       └── helpers/         # Setup compartido de pgTAP
├── docs/                    # Requisitos, especificación, arquitectura, base de datos y tareas
├── .githooks/               # Hook pre-commit (bloquea secretos)
├── .github/workflows/       # CI
└── .env.example             # Variables de entorno, sin valores reales
```

## Requisitos

- Node.js 22 (ver `.nvmrc`)
- Docker, para el stack local de pruebas de Supabase
- Acceso al proyecto de Supabase

El CLI de Supabase se instala con el proyecto (`npx supabase …`); no hace falta instalarlo globalmente.

## Configuración inicial

```bash
npm install                      # también activa el hook pre-commit
cp .env.example .env.local       # y completa los dos valores (ver abajo)
```

`.env.local` está ignorado por Git y solo lleva dos valores, que están en el dashboard de Supabase (Project Settings → API Keys / Data API):

- `NEXT_PUBLIC_SUPABASE_URL`: `https://<project-ref>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: la clave publicable (`sb_publishable_…`)

Nunca pongas en un archivo `.env` la clave secreta, la `service_role`, la contraseña de la base de datos ni un access token. Si alguno llega a Git, rótalo en el dashboard: borrarlo del historial no basta.

### Vincular el proyecto de Supabase (una vez)

```bash
npx supabase login                                   # guarda tu token fuera del repo
npx supabase link --project-ref <project-ref>        # pide la contraseña de la base; no se guarda en el repo
npx supabase config diff                             # revisa qué cambiaría en el proyecto
npx supabase config push                             # aplica la config de Auth (pide confirmación por cambio)
```

`config push` aplica al proyecto lo declarado en `supabase/config.toml`: Site URL `http://localhost:3000`, URLs de redirección, contraseña mínima de 8 caracteres y sin confirmación de correo. Los correos usan la plantilla por defecto de Supabase.

## Desarrollo

```bash
npm run dev        # http://localhost:3000, contra tu proyecto de Supabase
npm run check      # secretos, lint, tipos, formato y pruebas unitarias
npm run build      # verificación de build (no se despliega nada)
```

## Stack local de pruebas

Las pruebas automáticas corren **solo** contra una copia local y desechable de Supabase en Docker, nunca contra el proyecto real.

```bash
npm run db:start   # levanta Postgres, Auth, API, Mailpit y Studio
npm run db:reset   # recrea la base local desde las migraciones
npm run db:test    # corre las pruebas pgTAP
npm run db:stop    # detiene el stack
```

- Studio local: http://127.0.0.1:54323
- Mailpit (correos de prueba; no se envían de verdad): http://127.0.0.1:54324

Si `docker` apunta a Docker Desktop y no está abierto, usa el daemon del sistema: `export DOCKER_HOST=unix:///var/run/docker.sock` (o `docker context use default`).

## Flujo de migraciones

1. `npx supabase migration new <nombre>` y escribe primero sus pruebas pgTAP.
2. `npm run db:reset && npm run db:test` hasta que todo pase.
3. Haz commit de la migración y sus pruebas.
4. Si el proyecto ya tiene datos, haz un respaldo con `npx supabase db dump` y guárdalo fuera del repo.
5. `npx supabase db push --linked --dry-run`, revisa, y luego `npx supabase db push --linked`. Pasa siempre `--linked`: la próxima versión mayor del CLI apuntará a la base local por defecto.
6. `npx supabase migration list` para confirmar que local y remoto coinciden.

Nunca:

- `supabase db reset --linked` (borra el proyecto) ni `supabase test db --linked` (las pruebas crean y alteran datos).
- Cambiar el esquema desde el dashboard (SQL Editor, Table Editor) u otras herramientas.
- Editar una migración que ya se aplicó.

## Documentación

Empieza por [docs/requirements.md](docs/requirements.md) y sigue el plan en [docs/tasks.md](docs/tasks.md).
