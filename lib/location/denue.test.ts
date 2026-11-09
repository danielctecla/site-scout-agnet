import { describe, expect, it } from "vitest";
import fixture from "./fixtures/denue-buscar.json";
import { fetchEstablishments, parseEstablishments } from "./denue";

describe("parseEstablishments", () => {
  const parsed = parseEstablishments(fixture);

  it("maps a DENUE record", () => {
    expect(parsed[0]).toEqual({
      id: "6846393",
      name: "TACOS EL GÜERO",
      activity: "Restaurantes con servicio de preparación de tacos y tortas",
      scian: "722514",
      address: "CALLE ORIZABA 101, ROMA NORTE, 06700",
      colonia: "ROMA NORTE",
      street: "CALLE ORIZABA",
      lat: 19.4194,
      lon: -99.1617,
      staffMin: 0,
      staffLabel: "0 a 5 personas",
    });
  });

  it("reads the staff lower bound, including the open range", () => {
    expect(parsed.map((e) => e.staffMin)).toEqual([0, 251, null]);
  });

  it("skips records with invalid coordinates", () => {
    expect(parsed.map((e) => e.id)).not.toContain("4");
  });

  it("never keeps contact fields", () => {
    expect(JSON.stringify(parsed)).not.toMatch(/55 1234|@|www\./);
  });

  it("does not repeat the road type already in the street name", () => {
    const [e] = parseEstablishments([
      {
        ...fixture[0],
        Tipo_vialidad: "AVENIDA",
        Calle: "AVENIDA DE LAS NACIONES",
      },
    ]);
    expect(e.street).toBe("AVENIDA DE LAS NACIONES");
  });

  it("leaves the SCIAN class empty when the CLEE is malformed", () => {
    expect(parsed[2].scian).toBeNull();
  });
});

describe("fetchEstablishments", () => {
  const point = { lat: 19.4194, lon: -99.1617, radiusM: 1300 };
  const respond = (body: string, status = 200) =>
    (async () => new Response(body, { status })) as typeof fetch;

  it("requests every establishment within the radius", async () => {
    let url = "";
    const spy = (async (input: string | URL | Request) => {
      url = String(input);
      return new Response("[]");
    }) as typeof fetch;
    await fetchEstablishments(point, { token: "t0k", fetch: spy });
    expect(url).toBe(
      "https://www.inegi.org.mx/app/api/denue/v1/consulta/Buscar/todos/19.4194,-99.1617/1300/t0k",
    );
  });

  it("maps an unauthorized token, an HTTP error and a non-JSON body to denue_unavailable", async () => {
    for (const f of [
      respond("No Autorizado, utilice una clave valida."),
      respond("[]", 500),
      respond("<html>"),
      (async () => {
        throw new TypeError("fetch failed");
      }) as typeof fetch,
    ]) {
      await expect(
        fetchEstablishments(point, { token: "t", fetch: f }),
      ).rejects.toMatchObject({ key: "denue_unavailable" });
    }
  });
});
