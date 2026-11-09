import { describe, expect, it } from "vitest";
import { searchPlaces } from "./geocode";

const respond = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

describe("searchPlaces", () => {
  it("maps Nominatim results", async () => {
    const places = await searchPlaces(
      "Álvaro Obregón",
      "es",
      respond([
        {
          name: "Avenida Álvaro Obregón",
          display_name: "Avenida Álvaro Obregón, Roma Norte, Ciudad de México",
          lat: "19.4187",
          lon: "-99.1569",
        },
      ]),
    );
    expect(places).toEqual([
      {
        name: "Avenida Álvaro Obregón",
        label: "Avenida Álvaro Obregón, Roma Norte, Ciudad de México",
        lat: 19.4187,
        lon: -99.1569,
      },
    ]);
  });

  it("reports no match and service failures separately", async () => {
    await expect(searchPlaces("zzz", "es", respond([]))).rejects.toMatchObject({
      key: "place_not_found",
    });
    await expect(
      searchPlaces("zzz", "es", respond({}, 503)),
    ).rejects.toMatchObject({ key: "geocoding_unavailable" });
  });
});
