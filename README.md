# Cursala - Motor de Servicios (Backend)

Este es el núcleo lógico del ecosistema **Cursala**. Se encarga de la orquestación de datos, la seguridad y el soporte a las operaciones que consume el frontend.

## Propósito dentro del Ecosistema

El backend actúa como la capa de persistencia y servicios para la plataforma de capacitación, garantizando que el flujo de información entre estudiantes, tutores y administradores sea seguro y eficiente.

## Capacidades Principales

*   **Motor de Cuestionarios:** Lógica avanzada para la gestión de exámenes, entregas y correcciones.
*   **Gestión de Entidades:** Administración centralizada de cursos, categorías, clases y usuarios.
*   **Infraestructura de Pagos:** Soporte para transacciones y gestión de cuentas vinculadas a la formación.
*   **Centro de Notificaciones y Soporte:** API para la gestión de tickets de ayuda y comunicación con el usuario.

## Stack Tecnológico

*   **Runtime:** Node.js con TypeScript.
*   **Framework:** Express.
*   **Base de Datos:** MongoDB mediante Mongoose.
*   **Calidad:** Testing con Jest y herramientas de análisis estático.
