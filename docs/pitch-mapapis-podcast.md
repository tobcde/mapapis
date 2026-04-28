# MaPaPis — pitch narrativo (input para podcast / NotebookLM)

> Este doc no es spec técnica. Es la **historia del producto** contada en lenguaje humano, como si se la explicaras a un amigo en un café. Sirve de input para NotebookLM (Audio Overview) o para un podcast con dos voces.

---

## Qué es MaPaPis (la versión en una oración)

MaPaPis es una app argentina que reemplaza al grupo de WhatsApp del jardín y el colegio cuando hay que organizar compras entre los papás. En lugar de sufrir cadenas de mensajes, transferencias sueltas, planillas de Excel y "che, ¿quién se hace cargo de las remeras del acto?", el grupo postea la necesidad adentro de la app, las pymes locales ofertan a un precio, los papás eligen entre todos y la plata se mueve por un solo lugar con seguridad.

Es un **marketplace de dos lados**: por un lado las familias del grupo, por el otro las pymes que les venden. La plata se procesa dentro de la plataforma, MaPaPis cobra una comisión chica, y todos saben en qué punto del proceso están.

---

## El problema real (lo que pasa hoy en cada sala de jardín de Argentina)

Pensá en una sala de 20 chicos de jardín. Llega abril y la maestra pide una mochila idéntica para todos. Empieza el calvario:

- Una mamá (la "coordinadora", siempre la misma) arma un Excel.
- Mensajea pymes una por una buscando precio.
- Vuelven con presupuestos diferentes, algunos por WhatsApp, otros por mail, en distintas semanas.
- Manda al grupo un audio de 3 minutos explicando opciones.
- 12 mamás opinan, 3 nunca contestan, 2 dicen "me parece caro pero hagan lo que quieran".
- La coordinadora elige una pyme.
- Las 20 familias tienen que transferir.
- Persigue durante 10 días a las que no pagaron.
- Al final, un par discuten porque "yo nunca dije que sí a esa mochila".

Esto pasa **decenas de veces al año** en cada sala: uniformes, viajes, regalos para la maestra, fotógrafo del acto, materiales, cumpleaños. Hay un dolor real de **coordinación** y un dolor real de **plata**. Y nadie está atacando el problema con software pensado para Argentina — ni Mercado Libre, ni WhatsApp Business, ni Splitwise.

---

## Para quién es

Tiene **dos audiencias claramente distintas**:

### Familias (papás, mamás, tutores)
La promesa es: **dejá de perseguir plata y dejá de pagar de más**. Lo que antes era una semana de WhatsApp + Excel + transferencias se convierte en tocar un par de botones. Y como las pymes saben que están compitiendo con otras tres en la misma necesidad, los precios bajan.

Slogan candidato: *"Si no la usás, gastás de más"*.

### Pymes locales (librerías, imprentas, indumentaria, catering)
La promesa es: **clientes en grupo, ya organizados, pidiendo lo que vos vendés**. En lugar de hacer marketing al voleo, ven necesidades concretas de salas reales. No tienen que conseguir cada cliente uno por uno: si ganan, venden a 20 familias de una.

Slogan candidato: *"Si no te anotás, no ganás"*.

---

## Cómo funciona — un caso real, paso por paso

Tomemos la mochila del jardín de la hija de Pablo (uno de los founders). Es Sala Naranja, 18 familias.

**1. El grupo se arma.** La coordinadora crea el grupo "Sala Naranja Jardín La Plaza" en MaPaPis. La app le da un código de invitación tipo `AB12CD` que comparte por WhatsApp. Cada familia se suma con un click.

**2. Se publica la necesidad.** Una mamá postea: *"Mochila escolar tamaño A4, color libre, tiene que aguantar el año, presupuesto orientativo $30.000–$45.000 por mochila."* Le pone fecha límite: el viernes a la noche.

**3. Las pymes ven la necesidad — pero NO ven el grupo.** Acá está la magia anti-fraude. La librería "Pizzurno" en Belgrano ve que hay una necesidad de 18 mochilas en zona Belgrano CABA, con esos parámetros. **No ve el nombre del jardín ni el de la coordinadora ni los teléfonos**. Solo zona y datos del pedido. Esto evita que la pyme contacte a la familia por afuera y se saltee la plataforma.

**4. Las pymes ofertan.** Pizzurno ofrece $32.000 por unidad, entrega en 7 días, retiro o envío. Otra pyme ofrece $35.000 con bordado del nombre incluido. Otra $28.000 sin bordado. La app fija un cupo (ej. máximo 5 ofertas) — cuando llega al cupo, automáticamente pasa a votación.

**5. Las familias ven las ofertas, anonimizadas.** Cada familia ve "Pyme A", "Pyme B", "Pyme C" — no los nombres, solo precio, modo de entrega, días, descripción y rating. Esto es para que voten por **propuesta**, no por marca conocida.

**6. Votación.** Cada familia que se anotó vota una. La que tiene más votos gana. Si la coordinadora es admin del grupo, puede adjudicar manualmente cuando hay consenso claro.

**7. Pago.** Cada familia paga su parte a través de la app, con Mercado Pago. **MaPaPis no se queda con la plata** — la retiene en escrow (cuenta segregada de MP) hasta que la pyme entregue. Es importante: la plata no se mueve a la pyme hasta que confirmen entrega.

**8. Entrega + confirmación dual.** La pyme dice "entregado". La familia dice "recibí". Cuando ambos coinciden, MaPaPis libera la plata a la pyme **menos la comisión** (ej. 5%). Si hay disputa, hay un proceso de resolución.

**9. Reviews.** Después de la transacción, las familias dejan rating multi-dimensional sobre la pyme (calidad, tiempo, comunicación). Esto alimenta la confianza para futuras transacciones.

