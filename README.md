# MiNegocio Al Día

PROMPT 1 — CREACIÓN INICIAL DE “MI NEGOCIO AL DÍA”

Quiero crear desde cero una aplicación SaaS chilena llamada provisionalmente:

Mi Negocio al Día

Subtítulo:

Controla tus ventas, anticipa tus impuestos y toma mejores decisiones durante el mes.

La aplicación estará dirigida a microempresarios y pequeños empresarios chilenos, como almacenes, minimarkets, ferreterías, peluquerías, talleres, restaurantes pequeños, prestadores de servicios y otros negocios que utilizan el SII y cuentan con un contador, pero necesitan saber durante el mes cómo va su negocio.

El problema que debe resolver es el siguiente:

El pequeño empresario normalmente no sabe cuánto vendió, cuánto debería reservar para IVA y otros impuestos ni cómo va respecto de su meta mensual, por lo que debe llamar frecuentemente a su contador.

La aplicación no reemplaza al contador. Su objetivo es mostrar información sencilla, entendible y aproximada durante el mes.

En esta primera etapa utiliza únicamente datos demostrativos. No conectes todavía API Gateway, el SII ni ningún servicio externo real.

1. OBJETIVO PRINCIPAL

Cuando el empresario ingrese, debe poder responder en pocos segundos:

¿Cuánto he vendido este mes?

¿Cuánto he facturado?

¿Cuánto vendí mediante boletas?

¿Cuánto he comprado?

¿Cuánto IVA estoy generando aproximadamente?

¿Tengo remanente de IVA?

¿Cuánto podría pagar de PPM?

¿Cuánto tengo aproximadamente en retenciones?

¿Cuánto dinero debería dejar reservado?

¿Cuánto me falta para alcanzar mi meta de ventas?

¿Cómo voy respecto del mes anterior?

¿Cuánto podría vender al finalizar el mes?

La aplicación debe funcionar principalmente como un visor informativo.

El empresario no debe tener que:

Descargar archivos.

Subir documentos.

Ingresar facturas manualmente.

Clasificar compras.

Declarar impuestos.

Emitir documentos tributarios.

Conocer códigos del Formulario 29.

Realizar cálculos tributarios.

Modificar información del SII.

2. ALCANCE DE ESTA PRIMERA ETAPA

En esta etapa debes construir una demostración funcional completa con datos ficticios.

Debe incluir:

Todas las pantallas principales.

Navegación funcional.

Datos demostrativos realistas.

Cálculos automáticos.

Metas de ventas.

Proyecciones.

Simuladores.

Comparaciones mensuales.

Estados de conexión simulados.

Diseño responsive.

Experiencia móvil.

Estados de carga.

Estados vacíos.

Mensajes de error.

Botones funcionales.

No debe incluir todavía:

Conexión real con el SII.

API Gateway.

Clave Tributaria.

ClaveÚnica.

Credenciales reales.

Pagos.

Suscripciones.

Declaraciones de impuestos.

Emisión de facturas.

Modificación de documentos tributarios.

3. TECNOLOGÍA Y ARQUITECTURA

Construye la aplicación utilizando:

React.

TypeScript.

Componentes reutilizables.

Arquitectura modular.

Diseño responsive.

Buen manejo de estados.

Tipado completo.

Separación entre datos y componentes visuales.

Organiza el código en una estructura similar a:

src/
  components/
    dashboard/
    sales/
    purchases/
    taxes/
    goals/
    projections/
    shared/
  hooks/
  pages/
  services/
  types/
  utils/
  data/


Crear archivos similares a:

types/tax.ts
types/company.ts
services/taxDataService.ts
services/mockTaxDataService.ts
hooks/useTaxDashboard.ts
data/mockTaxData.ts
utils/taxCalculations.ts
utils/currency.ts


No escribir los datos demostrativos directamente dentro de los componentes.

Crear una interfaz de servicio para que posteriormente sea posible sustituir:

mockTaxDataService


por:

cloudTaxDataService


sin tener que reconstruir toda la interfaz.

4. MODELOS DE DATOS

