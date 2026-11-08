import { expect, test } from "@playwright/test";

// Happy path (TASK-017): register → step 1 → step 2 → dashboard → logout →
// login. Runs in Spanish, the default language.
test("a new user registers, completes onboarding and signs in again", async ({
  page,
}) => {
  const email = `e2e-${Date.now()}@example.com`;
  const password = "e2e-password-123";

  await page.goto("/register");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

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
  await expect(
    page.getByRole("heading", { name: "Hola, Ana Pérez" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Café Aurora" }),
  ).toBeVisible();
  await expect(page.getByText("Alimentos y bebidas")).toBeVisible();
  await expect(page.getByText("Activo")).toBeVisible();

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Café Aurora" }),
  ).toBeVisible();
});