Listo. Lo que en WhatsApp tomaba dos semanas, en la app son cinco minutos por cada paso.

---

## Por qué no es WhatsApp + Mercado Pago

Las preguntas que más nos hacen en focus group:

> "¿Por qué no resuelvo esto con un grupo de WhatsApp + un link de pago de Mercado Pago?"

Tres razones:

**Anti-fraude estructural.** En WhatsApp los precios se inflan porque la pyme conoce a la coordinadora — son amigos del barrio. En MaPaPis las pymes no saben con quién compiten ni a qué grupo le venden hasta que ganan. **Eso baja el precio sin esfuerzo.**

**Confianza de pago.** Mercado Pago link directo significa que la familia transfiere y reza. En MaPaPis la plata queda en escrow: si no llega la mochila, no se paga. La pyme no puede desaparecer con la guita.

**Coordinación.** En WhatsApp nadie sabe "¿cuántos pagaron?" sin pedirlo a mano. En MaPaPis es una barra de progreso visible para todo el grupo. Quien debe, debe en público (suave, pero visible).

---

## Cómo gana plata MaPaPis

Dos fuentes:

**1. Comisión sobre transacciones.** Cuando una pyme cobra, MaPaPis se queda con un porcentaje (orden de magnitud: 3-7%, depende del rubro y del tamaño). La pyme acepta porque el costo de adquisición de cliente baja a casi cero.

**2. Suscripción para pymes.** Las pymes que quieren features avanzados (estadísticas, "avísame al cierre" para necesidades grandes, badges de tier) pagan una mensualidad. Las que no, ofertan gratis pero con menos visibilidad.

El modelo es honesto en los dos sentidos: la familia ve siempre precio final, sin sorpresas. La pyme paga solo cuando vende.

---

## El truco del bootstrap (cómo arrancamos sin marketing)

Marketplace cold-start es el problema más jodido de un producto de dos lados: las familias no entran si no hay pymes; las pymes no entran si no hay familias. Resolvemos así:

**Día 1:** dos salas del jardín de la hija de Pablo (founder). Acceso directo, cero marketing. Sumamos a las 35 familias.

**Las familias publican necesidades reales.** Mochila, fotos del acto, regalo del día del maestro.

**Los founders contactan pymes una por una.** Buscan en zona, mandan WhatsApp explicando, suman 5-10 pymes a mano. No se hace marketing — se hace outreach personalizado.

**Las pymes ofertan, ganan, cobran, y se quedan.** Como ya están en la base, van a ofertar a la próxima necesidad sin que tengamos que volver a buscarlas.

**Crecimiento por jardín.** Cada nuevo jardín que sumamos trae 4-6 salas, multiplica la demanda y atrae más pymes orgánicamente.

Es la estrategia clásica de marketplaces seeded: manual y caliente al inicio, autosostenida después.

---

## Modalidades de necesidad (un detalle que casi nadie ve)

No todas las necesidades funcionan igual. Hay dos tipos:

**Grupales.** El grupo decide juntos comprar X cantidad fija. Ejemplo: *"50 vasos para la fiesta"*. Quien publica define la cantidad.

**Individuales.** Cada familia decide si participa o no. Ejemplo: *"cada chico tiene que llevar una remera blanca para el acto"*. La cantidad final = cuántas familias se anotaron antes de la fecha límite.

En el caso individual hay **una ventana de inscripción**. Las pymes ven la necesidad pero la cantidad no es definitiva. Cuando cierra la ventana, las pymes que se suscribieron a "avisame al cierre" reciben notificación con la cantidad final y ofertan sobre un dato firme. Esto evita el lío típico de "ofertaron por 30 remeras y al final compraron 12".

---

## La frontera de exploración (cumpleaños / "sobre digital")

En focus groups apareció algo que no estaba en el plan original: los **cumpleaños**. La sala junta plata para el regalo, una mamá cobra a todas, le transfiere a la familia cumpleañera. Pasa **decenas de veces al año** y el dolor es perseguir la plata, no elegir el regalo.

Estamos explorando una variante que llamamos **"sobre digital"**: la app coordina el pool, pero **MaPaPis no toca la plata** — actúa como orquestador. Cada familia paga directo a la cuenta MP del cumpleañero (vía OAuth one-time), la app muestra el progreso (pagaron 12 de 18, falta tal y tal) y envía recordatorios. Como las transferencias CVU↔CVU son gratis por reglamentación BCRA, no hay comisión sobre ese flujo. La plata se queda en marketplace solo si la familia decide gastar el regalo dentro de la app (ahí entra una pyme y cobramos comisión normal).

Es **acquisition feature**: cada cumple que coordina la app, son 20 padres viendo cómo funciona. No es el negocio principal — el marketplace de pymes sigue siendo el core — pero es un loop de crecimiento muy fuerte.

---

## A dónde va esto (visión)

A 12 meses: ser **el** lugar donde se organiza la sala. Cada jardín y colegio que entra trae sus 4-6 salas, sus 80-150 familias, y un puñado de pymes locales que pasan a tener un canal de venta sin marketing. La app se convierte en infraestructura del lado de los padres y en canal pagado del lado de las pymes.

A 24 meses: integración con instituciones (jardines/colegios postean necesidades transversales — "ropa de gimnasia para todo 1er grado"), pagos institucionales (la cooperadora paga, no las familias), y posiblemente expansión regional a otros países de habla hispana donde el dolor es idéntico (Uruguay, Chile, México).

La pregunta que nos hacemos cada semana es: *¿cuál es la próxima fricción que sacamos del Excel del coordinador?* Esa es la roadmap.