Crear interfaces TypeScript para:

Empresa

id

rut

razonSocial

nombreFantasia

actividad

estadoConexionSii

ultimaSincronizacion

periodoActivo

Resumen mensual

ventasTotales

ventasFacturas

ventasBoletas

ventasExentas

notasCreditoVentas

comprasTotales

comprasNetas

comprasExentas

ivaDebito

ivaCredito

remanenteAnterior

ivaEstimado

nuevoRemanente

ppmEstimado

retencionesEstimadas

totalTributarioEstimado

margenPreventivo

reservaRecomendada

dineroReservado

Meta comercial

metaMensual

ventasAcumuladas

porcentajeCumplimiento

montoFaltante

diasRestantes

promedioDiarioNecesario

proyeccionCierre

Documento tributario

id

fecha

tipoDocumento

folio

contraparte

rutContraparte

neto

iva

exento

total

estado

periodo

Comparación mensual

periodoActual

periodoAnterior

variacionVentas

variacionCompras

variacionIva

ticketPromedio

cantidadFacturas

cantidadBoletas

mejorDia

mejorSemana

Estado de conexión

Usar exactamente estos estados:

disconnected
connecting
connected
stale
error


5. PRINCIPIOS DE DISEÑO

La aplicación debe ser:

Moderna.

Profesional.

Clara.

Amable.

Simple.

Fácil de entender.

Especialmente cómoda en celular.

Utilizar:

Fondo claro.

Tarjetas blancas.

Bordes suaves.

Sombras discretas.

Esquinas redondeadas.

Tipografía grande y legible.

Íconos simples.

Espacios amplios.

Números importantes destacados.

Paleta recomendada:

Azul principal: #2563EB.

Azul oscuro o slate para textos.

Verde para estados saludables.

Ámbar para advertencias.

Rojo solamente para situaciones importantes.

Gris suave para fondos secundarios.

No utilizar:

Exceso de gráficos.

Tablas gigantes.

Fondos oscuros completos.

Colores infantiles.

Lenguaje contable innecesariamente complejo.

Textos demasiado pequeños.

Menús saturados.

Elementos decorativos sin función.

No debe existir desplazamiento horizontal en teléfonos.

6. NAVEGACIÓN

Crear las siguientes páginas:

Inicio.

Ventas.

Compras.

Impuestos.

Metas.

Configuración.

En escritorio utilizar barra lateral o navegación superior.

En móvil utilizar navegación inferior con acceso prioritario a:

Inicio.

Movimientos.

Metas.

Configuración.

La sección “Movimientos” puede permitir acceder a ventas y compras.

Agregar en el encabezado:

Selector de empresa.

Selector de periodo.

Estado de actualización.

Botón de actualización.

Perfil del usuario.

Periodos demostrativos:

Julio 2026.

Junio 2026.

Mayo 2026.

Empresa demostrativa:

Comercial Los Vilos SpA

RUT ficticio:

76.123.456-7

Mostrar siempre una etiqueta visible:

Datos demostrativos.

7. PÁGINA DE INICIO

La pantalla principal debe responder:

¿Cómo va mi negocio este mes?

Encabezado:

Saludo.

Nombre de la empresa.

Periodo seleccionado.

Fecha y hora de última actualización.

Estado de conexión.

Botón “Actualizar”.

Etiqueta “Datos demostrativos”.

El botón “Actualizar” debe funcionar visualmente.

Al pulsarlo:

Mostrar estado de carga.

Cambiar el texto a “Actualizando”.

Simular una espera breve.

Actualizar la fecha y hora.

Mostrar una notificación de éxito.

No realizar llamadas externas reales.

8. TARJETA PRINCIPAL: RESERVA RECOMENDADA

La tarjeta más importante del dashboard debe mostrar:

Reserva recomendada

Ejemplo:

$936.000

Texto:

Procura mantener este monto separado para cubrir tus impuestos estimados del mes.

Mostrar un desglose:

Total tributario estimado.

Margen preventivo.

Reserva recomendada.

