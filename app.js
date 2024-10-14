const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const port = 3000;
const rootFolderPath = 'C:/Users/Apolo Pou/Desktop/utecnica'; // Cambia esta ruta si es necesario

// Middleware para parsear cuerpos de solicitud en JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de multer para almacenar los archivos en la ruta adecuada
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const folderPath = req.query.path ? path.join(rootFolderPath, req.query.path) : rootFolderPath;
        console.log(`Subiendo archivo a: ${folderPath}`);
        cb(null, folderPath);  // Define el directorio de destino
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);  // Mantener el nombre original del archivo
    }
});

const upload = multer({ storage: storage });

// Ruta para servir la página principal (index.html)
app.get('/', (req, res) => {
    console.log('Accediendo a la raíz');
    res.sendFile(path.join(__dirname, 'index.html')); // Sirve el archivo index.html
});

// Ruta para obtener los archivos de una carpeta
app.get('/files', (req, res) => {
    const folderPath = req.query.path ? path.join(rootFolderPath, req.query.path) : rootFolderPath;
    console.log(`Obteniendo archivos desde la carpeta: ${folderPath}`);

    fs.readdir(folderPath, { withFileTypes: true }, (err, files) => {
        if (err) {
            console.error(`Error al leer la carpeta: ${folderPath}`, err);
            return res.status(500).json({ error: 'No se pueden listar los archivos' });
        }

        console.log(`Archivos encontrados en la carpeta ${folderPath}:`, files);

        const fileList = files.map(file => ({
            name: file.name,
            type: file.isDirectory() ? 'directory' : 'file'
        }));

        res.json(fileList);
    });
});
let currentPath = '';  // Ruta actual
let history = [];      // Historial de navegación
let historyIndex = -1; // Índice del historial

// Cargar archivos desde el servidor
async function loadFiles(path = '') {
    let requestPath = '';  // Por defecto, no enviar un query string

    // Solo agregamos el query string si `path` no es vacío
    if (path) {
        requestPath = `?path=${encodeURIComponent(path)}`;
    }

    // Depurar el valor de `path`
    console.log(`Cargando archivos desde: ${path || 'Raíz'}`);

    try {
        // Asegurarse de que la URL se construya correctamente
        const url = `/files${requestPath}`;
        console.log('URL de solicitud:', url);  // Verificar la URL generada
        
        // Asegurarse de que la URL es válida
        if (!url.startsWith('/')) {
            throw new Error('La URL generada no es válida: ' + url);
        }
        
        const response = await fetch(url);
        const files = await response.json();
        console.log('Archivos recibidos:', files);

        const fileList = document.getElementById('file-list');
        fileList.innerHTML = '';  // Limpiar la lista de archivos

        // Generar la lista de archivos y carpetas
        files.forEach(file => {
            const listItem = document.createElement('li');
            listItem.textContent = file.name;

            // Añadir clase para directorios y eventos para navegar
            if (file.type === 'directory') {
                listItem.classList.add('directory');
                listItem.addEventListener('click', () => navigateTo(path ? `${path}/${file.name}` : file.name));
            } else {
                // Solo añadir evento para archivos (para ver o eliminar)
                listItem.addEventListener('click', () => viewFile(path ? `${path}/${file.name}` : file.name));
            }

            // Botón de eliminar archivo o carpeta
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Eliminar';
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();  // Evitar que el click sobre el botón dispare el evento del elemento de la lista
                deleteFileOrFolder(path ? `${path}/${file.name}` : file.name);
            });

            listItem.appendChild(deleteButton);
            fileList.appendChild(listItem);
        });

        // Actualizar los botones de navegación
        updateNavigationButtons();

        // Actualizar la acción del formulario de subida
        document.getElementById('uploadForm').action = `/upload?path=${path}`;

        // Mostrar la ruta actual en la interfaz
        document.getElementById('current-path-display').textContent = path ? path : 'Raíz';

    } catch (error) {
        console.error('Error al cargar archivos:', error);
    }
}


// Navegar a una carpeta
function navigateTo(path) {
    console.log(`Navegando a: ${path}`);
    
    // Actualizamos el historial con la nueva ruta
    if (history[historyIndex] !== path) {
        history.push(path);
        historyIndex = history.length - 1;
    }

    loadFiles(path);  // Cargar los archivos de la nueva carpeta
}

// Volver a la carpeta anterior
function goBack() {
    if (historyIndex > 0) {
        historyIndex--;
        currentPath = history[historyIndex];
        loadFiles(currentPath);
    }
}

// Ir a la carpeta siguiente
function goForward() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        currentPath = history[historyIndex];
        loadFiles(currentPath);
    }
}

// Ir a la raíz
function goToRoot() {
    currentPath = '';
    history.push('');
    historyIndex = history.length - 1;
    loadFiles(currentPath);
}

// Actualizar estado de los botones de navegación
function updateNavigationButtons() {
    document.getElementById('back-btn').disabled = historyIndex <= 0;
    document.getElementById('forward-btn').disabled = historyIndex >= history.length - 1;
}

// Cargar archivos en la raíz al inicio
loadFiles();


// Ruta para manejar la subida de archivos
app.post('/upload', upload.single('file'), (req, res) => {
    const folderPath = req.query.path ? req.query.path : '';  // Ruta de la carpeta donde se subió el archivo
    console.log(`Archivo subido: ${req.file.originalname} en carpeta: ${folderPath}`);

    // Devuelve la ruta donde se subió el archivo para que el frontend pueda mantener la vista
    res.json({ success: true, path: folderPath });
});

// Ruta para eliminar archivos o carpetas
app.post('/delete', (req, res) => {
    const filePath = path.join(rootFolderPath, req.body.path);
    console.log(`Eliminando: ${filePath}`);

    fs.stat(filePath, (err, stats) => {
        if (err) {
            console.error(`Error al verificar la existencia de ${filePath}:`, err);
            return res.status(400).send('Archivo o carpeta no encontrado');
        }

        if (stats.isDirectory()) {
            fs.rmdir(filePath, { recursive: true }, (err) => {
                if (err) {
                    console.error(`Error al eliminar carpeta ${filePath}:`, err);
                    return res.status(500).send('Error al eliminar carpeta');
                }
                console.log(`Carpeta eliminada: ${filePath}`);
                res.sendStatus(200);
            });
        } else {
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error(`Error al eliminar archivo ${filePath}:`, err);
                    return res.status(500).send('Error al eliminar archivo');
                }
                console.log(`Archivo eliminado: ${filePath}`);
                res.sendStatus(200);
            });
        }
    });
});

// Ruta para visualizar archivos de texto
app.get('/view-file', (req, res) => {
    const filePath = path.join(rootFolderPath, req.query.path);
    console.log(`Visualizando archivo: ${filePath}`);

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error(`Error al leer el archivo ${filePath}:`, err);
            return res.status(500).send('Error al leer el archivo');
        }

        console.log(`Archivo leído exitosamente: ${filePath}`);
        res.send(`<pre>${data}</pre><button onclick="window.history.back()">Volver</button>`);
    });
});

// Servidor escuchando
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});

