// Local stand-ins for DENUE and Nominatim during the end-to-end test
// (architecture.md §15). Never used by `npm run dev`.
import { createServer } from "node:http";

const M = 111_195;
const PLACES = [
  {
    name: "Roma Norte",
    display_name: "Roma Norte, Cuauhtémoc, Ciudad de México",
    lat: "19.4194",
    lon: "-99.1617",
  },
  // DENUE returns nothing here: the insufficient-data path.
  {
    name: "Sin datos",
    display_name: "Sin datos, Sonora",
    lat: "29.5",
    lon: "-112.5",
  },
];

// Three clusters 600 m from the point, each with restaurants (722511),
// groceries (461110) and offices (541110).
function establishments(lat, lon) {
  if (Math.abs(lat - 29.5) < 0.01) return [];
  const rows = [];
  [
    [600, 0],
    [-600, 0],
    [0, 600],
  ].forEach(([north, east], c) => {
    for (let i = 0; i < 18; i += 1) {
      const scian = i < 4 + c * 3 ? "722511" : i < 12 ? "461110" : "541110";
      rows.push({
        CLEE: `09015${scian}0000${c}${String(i).padStart(2, "0")}000000000U5`,
        Id: `${c + 1}${String(i).padStart(3, "0")}`,
        Nombre: `NEGOCIO ${c + 1}-${i + 1}`,
        Clase_actividad:
          scian === "722511"
            ? "Restaurantes con servicio completo"
            : scian === "461110"
              ? "Comercio al por menor en tiendas de abarrotes"
              : "Bufetes jurídicos",
        Estrato: i % 3 === 0 ? "6 a 10 personas" : "0 a 5 personas",
        Tipo_vialidad: "CALLE",
        Calle: ["COLIMA", "MEDELLÍN", "LONDRES"][c],
        Num_Exterior: String(10 + i),
        Colonia: ["ROMA NORTE", "ROMA SUR", "JUÁREZ"][c],
        CP: "06700",
        Latitud: String(lat + (north + (i % 6) * 20) / M),
        Longitud: String(
          lon +
            (east + Math.floor(i / 6) * 20) /
              (M * Math.cos((lat * Math.PI) / 180)),
        ),
      });
    }
  });
  return rows;
}

createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  res.setHeader("Content-Type", "application/json");
  if (url.pathname === "/search") {
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    return res.end(
      JSON.stringify(PLACES.filter((p) => p.name.toLowerCase().includes(q))),
    );
  }
  // /denue/Buscar/todos/{lat},{lon}/{meters}/{token}
  const match = url.pathname.match(
    /^\/denue\/Buscar\/todos\/([-\d.]+),([-\d.]+)\//,
  );
  if (match)
    return res.end(
      JSON.stringify(establishments(Number(match[1]), Number(match[2]))),
    );
  res.statusCode = 404;
  res.end("[]");
}).listen(3199);