Dinero que el usuario ya tiene reservado.

Diferencia pendiente.

Ejemplo:

Impuestos estimados: $850.000
Margen preventivo: $86.000
Reserva recomendada: $936.000
Ya tienes reservado: $700.000
Te faltan por reservar: $236.000


Crear un semáforo:

Verde

Tu reserva cubre la estimación actual.

Ámbar

Estás cerca, pero todavía falta una parte.

Rojo

Conviene reservar dinero adicional para evitar sorpresas al cierre.

Permitir editar únicamente:

Ya tengo reservado.

Guardar el valor en el estado local de la demostración.

9. INDICADORES PRINCIPALES

Crear tarjetas para:

Ventas totales

Ejemplo:

$8.450.000

Descripción:

Total registrado durante el mes.

Facturado

Ejemplo:

$5.600.000

Descripción:

Ventas respaldadas mediante facturas.

Ventas con boleta

Ejemplo:

$2.850.000

Descripción:

Boletas y resúmenes de venta registrados.

Compras

Ejemplo:

$3.400.000

Descripción:

Compras consideradas durante el periodo.

Cada tarjeta debe mostrar una comparación con el mes anterior:

+14%.

−6%.

Sin variación.

Sin información comparable.

No considerar automáticamente que un aumento de compras es negativo. Mostrar contexto.

10. RESUMEN TRIBUTARIO

Crear una sección llamada:

Estimación tributaria del mes

Mostrar:

IVA débito por ventas.

IVA crédito por compras.

Remanente anterior.

IVA estimado por pagar.

Nuevo remanente estimado.

PPM estimado.

Retenciones estimadas.

Total tributario estimado.

Margen preventivo.

Reserva recomendada.

Datos demostrativos sugeridos:

IVA débito: $1.349.160
IVA crédito: −$542.857
Remanente anterior: −$120.000
IVA estimado: $686.303
PPM estimado: $42.250
Retenciones estimadas: $80.000
Total tributario estimado: $808.553
Margen preventivo: $80.855
Reserva recomendada: $889.408


No escribir estos resultados manualmente en la interfaz.

Deben calcularse utilizando las funciones de:

utils/taxCalculations.ts


Crear un bloque desplegable con una explicación sencilla:

El IVA estimado considera el IVA de las ventas, el crédito disponible de compras y el remanente registrado. El PPM y las retenciones se muestran por separado. El resultado definitivo puede variar cuando tu contador prepare el Formulario 29.

Mostrar siempre:

Estimación informativa. No corresponde a una declaración oficial del SII.

11. MOTOR DE CÁLCULOS DEMOSTRATIVO

Crear funciones reutilizables para calcular:

IVA estimado

IVA débito
− IVA crédito utilizable
− remanente anterior


Cuando el resultado sea positivo:

Mostrar IVA estimado por pagar.

Cuando el resultado sea negativo:

Mostrar nuevo remanente estimado.

Mostrar IVA por pagar en cero.

Total tributario estimado

IVA estimado
+ PPM
+ retenciones


Reserva recomendada

Total tributario estimado
+ margen preventivo


Margen preventivo

Permitir valores demostrativos:

0%.

5%.

10%.

Personalizado.

Meta mensual

Calcular:

Porcentaje de cumplimiento.

Monto faltante.

Días restantes.

Promedio diario necesario.

Proyección al cierre.

Todos los cálculos deben actualizarse automáticamente cuando cambien los datos demostrativos.

12. META DE VENTAS

Crear una tarjeta llamada:

Meta mensual

Mostrar:

Meta mensual.

Ventas acumuladas.

Porcentaje de cumplimiento.

Monto faltante.

Días restantes.

Promedio diario necesario.

Proyección de cierre.

Ejemplo:

Meta: $10.000.000
Ventas acumuladas: $8.450.000
Cumplimiento: 84,5%
Falta para la meta: $1.550.000
Promedio diario necesario: $155.000


Mostrar una barra de progreso.

Permitir editar la meta mensual mediante un modal funcional.

Mensajes posibles:

Buen desempeño

