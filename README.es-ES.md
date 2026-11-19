

<div align="center">
<h1>Proxy de filtrado de webhooks de GitHub</h1>

<i>Un proxy de filtrado de webhooks de GitHub sin servidor y fácil de configurar que retransmite o descarta eventos cuando coinciden con expresiones JSONPath configurables, impulsado por Cloudflare Workers.</i>

<a href="https://github.com/AlexTMjugador/GitHub-webhook-filter-proxy/actions?query=workflow%3ACI"><img
alt="CI workflow status" src="https://github.com/AlexTMjugador/GitHub-webhook-filter-proxy/actions/workflows/ci.yml/badge.svg"></a>
<a href="https://github.com/AlexTMjugador/GitHub-webhook-filter-proxy/actions?query=workflow%3A%22Deploy+to+Cloudflare+Workers%22"><img alt="Deploy workflow status" src="https://github.com/AlexTMjugador/GitHub-webhook-filter-proxy/actions/workflows/deploy.yml/badge.svg"></a>

</div>

- [💡 Antecedentes](#-background)
  - [Casos de uso](#use-cases)
- [✨ Inicio rápido](#-quickstart)
- [⚙️ Configuración](#️-configuration)
  - [`SECRET_TOKEN`](#secret_token)
  - [`TARGET_URL`](#target_url)
  - [`UNMATCHED_EVENT_ACTION`](#unmatched_event_action)
  - [`<EVENT NAME>_EVENT_MATCH_JSONPATH`](#event-name_event_match_jsonpath)
  - [`<EVENT NAME>_EVENT_MATCH_ACTION`](#event-name_event_match_action)
  - [Configuración mediante archivos](#configuration-via-files)
  - [Ejemplos](#examples)
- [❤️ Contribuir](#️-contributing)
- [🤝 Contacto](#-contact)
- [🧑‍🤝‍🧑 Colaboradores](#-contributors)

# 💡 Antecedentes

GitHub admite el envío de solicitudes HTTP POST a un servidor arbitrario en respuesta a eventos en la plataforma, conocidos como [_webhooks_](https://docs.github.com/en/developers/webhooks-and-events/webhooks/about-webhooks), para notificar a servicios externos sobre ellos. Son particularmente útiles para la integración con GitHub.

Sin embargo, aunque GitHub permite a los usuarios seleccionar qué tipos de eventos desencadenan un webhook, no ofrece ninguna funcionalidad para filtrar eventos por condiciones más detalladas. Por ejemplo, cuando un webhook se activa por un evento `push`, se activa para un `push` en cualquier rama, incluso si el servicio solo está interesado en una sola rama.

Este comportamiento puede ser indeseable: desperdicia tráfico para eventos que iban a ser ignorados, y varios servicios externos, que en algunos casos no están controlados por el usuario final, pueden no ofrecer funciones de filtrado, lo que desencadena acciones superfluas.

Este proyecto ofrece un proxy flexible y fácil de configurar que cualquiera puede usar para descartar eventos antes de que sean entregados al servicio externo real, como si nunca se hubieran activado. GitHub puede configurarse para entregar eventos a este proxy, que luego decide retransmitir el evento al servicio externo o descartarlo, según si el cuerpo JSON del evento coincide con una expresión JSONPath.

## Casos de uso

Este proxy es útil para tareas como:

- **Limitar qué pull requests y ramas envían notificaciones de chat en Discord o Slack**. ¡Elimine el spam de notificaciones causado por herramientas de automatización, como Dependabot o Renovate, y concéntrese en eventos valiosos!
- **Aplicar la autenticación del remitente de eventos**. [GitHub puede firmar las solicitudes de webhook con un secreto compartido](https://docs.github.com/en/developers/webhooks-and-events/webhooks/securing-your-webhooks), y este proxy espera y verifica esa firma. Tenga la seguridad de que cada evento retransmitido por este proxy proviene de GitHub.
- **Solucionar la falta de características de filtrado de eventos**. Desencadena implementaciones, integración continua y tareas similares solo para un subconjunto de eventos, incluso si el servicio externo no lo admite.
- **Reducir la carga en un servicio saturado**.

# ✨ Inicio rápido

La forma más fácil de comenzar es bifurcar este repositorio y desplegarlo en su cuenta de [Cloudflare](https://www.cloudflare.com). A continuación se proporcionan instrucciones paso a paso para hacerlo. Es gratis y ¡solo le tomará unos minutos!

1. Haga clic en el botón de abajo. Siga las instrucciones que aparezcan.

<p align="center">
<a href="https://deploy.workers.cloudflare.com/?url=https://github.com/AlexTMjugador/GitHub-webhook-filter-proxy"><img
alt="Deploy to Cloudflare Workers" src="https://deploy.workers.cloudflare.com/button"></a>
</p>

> **Nota**: Cloudflare le pedirá un token de API, que deberá crear si aún no tiene uno. La plantilla "Edit Cloudflare Workers" genera tokens de API adecuados para implementar este proxy.

2. Si todo sale bien, verá la siguiente pantalla y el worker se desplegará. Haga clic en el botón "Worker dash".

<p align="center">
<img alt="Cloudflare Workers deployment screen" src="https://i.imgur.com/19LOr21.png">
</p>

3. Vaya a la pestaña "Settings" del worker que acaba de implementar, en Workers › `github-webhook-filter-proxy`. Una vez allí, vaya a la sección "Variables" y agregue una nueva variable de entorno haciendo clic en "Add variable".

<p align="center">
<img alt="Worker variables screen" src="https://i.imgur.com/JMI5jXo.png">
</p>

4. Como habrá adivinado, el proxy se configura mediante variables de entorno. Por ahora, configuraremos tres variables de entorno:

- `SECRET_TOKEN`: una cadena aleatoria y única que solo GitHub y el proxy deben conocer, utilizada por el proxy para autenticar que los eventos provienen de GitHub. Algunas formas de generar este token incluyen ejecutar `echo "$(tr -dc _A-Z-a-z-0-9 < /dev/urandom | head -c32)"` en una terminal tipo Unix, o usar sitios web como [random.org](https://www.random.org/strings/?num=1&len=20&digits=on&upperalpha=on&loweralpha=on&unique=off&format=html&rnd=new). **¡Asegúrese de hacer clic en el botón "Encrypt" una vez que haya terminado de escribir el token!**
- `TARGET_URL`: la URL a la que el proxy retransmitirá los eventos que no descarte. Esta es la URL de su servicio destino (u otro proxy, si prefiere).
- `UNMATCHED_EVENT_ACTION`: la acción a realizar cuando no se configura una coincidencia de expresión JSONPath para un evento de entrada. El valor predeterminado es `drop`, así que configúrelo en `relay` para hacer que el proxy envíe todos los eventos que recibe a la URL de destino.

Antes de hacer clic en "Save" para aplicar los cambios, el formulario de edición debería verse así:

<p align="center">
<img alt="Worker variables edition form preview" src="https://i.imgur.com/efGyZXO.png">
</p>

5. En GitHub, vaya a la página de configuración de webhooks correspondiente. Establezca la URL de carga útil en la ruta de su worker, seleccione `application/json` como "Content type" y escriba el mismo secreto que en `SECRET_TOKEN`. Si está utilizando la ruta predeterminada `workers.dev`, puede (y debe) dejar habilitada la verificación SSL.

<p align="center">
<img alt="GitHub webhook configuration screen" src="https://i.imgur.com/NjGrdNL.png">
</p>

6. **¡El proxy está listo para funcionar!** 🎉 Si desea saber qué está pasando, consulte "Recent deliveries" en GitHub y los registros del worker en Cloudflare. La siguiente sección de este documento describe las variables de entorno que puede usar para configurar cómo filtra los eventos.

# ⚙️ Configuración

El proxy se puede configurar mediante las siguientes variables de entorno.

## `SECRET_TOKEN`

**Requerido**: sí

Un secreto aleatorio compartido por GitHub y el proxy que se utiliza para validar la firma digital que GitHub añade a la solicitud del evento del webhook.

El proxy espera y valida estas firmas, por lo que tanto GitHub como el proxy deben estar configurados con el mismo valor para este token.

## `TARGET_URL`

**Requerido**: sí

**Valores aceptados**: cualquier URL HTTP(S)

La URL a la que el proxy retransmitirá los eventos que no descarte. Esta es la URL del servicio que está siendo proxyado.

## `UNMATCHED_EVENT_ACTION`

**Requerido**: no

**Valores aceptados**: `relay` o `drop`

**Valor predeterminado**: `drop`

La acción a realizar cuando no se define una coincidencia de expresión JSONPath para un evento. `drop` descarta el evento, mientras que `relay` reenvía la solicitud a la URL de destino.

## `<EVENT NAME>_EVENT_MATCH_JSONPATH`

**Requerido**: no

**Valores aceptados**: una [expresión JSONPath](https://goessner.net/articles/JsonPath/), como una cadena

**Valor predeterminado**: no definido

La expresión JSONPath que se debe comparar con la carga útil JSON del evento para eventos `<EVENT NAME>`, donde `<EVENT NAME>` es el nombre de un evento de webhook [enumerado en la documentación de GitHub](https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads), convertido a mayúsculas.

Para la coincidencia, el objeto JSON del evento se coloca en una matriz de un solo elemento y luego la expresión JSONPath especificada se evalúa mediante el [paquete npm `jsonpath`](https://www.npmjs.com/package/jsonpath/v/1.1.1). Este envoltorio permite filtrar expresiones del operador de subíndice de JSONPath en las claves del objeto del evento.

Si se produce una coincidencia, el proxy retransmitirá o descartará el evento según lo definido por [`<EVENT NAME>_EVENT_MATCH_ACTION`](#event-name_event_match_action). Si la carga útil no coincide con la expresión JSONPath, el proxy tomará la acción opuesta a la que tomaría si coincidiera (descartar en lugar de retransmitir y viceversa).

## `<EVENT NAME>_EVENT_MATCH_ACTION`

**Requerido**: no

**Valores aceptados**: `relay` o `drop`

**Valor predeterminado**: `drop`

La acción a tomar cuando la expresión JSONPath definida por [`<EVENT NAME>_EVENT_MATCH_JSONPATH`](#event-name_event_match_jsonpath) coincide con la carga útil JSON del evento.

## Configuración mediante archivos

La guía de inicio rápido establece las variables de entorno del worker utilizando el panel web de Cloudflare. Sin embargo, también es posible configurarlas en el archivo `wrangler.toml`, que es el enfoque recomendado por Cloudflare.

La documentación de Cloudflare explica [cómo establecer variables de entorno de esta manera](https://developers.cloudflare.com/workers/platform/environment-variables/#environment-variables-via-wrangler) y describe [el formato del archivo `wrangler.toml`](https://developers.cloudflare.com/workers/wrangler/configuration). El [archivo `wrangler.toml` de este repositorio](https://github.com/AlexTMjugador/GitHub-webhook-filter-proxy/blob/master/wrangler.toml) contiene comentarios que ilustran cómo se haría.

## Ejemplos

Las siguientes variables de ejemplo configuran el proxy para retransmitir todo excepto los eventos push realizados por bots o en ramas gestionadas por [Renovate](https://github.com/renovatebot/renovate).

- `PUSH_EVENT_MATCH_JSONPATH`: `$[?(@.ref.startsWith('refs/heads/renovate/') || @.sender.login == 'github-actions[bot]')]`
- `PUSH_EVENT_MATCH_ACTION` (opcional): `drop`
- `UNMATCHED_EVENT_ACTION`: `relay`

# ❤️ Contribuir

Se aceptan solicitudes de extracción (pull requests). ¡No dude en contribuir si puede mejorar algún aspecto del proyecto!

Las contribuciones incluyen, pero no se limitan a:

- Escribir buenos informes de errores o solicitudes de funciones.
- Enviar un PR con cambios de código que implementen una mejora o corrijan un problema.
- Recomendar el proyecto a otros y participar en la comunidad.
- Apoyar económicamente el proyecto (consulte el botón "Sponsor" en la página de GitHub).

Las contribuciones de código deben pasar las verificaciones de CI y ser consideradas de suficiente calidad por un mantenedor del repositorio para ser fusionadas.

Los artefactos de código fuente del proxy están estructurados como un proyecto estándar de `npm`, codificado en TypeScript. La herramienta de línea de comandos [Wrangler](https://developers.cloudflare.com/workers/wrangler/get-started/) se utiliza para el desarrollo y la implementación. Después del primer `npm install`, `npm run start` iniciará el worker en un servidor local para desarrollo. Antes de confirmar cualquier cambio, debe ejecutar ESlint y Prettier con `npm run lint` y `npm run format`, respectivamente.

# 🤝 Contacto

Damos la bienvenida a conversaciones amigables sobre el proyecto, incluidas preguntas, felicitaciones y sugerencias. Visite la [página de Discusiones de GitHub](https://github.com/AlexTMjugador/GitHub-webhook-filter-proxy/discussions) para interactuar con otros usuarios, colaboradores y desarrolladores.

# 🧑‍🤝‍🧑 Colaboradores

Las gracias van a estas maravillosas personas ([clave de emojis](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/AlexTMjugador"><img src="https://avatars.githubusercontent.com/u/7822554?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Alejandro González</b></sub></a><br /><a href="https://github.com/AlexTMjugador/GitHub-webhook-filter-proxy/commits?author=AlexTMjugador" title="Code">💻</a> <a href="https://github.com/AlexTMjugador/GitHub-webhook-filter-proxy/commits?author=AlexTMjugador" title="Documentation">📖</a> <a href="#maintenance-AlexTMjugador" title="Maintenance">🚧</a> <a href="#projectManagement-AlexTMjugador" title="Project Management">📆</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

Este proyecto sigue la especificación [all-contributors](https://github.com/all-contributors/all-contributors). ¡Se aceptan contribuciones de todo tipo!
