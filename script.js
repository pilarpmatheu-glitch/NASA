
// Elementos del HTML

const mesActual = document.getElementById("mesActual");
const anterior = document.getElementById("anterior");
const siguiente = document.getElementById("siguiente");

const selector = document.getElementById("selector");
const cerrar = document.getElementById("cerrar");
const borrar = document.getElementById("borrar");

// Fecha que se está mostrando

let fecha = new Date();
fecha.setDate(1);

// Fecha seleccionada para colorear

let seleccion = null;

// Meses

const meses = [
    "Enero", "Febrero", "Marzo", "Abril",
    "Mayo", "Junio", "Julio", "Agosto",
    "Septiembre", "Octubre", "Noviembre",
    "Diciembre"
];

const nombresDias = [
    "L", "M", "M", "J", "V", "S", "D"
];

const colores = [
    "verde", "amarillo", "naranja", "rojo"
];

// Datos de ejemplo reproducibles.
// No representan incendios reales.

function colorEjemplo(tipo, año, mes, dia) {

    if (tipo === "presente") {
        return null;
    }

    let numero = (
        dia * 7 +
        mes * 11 +
        año +
        (tipo === "promedio" ? 17 : 0)
    ) % 13;

    if (numero < 3) return "verde";
    if (numero < 6) return "amarillo";
    if (numero < 9) return "naranja";

    return "rojo";
}

// Crear un calendario

function crearCalendario(id, año, mes, tipo) {

    const contenedor = document.getElementById(id);

    contenedor.innerHTML = "";

    // Encabezado de lunes a domingo

    nombresDias.forEach(nombre => {

        let titulo = document.createElement("div");

        titulo.className = "nombre-dia";
        titulo.textContent = nombre;

        contenedor.appendChild(titulo);
    });

    // Cantidad de días

    let cantidadDias = new Date(
        año, mes + 1, 0
    ).getDate();

    // Primer día del mes

    let primerDia = new Date(
        año, mes, 1
    ).getDay();

    let inicio = (primerDia + 6) % 7;

    let semanas = Math.max(
        5,
        Math.ceil((inicio + cantidadDias) / 7)
    );

    // Generamos las casillas

    for (let i = 0; i < semanas * 7; i++) {

        let dia = i - inicio + 1;

        let cuadro = document.createElement("button");

        cuadro.type = "button";
        cuadro.className = "dia";

        if (dia < 1 || dia > cantidadDias) {

            cuadro.classList.add("vacio");
            cuadro.disabled = true;

        } else {

            cuadro.textContent = dia;

            // Clave para guardar el color

            let clave = `${tipo}-${año}-${mes + 1}-${dia}`;

            // Buscamos un color guardado

            let guardado = localStorage.getItem(clave);

            // Si no hay color guardado,
            // utilizamos los datos de ejemplo

            let color = guardado;

            if (color === null) {
                color = colorEjemplo(tipo, año, mes, dia);
            }

            if (color && colores.includes(color)) {
                cuadro.classList.add(color);
            }

            // Resaltar el día actual

            let hoy = new Date();

            if (
                tipo === "presente" &&
                dia === hoy.getDate() &&
                mes === hoy.getMonth() &&
                año === hoy.getFullYear()
            ) {
                cuadro.classList.add("hoy");
            }

            // Abrir el selector

            cuadro.addEventListener("click", function() {

                seleccion = clave;
                selector.classList.remove("oculto");

            });
        }

        contenedor.appendChild(cuadro);
    }
}

// Actualizar los tres calendarios

function actualizar() {

    let mes = fecha.getMonth();
    let año = fecha.getFullYear();

    mesActual.textContent = meses[mes] + " " + año;

    document.getElementById("tituloPresente").textContent =
        meses[mes] + " " + año;

    document.getElementById("tituloPasado").textContent =
        meses[mes] + " " + (año - 10);

    document.getElementById("tituloPromedio").textContent =
        "Promedio " + (año - 10) + "–" + (año - 1);

    crearCalendario(
        "calendarioPresente", año, mes, "presente"
    );

    crearCalendario(
        "calendarioPasado", año - 10, mes, "pasado"
    );

    crearCalendario(
        "calendarioPromedio", año, mes, "promedio"
    );

    selector.classList.add("oculto");
}

// Elegir color

document.querySelectorAll("[data-color]").forEach(boton => {

    boton.addEventListener("click", function() {

        if (!seleccion) return;

        localStorage.setItem(
            seleccion,
            boton.dataset.color
        );

        actualizar();
    });
});

// Quitar color y dejar blanco

borrar.addEventListener("click", function() {

    if (!seleccion) return;

    // "blanco" evita recuperar el color de ejemplo
    localStorage.setItem(seleccion, "blanco");

    actualizar();
});

// Cerrar selector

cerrar.addEventListener("click", function() {
    selector.classList.add("oculto");
});

// Mes anterior

anterior.addEventListener("click", function() {

    fecha.setMonth(fecha.getMonth() - 1);

    actualizar();
});

// Mes siguiente

siguiente.addEventListener("click", function() {

    fecha.setMonth(fecha.getMonth() + 1);

    actualizar();
});

// Iniciar

actualizar();