Vas por delante del ritmo necesario para alcanzar tu meta.

Ritmo adecuado

Manteniendo tu promedio actual podrías alcanzar la meta.

Necesita impulso

Necesitas vender aproximadamente $155.000 diarios durante los próximos 10 días.

Nunca recomendar:

Vende menos para pagar menos IVA.

Cuando las ventas aumenten, mostrar una explicación equilibrada:

Vender más puede aumentar la reserva tributaria, pero no significa que vender más sea perjudicial. Revisa también tu margen y tus costos.

13. PROYECCIÓN AL CIERRE

Crear una tarjeta llamada:

Proyección al cierre del mes

Mostrar:

Ventas actuales.

Promedio diario.

Proyección probable.

Proyección conservadora.

Proyección alta.

Impuestos proyectados al cierre.

Ejemplo:

Ventas actuales: $8.450.000
Proyección conservadora: $9.700.000
Proyección probable: $10.200.000
Proyección alta: $10.800.000
Impuestos proyectados: entre $960.000 y $1.080.000


Mostrar:

Esta proyección utiliza el ritmo actual de ventas y puede cambiar durante el mes.

14. SIMULADOR “¿QUÉ PASA SI VENDO MÁS?”

Crear una herramienta informativa llamada:

¿Qué pasa si vendo más?

Opciones rápidas:

$100.000.

$500.000.

$1.000.000.

Monto personalizado.

Mostrar automáticamente:

Venta adicional.

IVA incluido aproximado.

Neto aproximado.

PPM adicional estimado.

Reserva tributaria adicional.

Monto restante antes de costos.

Ejemplo de mensaje:

Una venta de $1.000.000 no significa que tendrás $1.000.000 disponibles. Una parte corresponde a IVA, PPM y costos del negocio.

El simulador no debe modificar los datos reales del dashboard.

15. COMPARACIÓN MENSUAL

Crear una sección:

Comparación con el mes anterior

Mostrar:

Ventas actuales.

Ventas del periodo anterior.

Variación porcentual.

Compras actuales.

Compras del periodo anterior.

IVA estimado actual.

IVA del periodo anterior.

Ticket promedio.

Cantidad de facturas.

Cantidad de boletas.

Mejor día.

Mejor semana.

Mensajes automáticos:

Vendiste 14% más que el mes pasado.

Tus compras aumentaron más rápido que tus ventas.

Tu ticket promedio mejoró.

Este mes tienes menos crédito fiscal disponible.

Tu reserva tributaria está cubierta.

Tu reserva todavía no cubre la estimación.

16. PÁGINA DE VENTAS

Crear una página completa de ventas con:

Ventas totales.

Facturado.

Boletas.

Notas de crédito.

Ventas exentas.

Cantidad de documentos.

Ticket promedio.

Comparación mensual.

Gráfico simple diario o semanal.

Listado de documentos demostrativos.

Columnas en escritorio:

Fecha.

Tipo.

Folio.

Cliente.

Neto.

IVA.

Exento.

Total.

Estado.

Filtros:

Factura.

Boleta.

Nota de crédito.

Fecha.

Estado.

En móvil no utilizar una tabla horizontal difícil de leer. Convertir cada documento en una tarjeta compacta.

17. PÁGINA DE COMPRAS

Crear una página completa de compras con:

Compras totales.

Compras netas.

IVA crédito considerado.

Documentos registrados.

Documentos pendientes.

Documentos reclamados.

Documentos marcados como no incluir.

Proveedores principales.

Comparación mensual.

Estados:

Registrada.

Pendiente.

Reclamada.

No incluir.

Mostrar una advertencia cuando existan compras pendientes:

Tienes compras pendientes que podrían modificar tu IVA estimado cuando cambien de estado.

En esta etapa el usuario no debe poder cambiar el estado de las compras.

18. PÁGINA DE IMPUESTOS

Crear una página más detallada con:

IVA débito.

IVA crédito.

Remanente anterior.

IVA estimado.

Nuevo remanente.

PPM.

Retenciones.

Total estimado.

Margen preventivo.

