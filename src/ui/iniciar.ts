// Punto de entrada de la app: npm run ui
// Levanta el servidor y abre la app en el navegador.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { APP } from "../config.js";
import { cargarEnv, expandirCasa } from "../lib/entorno.js";
import { crearServidor } from "./servidor.js";

cargarEnv();
const carpetaReels = expandirCasa(process.env.REELS_DIR ?? APP.carpetaReels);
mkdirSync(carpetaReels, { recursive: true });
const puerto = Number(process.env.PORT) || APP.puerto;
const direccion = `http://localhost:${puerto}`;
const abrirNavegador = () => {
  if (process.argv.includes("--sin-abrir") || process.platform !== "darwin") return;
  spawn("open", [direccion], { stdio: "ignore" });
};

// "localhost" puede ser 127.0.0.1 o ::1 según la compu: se escucha en los dos (y en nada más, así no se ve desde otras compus)
const principal = crearServidor({ carpetaReels });
principal.on("error", (e: NodeJS.ErrnoException) => {
  if (e.code === "EADDRINUSE") {
    console.log(`La app ya está abierta (o algo más usa el puerto ${puerto}). Abrila en ${direccion}`);
    abrirNavegador();
  } else {
    console.error(e);
  }
});
principal.listen(puerto, "127.0.0.1", () => {
  const ipv6 = crearServidor({ carpetaReels });
  ipv6.on("error", () => {}); // Si la compu no tiene IPv6, alcanza con el otro
  ipv6.listen(puerto, "::1");
  console.log(`La app está en ${direccion}`);
  console.log(`Tus reels se guardan en ${carpetaReels}`);
  console.log("Para cerrarla, apretá Ctrl+C acá.");
  abrirNavegador();
});
