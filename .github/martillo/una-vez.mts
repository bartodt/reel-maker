import { render } from "../../src/pasos/render.js";
import { DURACION_VOZ, PLAN_VALIDO, crearProyectoDePrueba, escribirPlan } from "../../test/lib/fixtures.js";

const modo = process.argv[2];
const p = await crearProyectoDePrueba({ conMusica: modo === "musica" });
escribirPlan(
  p.raiz,
  modo === "gancho"
    ? {
        subtitulos: false,
        tramos: [
          { duracion: 1, clip: "vertical.mov", arrancaEn: 0, texto: "HOLA\nPRUEBA" },
          { desde: 0, hasta: 2.5, clip: "horizontal.mp4", arrancaEn: 0, velocidad: 2 },
          { duracion: 1.5, clip: "con-audio.mp4", arrancaEn: 1, audioDelClip: true },
          { desde: 2.5, hasta: DURACION_VOZ, clip: "vertical.mov", arrancaEn: 0.2 },
          { duracion: 1, clip: "vertical.mov", arrancaEn: 3.9, velocidad: 0, logo: true },
        ],
      }
    : PLAN_VALIDO,
);
await render(p, () => {});