Reserva recomendada.

Comparación histórica.

Nivel de confiabilidad.

Niveles de confiabilidad:

Alta

Los antecedentes demostrativos se encuentran actualizados.

Media

Existen compras pendientes o información parcialmente actualizada.

Baja

Faltan antecedentes importantes para realizar una estimación confiable.

Agregar una sección:

Qué puede modificar este cálculo

Compras pendientes.

Notas de crédito.

Remanentes.

Retenciones especiales.

Cambios de tasa de PPM.

Operaciones tributarias especiales.

Ajustes del contador.

19. PÁGINA DE METAS

Crear una página donde el usuario pueda ver:

Meta mensual.

Cumplimiento.

Proyección de cierre.

Promedio diario necesario.

Comparación con meses anteriores.

Mejor día.

Mejor semana.

Historial de metas demostrativas.

Permitir:

Editar meta.

Cambiar margen preventivo.

Simular ventas adicionales.

No permitir editar ventas, compras ni información tributaria.

20. CONFIGURACIÓN

Crear una página con:

Datos generales de la empresa.

Meta mensual.

Margen preventivo.

Dinero reservado.

Preferencias de alertas.

Estado de conexión SII.

Última sincronización.

Botón “Conectar SII”.

Botón “Desconectar”.

En esta etapa, el botón “Conectar SII” debe abrir un modal demostrativo.

Texto del modal:

La conexión real con el SII se habilitará en una próxima etapa mediante un servicio seguro. No ingreses una Clave Tributaria real en esta demostración.

Agregar un botón:

Probar conexión demostrativa

Al pulsarlo:

Mostrar animación de conexión.

Cambiar el estado a connecting.

Esperar brevemente.

Cambiar el estado a connected.

Cargar datos ficticios.

Actualizar la hora de sincronización.

Mostrar notificación de éxito.

No crear campos para ingresar credenciales reales.

Al pulsar “Desconectar”:

Cambiar el estado a disconnected.

Mantener los datos demostrativos, pero marcarlos como no sincronizados.

Mostrar una notificación clara.

21. ESCENARIOS DEMOSTRATIVOS

Crear una herramienta de desarrollo o selector visible para cambiar entre tres escenarios.

Escenario 1 — Negocio equilibrado

Ventas cercanas a la meta.

Reserva parcialmente cubierta.

IVA por pagar.

Pocas compras pendientes.

Nivel de confiabilidad alto.

Escenario 2 — Remanente disponible

Compras elevadas.

IVA crédito superior al débito.

IVA por pagar en cero.

Nuevo remanente para el siguiente periodo.

PPM y retenciones pendientes.

Nivel de confiabilidad medio.

Escenario 3 — Ventas altas y reserva insuficiente

Ventas superiores a la meta.

Impuestos estimados elevados.

Dinero reservado insuficiente.

Alerta preventiva.

Proyección alta al cierre.

Debe ser posible cambiar de escenario sin recargar la página.

Todos los indicadores, cálculos y mensajes deben actualizarse automáticamente.

22. ESTADOS DE LA INTERFAZ

Implementar correctamente:

Estado de carga.

Estado vacío.

Estado conectado.

Estado desconectado.

Información desactualizada.

Error de sincronización.

Sin comparación anterior.

Sin ventas.

Sin compras.

Sin remanente.

Remanente positivo.

IVA estimado por pagar.

Reserva suficiente.

Reserva insuficiente.

No dejar pantallas rotas cuando un valor sea cero.

23. EXPERIENCIA MÓVIL

En teléfonos:

Utilizar tarjetas de una columna.

Mantener los números principales visibles.

Evitar tablas horizontales.

Incorporar navegación inferior.

Usar botones grandes.

Mantener textos legibles.

Evitar modales que salgan fuera de la pantalla.

Permitir desplazamiento interno cuando corresponda.

No depender solamente de colores.

No esconder información importante en tooltips.

No cortar montos grandes.

No generar desplazamiento lateral.

La experiencia debe estar especialmente optimizada para Android.

24. ACCESIBILIDAD

