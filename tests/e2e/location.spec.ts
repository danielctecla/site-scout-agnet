import { expect, test } from "@playwright/test";

// TASK-035: onboarding → form → DENUE (local fake) → Claude Code (real, local
// login) → results → detail → comparison → chat; plus the insufficient-data
// error. Runs in Spanish.
test.setTimeout(240_000);

test("a user evaluates a location and asks the agent", async ({ page }) => {
  await page.goto("/register");
  await page
    .getByLabel("Correo electrónico")
    .fill(`e2e-loc-${Date.now()}@example.com`);
  await page.getByLabel("Contraseña", { exact: true }).fill("e2e-password-123");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByLabel("Nombre completo").fill("Ana Pérez");
  await page.getByLabel("Fecha de nacimiento").fill("1990-05-20");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByLabel("Nombre del negocio").fill("Café Aurora");
  await page
    .getByLabel("Industria", { exact: true })
    .selectOption("food_beverage");
  await page.getByText("Sí, ya tengo uno").click();
  await page.getByRole("button", { name: "Terminar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: "Evaluar una ubicación" }).click();
  await expect(page.getByText("Alimentos y bebidas")).toBeVisible();

  // Insufficient data: a message, and the form keeps its values.
  await page.getByLabel("Ubicación de referencia").fill("Sin datos");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByText("Sin datos, Sonora")).toBeVisible();
  await page.getByRole("button", { name: "Evaluar ubicación" }).click();
  await expect(page.getByText(/No hay datos suficientes/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();

  await page.getByLabel("Ubicación de referencia").fill("Roma");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByText("Roma Norte, Cuauhtémoc")).toBeVisible();
  await page.getByLabel("Renta mensual (opcional)").fill("25000");
  await page.getByRole("button", { name: "Reintentar" }).click();

  await expect(page).toHaveURL(/\/evaluations\/[0-9a-f-]{36}$/, {
    timeout: 120_000,
  });
  await expect(
    page.getByRole("heading", { name: "Zonas recomendadas" }),
  ).toBeVisible();
  await expect(page.getByText(/Fuente: INEGI DENUE/)).toBeVisible();

  await page.getByRole("link", { name: "Ver detalle" }).first().click();
  await expect(page.getByText("Puntuación de oportunidad")).toBeVisible();
  await expect(page.getByText("Por qué esta zona")).toBeVisible();
  await expect(page.getByText("Dato que ingresaste")).toBeVisible();

  await page.getByRole("link", { name: "Comparar" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Compara las zonas" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: /Volver a las recomendaciones/ })
    .click();

  const chat = page.getByRole("complementary", { name: "Pregunta al agente" });
  await chat
    .getByLabel("Pregunta")
    .fill("¿Cuál zona tiene la puntuación más alta?");
  await chat.getByRole("button", { name: "Enviar" }).click();
  await expect(chat.locator("p.bg-panel")).toHaveCount(1, { timeout: 60_000 });
});
