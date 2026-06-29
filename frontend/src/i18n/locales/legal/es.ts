const LEGAL_ES = {
  lastUpdated: "Última actualización: 12 de junio de 2026",
  editor: "All My Costs",
  contact: "dev@retro-spare.fr",
  country: "France",
  openMailto: "Contáctenos por correo electrónico",
  aboutSection: "ACERCA DE",
  privacyTitle: "Política de privacidad",
  termsTitle: "Términos de servicio",
  privacy: {
    intro: "Esta política explica cómo All My Costs recopila, utiliza y protege tus datos.",
    sections: [
      { title: "1. Editor", body: "All My Costs es publicada por All My Costs. Contacto: dev@retro-spare.fr." },
      { title: "2. Datos recopilados", body: "Gratuito: hasta 6 gastos en total (recurrentes y puntuales combinados), total mensual/anual, divisa base. Pro (3,99 € pago único): gastos ilimitados, estadísticas, exportación PDF, categorías ilimitadas, escaneo de tickets por IA, almacenamiento y uso compartido de fotos de tickets." },
      { title: "3. Datos locales", body: "Todos tus gastos recurrentes, gastos puntuales, fotos de tickets e ingresos se almacenan exclusivamente de forma local en tu dispositivo y nunca se envían a nuestros servidores, salvo el texto descrito en el artículo 4." },
      { title: "4. Escaneo de tickets por IA (función Pro)", body: "Al escanear un ticket, el texto se extrae directamente en tu dispositivo (reconocimiento de texto local, sin conexión). Solo este texto, nunca la foto en si, se envía a un servicio de IA de terceros (Anthropic) para extraer el nombre del comercio, el importe y la fecha. La foto del ticket permanece almacenada únicamente en tu dispositivo." },
      { title: "5. Uso de datos", body: "Usamos tus datos solo para: crear y proteger tu cuenta, gestionar tu acceso Pro, responder solicitudes de soporte, y estructurar el texto de los tickets escaneados (función Pro)." },
      { title: "6. Servicios de terceros", body: "All My Costs usa: RevenueCat (compras Pro), Google Play (pagos), open.er-api.com (tipos de cambio), Anthropic (estructuración del texto de tickets escaneados, función Pro)." },
      { title: "7. Conservación", body: "Cuenta Firebase conservada mientras esté activa; eliminada a petición. Datos locales (incluidas fotos de tickets) eliminados al desinstalar. El texto enviado para el escaneo no es conservado por nosotros mas alla del procesamiento inmediato." },
      { title: "8. Tus derechos (RGPD)", body: "Acceso, rectificación, supresión, portabilidad, oposición. Contacto: dev@retro-spare.fr." },
      { title: "9. Seguridad", body: "Autenticación vía Firebase. Todas las comunicaciones cifradas HTTPS/TLS, incluido el escaneo de tickets." },
      { title: "10. Menores", body: "Aplicación no destinada a menores de 13 años." },
      { title: "11. Contacto", body: "dev@retro-spare.fr" }
    ]
  },
  terms: {
    intro: "Estos Términos rigen el uso de la aplicación All My Costs.",
    sections: [
      { title: "1. Aceptación", body: "Al usar la Aplicación, aceptas estos Términos." },
      { title: "2. Versión gratuita y Pro", body: "Gratuito: hasta 6 gastos en total (recurrentes y puntuales combinados), total mensual/anual, divisa base. Pro (3,99 € pago único): gastos ilimitados, estadísticas, exportación PDF, categorías ilimitadas, escaneo de tickets por IA, almacenamiento y uso compartido de fotos de tickets." },
      { title: "3. Prueba gratuita de 15 días", body: "Al iniciar sesión por primera vez, cada usuario obtiene una prueba gratuita de 15 días con acceso Pro completo." },
      { title: "4. Compra única Pro", body: "El acceso Pro está disponible mediante un pago único de 3,99 € en Google Play. Sin suscripción ni cargos recurrentes." },
      { title: "5. Restaurar compras", body: "Usa el botón Restaurar compras en ajustes con la misma cuenta de Google Play." },
      { title: "6. Reembolsos", body: "Los reembolsos son gestionados por Google Play según su política." },
      { title: "7. Uso aceptable", body: "No eludir limitaciones, hacer ingeniería inversa ni usar la Aplicación ilegalmente." },
      { title: "8. Propiedad intelectual", body: "La Aplicación y su contenido son propiedad exclusiva de All My Costs." },
      { title: "9. Limitación de responsabilidad", body: "Aplicación proporcionada tal cual. Sin responsabilidad por pérdida de datos locales o decisiones financieras." },
      { title: "10. Contacto", body: "dev@retro-spare.fr" }
    ]
  }
};
export default LEGAL_ES;
