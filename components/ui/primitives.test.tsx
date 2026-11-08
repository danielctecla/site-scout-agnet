import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "./button";
import { ProgressSteps } from "./progress-steps";
import { RadioCards } from "./radio-cards";
import { SelectField } from "./select-field";
import { StatusBadge } from "./status-badge";
import { TextField } from "./text-field";

// Accessible names and states of the design-system primitives (TASK-020).
const html = (node: React.ReactNode) => renderToStaticMarkup(node);

describe("TextField", () => {
  it("labels the input and describes it with the hint", () => {
    const markup = html(
      <TextField
        id="birth-date"
        label="Fecha de nacimiento"
        hint="Entre 16 y 100 años."
        type="date"
      />,
    );
    expect(markup).toContain('<label for="birth-date"');
    expect(markup).toContain('aria-describedby="birth-date-hint"');
    expect(markup).toContain('id="birth-date-hint"');
    expect(markup).not.toContain("aria-invalid");
  });

  it("marks the input invalid and points to the error instead of the hint", () => {
    const markup = html(
      <TextField
        id="name"
        label="Nombre completo"
        hint="Hint"
        error="Escribe tu nombre."
      />,
    );
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('aria-describedby="name-error"');
    expect(markup).toContain('id="name-error"');
    expect(markup).toContain("Escribe tu nombre.");
    expect(markup).not.toContain("name-hint");
  });
});

describe("SelectField", () => {
  it("renders an empty first option so nothing is preselected", () => {
    const markup = html(
      <SelectField
        id="industry"
        label="Industria"
        placeholder="Selecciona una industria"
        options={[{ value: "retail", label: "Comercio minorista" }]}
        error="Elige una industria."
      />,
    );
    expect(markup).toContain('<label for="industry"');
    expect(markup).toMatch(
      /<option value="">Selecciona una industria<\/option>/,
    );
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('aria-describedby="industry-error"');
  });
});

describe("RadioCards", () => {
  const options = [
    { value: "yes", label: "Sí, ya tengo uno" },
    { value: "no", label: "Todavía no" },
  ];

  it("groups the choices under a legend with none selected by default", () => {
    const markup = html(
      <RadioCards
        name="establishment"
        legend="¿Tiene local?"
        options={options}
      />,
    );
    expect(markup).toContain("<legend");
    expect(markup.match(/type="radio"/g)).toHaveLength(2);
    expect(markup).not.toContain('checked=""');
  });

  it("describes the group with its error", () => {
    const markup = html(
      <RadioCards
        name="establishment"
        legend="¿Tiene local?"
        options={options}
        value=""
        error="Elige una opción."
      />,
    );
    expect(markup).toContain('aria-describedby="establishment-error"');
    expect(markup).toContain('id="establishment-error"');
  });
});

describe("Button", () => {
  it("is disabled and busy while pending", () => {
    const markup = html(<Button pending>Guardando…</Button>);
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("disabled");
    expect(markup).toContain('type="button"');
  });
});

describe("ProgressSteps", () => {
  it("exposes the current step to assistive technology", () => {
    const markup = html(
      <ProgressSteps
        current={1}
        total={2}
        label="Paso 1 de 2"
        name="Progreso"
      />,
    );
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuenow="1"');
    expect(markup).toContain('aria-valuemax="2"');
    expect(markup).toContain('aria-valuetext="Paso 1 de 2"');
  });
});

describe("StatusBadge", () => {
  it("shows the translated label for each status", () => {
    expect(
      html(<StatusBadge status="planning" label="En planeación" />),
    ).toContain("En planeación");
    expect(html(<StatusBadge status="active" label="Activo" />)).toContain(
      "text-active",
    );
  });
});
