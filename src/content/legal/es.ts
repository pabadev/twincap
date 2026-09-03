import type { LegalContent } from './types';

/**
 * Contenido legal en español neutro (prohibido voseo/regionalismos).
 * La identidad legal usa placeholders literales (ver AGENTS.md / R13 plane):
 * [RAZÓN SOCIAL], [NIT], [DIRECCIÓN], [CORREO DE CONTACTO], [CIUDAD/PAÍS].
 */
export const legalEs: LegalContent = {
  privacy: {
    slug: 'privacy',
    title: 'Política de Privacidad',
    updatedAt: '2026-09-03',
    intro:
      'En TwinCap, tu privacidad es una prioridad. Esta Política de Privacidad explica qué datos personales tratamos, cómo los usamos, cómo los protegemos y qué derechos tienes sobre ellos. Al usar TwinCap aceptas esta política.',
    sections: [
      {
        heading: '1. Responsable del tratamiento',
        paragraphs: [
          'La entidad responsable del tratamiento de tus datos personales es [RAZÓN SOCIAL], con NIT [NIT] y domicilio en [DIRECCIÓN], [CIUDAD/PAÍS] (en adelante, "TwinCap" o "nosotros").',
          'Para cualquier consulta o ejercicio de tus derechos, puedes contactarnos en [CORREO DE CONTACTO].',
        ],
      },
      {
        heading: '2. Datos personales que tratamos',
        paragraphs: [
          'Recopilamos y tratamos únicamente los datos necesarios para prestar el servicio:',
        ],
        list: [
          'Datos de tu cuenta: tu correo electrónico (único y normalizado), un hash de tu contraseña (nunca almacenamos tu contraseña en texto plano), tu nombre (opcional), tu preferencia de idioma (español o inglés), el estado de verificación de tu correo electrónico, y las fechas de creación y actualización de tu cuenta.',
          'Datos de tus clientes o terceros: cuando usas el módulo de Clientes, registras manualmente el nombre (obligatorio) y, opcionalmente, el teléfono, el correo electrónico y una nota de cada cliente o tercero.',
          'Dirección IP: de forma transitoria, la usamos únicamente como clave interna para prevenir abuso y fraude (limitación de solicitudes). No se persiste en tu perfil ni se asocia de forma permanente a tu cuenta.',
        ],
      },
      {
        heading: '3. Cómo usamos tus datos',
        paragraphs: [
          'Usamos tus datos personales para las siguientes finalidades:',
        ],
        list: [
          'Proveer y operar el servicio: crear tu cuenta, autenticarte, guardar y presentar tus finanzas, y permitirte administrar tus cuentas, movimientos, categorías, créditos, ventas, clientes y catálogo.',
          'Seguridad y prevención de fraude: autenticar sesiones, limitar solicitudes y proteger tu cuenta frente a accesos no autorizados.',
          'Comunicaciones transaccionales: enviarte correos electrónicos imprescindibles, como la verificación de tu correo electrónico y el restablecimiento de tu contraseña.',
          'Preferencias: recordar tu idioma y tu tema visual para mejorar tu experiencia de uso.',
        ],
      },
      {
        heading: '4. Base legal del tratamiento',
        paragraphs: [
          'Tratamos tus datos personales con base en: la ejecución del contrato de servicios que celebras al crear tu cuenta; tu consentimiento, cuando corresponda; y nuestros intereses legítimos en la seguridad, la prevención del fraude y la correcta operación del servicio.',
        ],
      },
      {
        heading: '5. Compartición con terceros (encargados del tratamiento)',
        paragraphs: [
          'No vendemos ni alquilamos tus datos personales. Solamente compartimos datos con proveedores que actúan como encargados del tratamiento para operar el servicio:',
        ],
        list: [
          'MongoDB Atlas: proveedor de nuestra base de datos principal, donde se almacena toda la información del servicio. Actúa como encargado del tratamiento.',
          'Resend: proveedor de correo transaccional (verificación de correo electrónico y restablecimiento de contraseña). Recibe solo el correo electrónico del destinatario; el enlace con un token de un solo uso viaja en la URL del mensaje. Actúa como encargado del tratamiento.',
          'CDN de Google Fonts: las fuentes tipográficas (Geist, Geist Mono y Sora) se cargan desde la CDN de Google; la aplicación no envía datos personales a ese servicio.',
        ],
      },
      {
        heading: '6. Retención de datos',
        paragraphs: [
          'Conservamos tus datos personales mientras tu cuenta esté activa y durante el tiempo que sea necesario para cumplir con las finalidades descritas, resolver disputas y cumplir obligaciones legales. La dirección IP usada para la limitación de solicitudes se conserva de forma efímera con borrado automático.',
        ],
      },
      {
        heading: '7. Seguridad de la información',
        paragraphs: [
          'Implementamos medidas técnicas y organizativas para proteger tus datos, entre ellas:',
        ],
        list: [
          'Almacenamiento de tu contraseña únicamente como hash (bcrypt); nunca en texto plano y nunca expuesta en las respuestas del sistema.',
          'Sesiones protegidas con tokens cifrados (JWT con cifrado A256GCM) y cookies marcadas como httpOnly y sameSite, con el atributo secure en producción.',
          'Aislamiento de datos: cada cuenta solo accede a su propia información.',
          'Cifrado en tránsito mediante conexiones seguras (HTTPS).',
        ],
      },
      {
        heading: '8. Derechos del titular',
        paragraphs: [
          'Tienes derecho a conocer, actualizar y rectificar tus datos personales; a solicitar prueba de la autorización otorgada; a revocar la autorización y solicitar la supresión de los datos cuando ya no sean necesarios; y a presentar quejas ante la autoridad competente cuando corresponda.',
          'Actualmente puedes consultar, actualizar y rectificar parte de tus datos desde tu perfil en la aplicación. Para ejercer la supresión o la rectificación de datos que no puedes modificar por tu cuenta, o para solicitar información adicional, escríbenos a [CORREO DE CONTACTO]. La funcionalidad de autoservicio para la eliminación de tu cuenta y la exportación de tus datos se habilitará próximamente.',
        ],
      },
      {
        heading: '9. Enlaces a sitios de terceros',
        paragraphs: [
          'TwinCap puede contener enlaces a sitios web de terceros. No somos responsables de las prácticas de privacidad de esos sitios y te recomendamos revisar sus políticas antes de facilitarles tus datos.',
        ],
      },
      {
        heading: '10. Cambios a esta política',
        paragraphs: [
          'Podemos actualizar esta Política de Privacidad cuando sea necesario. Cuando haya cambios, actualizaremos la fecha de entrada en vigencia al inicio de este documento y te lo notificaremos por los canales disponibles. Te recomendamos revisarla periódicamente.',
        ],
      },
      {
        heading: '11. Contacto',
        paragraphs: [
          'Si tienes preguntas sobre esta Política de Privacidad o sobre el tratamiento de tus datos personales, contáctanos en [CORREO DE CONTACTO] o en [DIRECCIÓN], [CIUDAD/PAÍS].',
        ],
      },
    ],
  },
  terms: {
    slug: 'terms',
    title: 'Términos y Condiciones',
    updatedAt: '2026-09-03',
    intro:
      'Estos Términos y Condiciones regulan el uso de TwinCap, un servicio de administración de finanzas personales y de pequeños negocios. Al crear una cuenta y usar el servicio, aceptas estos términos.',
    sections: [
      {
        heading: '1. Aceptación de los términos',
        paragraphs: [
          'Al acceder o usar TwinCap, aceptas cumplir estos Términos y Condiciones y toda política que los complemente, como la Política de Privacidad, la Política de Cookies y la Política de Tratamiento de Datos Personales. Si no estás de acuerdo, no debes usar el servicio.',
        ],
      },
      {
        heading: '2. Descripción del servicio',
        paragraphs: [
          'TwinCap es una herramienta de registro y control financiero que te permite administrar tus finanzas personales y de tu negocio. El servicio incluye, entre otras funciones:',
        ],
        list: [
          'Gestión de cuentas en distintas monedas (COP, USD, MXN y EUR).',
          'Registro de movimientos de ingresos y egresos, y su categorización.',
          'Transferencias entre cuentas propias.',
          'Créditos recibidos y créditos otorgados, con control de abonos y cuotas.',
          'Ventas (incluido punto de venta POS) y cuentas por pagar.',
          'Administración de clientes y de un catálogo de artículos.',
        ],
      },
      {
        heading: '3. Registro y cuenta',
        paragraphs: [
          'Para usar el servicio debes crear una cuenta proporcionando un correo electrónico válido y una contraseña segura.',
        ],
        list: [
          'Eres responsable de mantener la confidencialidad de tu contraseña y de las actividades que ocurran en tu cuenta.',
          'Debes proporcionar datos veraces y mantenerlos actualizados.',
          'Puedes verificar tu correo electrónico y restablecer tu contraseña mediante los enlaces que te enviamos.',
          'No puedes usar el servicio para fines ilícitos ni de forma que perjudique a terceros o al propio servicio.',
        ],
      },
      {
        heading: '4. Uso aceptable',
        paragraphs: [
          'Te comprometes a usar TwinCap únicamente para los fines previstos. Queda prohibido, entre otras conductas:',
        ],
        list: [
          'Intentar acceder a cuentas o datos de otros usuarios.',
          'Introducir información falsa o de terceros sin su consentimiento.',
          'Intentar vulnerar la seguridad del servicio, sus bases de datos o sus sistemas.',
          'Usar el servicio para actividades ilícitas, fraudulentas o que infrinjan derechos de terceros.',
          'Reproducir, distribuir o explotar comercialmente el servicio sin autorización.',
        ],
      },
      {
        heading: '5. Datos de terceros que registras',
        paragraphs: [
          'Puedes registrar en el servicio información de tus propios clientes o terceros (por ejemplo, en el módulo de Clientes). Al hacerlo, eres el responsable del tratamiento de esos datos frente a los titulares.',
        ],
        list: [
          'Debes contar con la autorización de los titulares o con otra base legal para registrar y tratar sus datos.',
          'Debes informarles, conforme a la ley aplicable, sobre el tratamiento que realiza la entidad responsable descrita en estos términos.',
          'TwinCap actúa como encargado del tratamiento de esos datos, únicamente para proveer el servicio que solicitas.',
        ],
      },
      {
        heading: '6. Propiedad intelectual',
        paragraphs: [
          'El servicio, su diseño, logos, textos, gráficos y demás elementos de TwinCap son de titularidad de [RAZÓN SOCIAL] o de sus licenciantes y están protegidos por las normas de propiedad intelectual. Te otorgamos una licencia limitada, no exclusiva e intransferible para usar el servicio para tu uso personal o de negocio, de acuerdo con estos términos. Conservas la titularidad de la información que ingresas en el servicio.',
        ],
      },
      {
        heading: '7. Limitación de responsabilidad',
        paragraphs: [
          'TwinCap es una herramienta de registro y control de tu información financiera. No constituye asesoría financiera, contable, tributaria ni legal profesional, y no reemplaza la opinión de profesionales calificados.',
          'Las decisiones financieras, contables o de cualquier otra índole que tomes con base en la información registrada son de tu exclusiva responsabilidad. Hasta donde lo permita la ley, [RAZÓN SOCIAL] no será responsable por daños directos, indirectos, incidentales o consecuentes derivados del uso o la imposibilidad de uso del servicio.',
        ],
      },
      {
        heading: '8. Suspensión y terminación',
        paragraphs: [
          'Podemos suspender o cancelar tu acceso al servicio si infringes estos términos, si existe riesgo para la seguridad o el buen funcionamiento del servicio, o si lo exige la ley. También puedes dejar de usar el servicio en cualquier momento. El ejercicio de tus derechos sobre tus datos se describe en la Política de Privacidad y en la Política de Tratamiento de Datos Personales.',
        ],
      },
      {
        heading: '9. Modificaciones',
        paragraphs: [
          'Podemos modificar estos Términos y Condiciones en cualquier momento. Los cambios entrarán en vigencia al publicarse en esta página y serán notificados por los canales disponibles. El uso continuado del servicio tras un cambio implica su aceptación.',
        ],
      },
      {
        heading: '10. Ley aplicable',
        paragraphs: [
          'Estos términos se rigen por las leyes de la República de Colombia, en [CIUDAD/PAÍS]. En caso de controversia, las partes procurarán resolverla de forma directa y, en su defecto, se someterán a la jurisdicción de los tribunales competentes de [CIUDAD/PAÍS].',
        ],
      },
      {
        heading: '11. Contacto',
        paragraphs: [
          'Para consultas sobre estos Términos y Condiciones, contáctanos en [CORREO DE CONTACTO]. El responsable es [RAZÓN SOCIAL], con NIT [NIT] y domicilio en [DIRECCIÓN], [CIUDAD/PAÍS].',
        ],
      },
    ],
  },
  cookies: {
    slug: 'cookies',
    title: 'Política de Cookies',
    updatedAt: '2026-09-03',
    intro:
      'Esta Política de Cookies explica qué cookies y tecnologías de almacenamiento local usa TwinCap, para qué se utilizan y cómo puedes administrarlas.',
    sections: [
      {
        heading: '1. ¿Qué son las cookies?',
        paragraphs: [
          'Las cookies son pequeños archivos de texto que un sitio web almacena en tu dispositivo para recordar información sobre tu visita. TwinCap usa un número mínimo de cookies propias para operar el servicio y mejorar tu experiencia.',
        ],
      },
      {
        heading: '2. Cookies propias que usamos',
        paragraphs: [
          'TwinCap utiliza únicamente dos cookies propias. No usamos cookies de publicidad, marketing ni de terceros.',
        ],
        table: {
          caption: 'Cookies utilizadas por TwinCap',
          headers: ['Cookie', 'Finalidad', 'Necesaria', 'Características'],
          rows: [
            [
              'gm_session',
              'Mantener tu sesión iniciada (identidad autenticada).',
              'Sí, estrictamente necesaria',
              'Cifrada (JWT A256GCM), httpOnly, sameSite lax, path /, secure en producción. Expira a los 30 días.',
            ],
            [
              'NEXT_LOCALE',
              'Recordar tu preferencia de idioma (español o inglés).',
              'No (mejora la experiencia)',
              'Solo se almacena si eliges un idioma; puedes borrarla.',
            ],
          ],
        },
      },
      {
        heading: '3. Sin cookies de terceros, marketing ni analítica',
        paragraphs: [
          'TwinCap no instala cookies de terceros, de marketing ni de análisis. No rastreamos tu actividad en otros sitios web. La única excepción es que las fuentes tipográficas se cargan desde la CDN de Google Fonts, sin que la aplicación envíe datos personales a ese servicio.',
        ],
      },
      {
        heading: '4. Almacenamiento local y otras tecnologías',
        paragraphs: [
          'Además de las cookies, TwinCap utiliza almacenamiento local de tu navegador para guardar tu preferencia de tema visual (clave "twincap-theme", con los valores light, dark o system). Este dato se almacena únicamente en tu dispositivo. El Service Worker de la aplicación (PWA) almacena en caché únicamente activos estáticos no autenticados (como el manifiesto y los iconos) y nunca almacena datos personales ni financieros.',
        ],
      },
      {
        heading: '5. Cómo administrar las cookies',
        paragraphs: [
          'Puedes controlar y eliminar las cookies desde la configuración de tu navegador. Puedes bloquearlas o borrarlas, aunque ten en cuenta que la cookie de sesión (gm_session) es estrictamente necesaria: sin ella no podrás iniciar sesión ni usar el servicio.',
          'También puedes borrar el dato de tema almacenado en tu navegador; el servicio volverá a tu tema por defecto (según tu preferencia del sistema).',
        ],
      },
      {
        heading: '6. Vigencia y cambios',
        paragraphs: [
          'Esta Política de Cookies fue actualizada por última vez en la fecha indicada al inicio de este documento. Podemos actualizarla cuando sea necesario; los cambios se publicarán en esta página.',
        ],
      },
    ],
  },
  dataPolicy: {
    slug: 'data-policy',
    title: 'Política de Tratamiento de Datos Personales',
    updatedAt: '2026-09-03',
    intro:
      'De conformidad con la Ley 1581 de 2012 y sus normas reglamentarias de la República de Colombia, esta Política de Tratamiento de Datos Personales informa a los titulares sobre el tratamiento que [RAZÓN SOCIAL] realiza de sus datos personales.',
    sections: [
      {
        heading: '1. Responsable del tratamiento',
        paragraphs: [
          'El responsable del tratamiento de los datos personales es [RAZÓN SOCIAL], con NIT [NIT], domicilio principal en [DIRECCIÓN], [CIUDAD/PAÍS]. Para cualquier asunto relacionado con el tratamiento de datos personales, puedes contactarnos en [CORREO DE CONTACTO].',
        ],
      },
      {
        heading: '2. Finalidades del tratamiento',
        paragraphs: [
          'Tus datos personales podrán ser tratados con las siguientes finalidades:',
        ],
        list: [
          'Crear, administrar y autenticar tu cuenta en el servicio.',
          'Prestar y operar el servicio de administración financiera, incluido el registro, la consulta y el control de tu información.',
          'Enviar comunicaciones transaccionales (verificación de correo electrónico, restablecimiento de contraseña).',
          'Prevenir el fraude y el abuso, y proteger la seguridad de la información.',
          'Cumplir obligaciones legales y atender solicitudes de los titulares.',
        ],
      },
      {
        heading: '3. Datos personales tratados',
        paragraphs: [
          'Tratamos únicamente los datos necesarios para las finalidades descritas: tu correo electrónico, el hash de tu contraseña, tu nombre (opcional), tu preferencia de idioma, el estado de verificación de tu correo, las fechas de creación y actualización de tu cuenta, y los datos de tus clientes o terceros que registras en el servicio (nombre, teléfono, correo electrónico y nota). También tratamos de forma transitoria la dirección IP con fines de prevención de abuso.',
        ],
      },
      {
        heading: '4. Derechos del titular',
        paragraphs: [
          'De acuerdo con la Ley 1581 de 2012, como titular de tus datos personales tienes derecho a:',
        ],
        list: [
          'Conocer, actualizar y rectificar tus datos personales frente al responsable.',
          'Solicitar prueba de la autorización otorgada para el tratamiento.',
          'Ser informado, previa solicitud, sobre el uso que se ha dado a tus datos.',
          'Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) por infracciones a la Ley 1581 de 2012.',
          'Revocar la autorización y solicitar la supresión de tus datos cuando no exista deber legal de conservarlos.',
          'Acceder en forma gratuita a tus datos personales que hayan sido objeto de tratamiento.',
        ],
      },
      {
        heading: '5. Cómo ejercer tus derechos',
        paragraphs: [
          'Puedes ejercer tus derechos en cualquier momento, de forma gratuita, contactando al responsable en [CORREO DE CONTACTO]. Te atenderemos en los términos previstos por la ley. La funcionalidad de autoservicio para la eliminación de tu cuenta y la consulta de tus datos se habilitará próximamente.',
        ],
      },
      {
        heading: '6. Canales de atención',
        paragraphs: ['Para el ejercicio de tus derechos y consultas, puedes usar los siguientes canales:'],
        list: [
          'Correo electrónico: [CORREO DE CONTACTO].',
          'Dirección física: [DIRECCIÓN], [CIUDAD/PAÍS].',
        ],
      },
      {
        heading: '7. Conservación de los datos',
        paragraphs: [
          'Conservamos tus datos personales durante el tiempo necesario para cumplir las finalidades del tratamiento, atender obligaciones legales y ejercer o defender derechos. Una vez ya no sean necesarios, serán suprimidos o anonimizados, conforme a la ley.',
        ],
      },
      {
        heading: '8. Transferencia a encargados del tratamiento',
        paragraphs: [
          'Podemos compartir tus datos personales con encargados del tratamiento que nos asisten en la operación del servicio, en especial:',
        ],
        list: [
          'MongoDB Atlas: almacenamiento de la base de datos del servicio.',
          'Resend: envío de correos electrónicos transaccionales (verificación de correo y restablecimiento de contraseña), quien recibe únicamente el correo del destinatario.',
        ],
      },
      {
        heading: '9. Datos de terceros que registras',
        paragraphs: [
          'Cuando registras datos de tus propios clientes o terceros en el servicio, actúas como responsable del tratamiento de esos datos frente a sus titulares. TwinCap actúa como encargado del tratamiento, única y exclusivamente para prestarte el servicio. Debes contar con la autorización de los titulares o con otra base legal para registrar y tratar sus datos, e informarles conforme a la ley aplicable.',
        ],
      },
      {
        heading: '10. Menores de edad',
        paragraphs: [
          'El servicio no está dirigido a menores de edad. No tratamos conscientemente datos personales de menores sin el consentimiento de sus representantes legales, cuando la ley lo requiera.',
        ],
      },
      {
        heading: '11. Vigencia y aviso de privacidad',
        paragraphs: [
          'Esta política rige a partir de la fecha de su entrada en vigencia y podrá ser actualizada por el responsable. Los cambios serán informados por los canales disponibles y publicados en esta página. Al crear una cuenta y usar el servicio, manifiestas que leíste y aceptaste esta política.',
        ],
      },
      {
        heading: '12. Modificaciones y contacto',
        paragraphs: [
          'Para actualizar, rectificar o solicitar información sobre esta Política de Tratamiento de Datos Personales, contáctanos en [CORREO DE CONTACTO] o en [DIRECCIÓN], [CIUDAD/PAÍS].',
        ],
      },
    ],
  },
};