Implementar:

Contraste adecuado.

Estados de foco visibles.

Navegación mediante teclado.

Etiquetas accesibles.

Botones con nombres claros.

Íconos acompañados por texto cuando sea necesario.

Mensajes comprensibles.

Formatos chilenos de moneda y fecha.

Formato monetario:

$8.450.000


No mostrar decimales innecesarios.

Fechas en español de Chile.

25. MENSAJES IMPORTANTES

Utilizar lenguaje sencillo.

Ejemplos correctos:

Estimación al día de hoy.

Reserva recomendada.

Proyección al cierre.

Información pendiente de actualización.

Revisa este resultado con tu contador.

Datos demostrativos.

Última actualización.

Compras pendientes que podrían modificar el cálculo.

No usar frases como:

Este es tu IVA oficial.

Este es exactamente el monto que pagarás.

Ya puedes presentar el F29.

No necesitas contador.

La aplicación garantiza el resultado tributario.

26. PREPARACIÓN PARA ETAPAS POSTERIORES

Dejar preparada la arquitectura para incorporar posteriormente:

Lovable Cloud.

Registro de usuarios.

Inicio de sesión real.

Varias empresas.

Roles de empresario y contador.

Base de datos.

API Gateway.

Registro de Compras y Ventas.

Formulario 29.

Boletas de honorarios.

Sincronización automática.

Sincronización semanal obligatoria.

Sincronización al primer ingreso diario.

Uso de datos guardados durante el resto del día.

Historial tributario.

Alertas.

Planes y suscripciones.

No implementar todavía estas integraciones reales.

27. RESTRICCIONES CRÍTICAS

En esta etapa:

No conectar el SII.

No conectar API Gateway.

No solicitar Clave Tributaria.

No solicitar ClaveÚnica.

No almacenar contraseñas.

No crear formularios falsos de acceso al SII.

No exponer secretos.

No crear claves de API en el frontend.

No presentar declaraciones.

No emitir documentos.

No implementar pagos.

No crear solo una landing page.

No entregar una maqueta estática.

No dejar botones visibles sin funcionamiento.

No utilizar contenido Lorem Ipsum.

No presentar estimaciones como valores oficiales.

No modificar ventas o compras.

28. VALIDACIÓN FUNCIONAL OBLIGATORIA

Antes de considerar terminada esta etapa, revisar realmente:

Todas las páginas cargan.

La navegación funciona.

El cambio de periodo funciona.

El cambio de escenario funciona.

El botón actualizar funciona.

La edición de meta funciona.

La edición de dinero reservado funciona.

El cambio de margen preventivo funciona.

El simulador funciona.

Los cálculos se actualizan.

La conexión simulada funciona.

La desconexión simulada funciona.

Los mensajes cambian según el escenario.

Los montos utilizan formato chileno.

La interfaz funciona en móvil.

No existen desbordamientos horizontales.

No existen rutas rotas.

No existen botones sin acción.

No existen errores de consola.

Los datos mock están separados de los componentes.

Ningún texto presenta la estimación como oficial.

No existen campos para credenciales reales.

Corregir los problemas encontrados antes de entregar.

29. REPORTE FINAL

Al finalizar, entrega un reporte honesto y detallado con:

A. Archivos creados

Lista de archivos y propósito.

B. Páginas implementadas

Lista de páginas terminadas.

C. Componentes principales

Lista de componentes reutilizables.

D. Cálculos implementados

Explicar las fórmulas utilizadas.

E. Datos demostrativos

Explicar los tres escenarios.

F. Interacciones verificadas

Indicar qué botones y flujos fueron probados.

G. Pruebas realmente ejecutadas

No afirmar que se probó algo si no se ejecutó realmente.

H. Errores encontrados y corregidos

Describir problemas reales detectados.

I. Pendientes para la etapa siguiente

Indicar qué falta para incorporar Lovable Cloud y conexión real.

No avances todavía con Lovable Cloud, API Gateway ni el SII.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://negocio-pro-chile.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8842be14-f186-4d86-9907-710835670642).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
