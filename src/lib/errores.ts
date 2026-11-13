/** Error "esperado" (falta un archivo, plan mal armado...). La CLI lo muestra sin stack trace. */
export class ErrorReel extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorReel";
  }
}
