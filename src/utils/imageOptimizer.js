/**
 * Optimiza una imagen antes de subirla a Supabase Storage.
 * @param {File} file - Archivo original capturado por el input.
 * @param {Object} options
 * @param {number} options.maxWidthPx - Ancho máximo en px (default: 1200).
 * @param {number} options.maxSizeBytes - Peso máximo en bytes (default: 2MB).
 * @param {string} options.outputFormat - 'image/jpeg' | 'image/webp' (default: 'image/jpeg').
 * @param {number} options.initialQuality - Calidad inicial 0–1 (default: 0.8).
 * @returns {Promise<Blob>} Blob optimizado listo para subir.
 */
export async function optimizeImage(file, options = {}) {
    const {
        maxWidthPx = 1200,
        maxSizeBytes = 2 * 1024 * 1024, // 2MB
        outputFormat = 'image/jpeg',
        initialQuality = 0.8
    } = options;

    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            return reject(new Error('El archivo proporcionado no es una imagen.'));
        }

        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Calcular nuevas dimensiones manteniendo aspect ratio
                let width = img.width;
                let height = img.height;

                if (width > maxWidthPx) {
                    const ratio = maxWidthPx / width;
                    width = maxWidthPx;
                    height = height * ratio;
                }

                // Crear canvas
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const attemptCompression = (quality) => {
                    canvas.toBlob((blob) => {
                        if (!blob) {
                            cleanup();
                            return reject(new Error('No se pudo procesar la imagen.'));
                        }

                        if (blob.size <= maxSizeBytes || quality < 0.3) {
                            if (blob.size > maxSizeBytes && quality < 0.3) {
                                cleanup();
                                return reject(new Error('La imagen no puede comprimirse por debajo de 2MB. Intenta con otra foto.'));
                            }
                            cleanup();
                            resolve(blob);
                        } else {
                            attemptCompression(quality - 0.05); // Reducir calidad en pasos de 0.05
                        }
                    }, outputFormat, quality);
                };

                const cleanup = () => {
                    canvas.width = 0;
                    canvas.height = 0;
                    img.src = '';
                };

                attemptCompression(initialQuality);
            };

            img.onerror = () => {
                reject(new Error('Error al cargar la imagen para optimización.'));
            };

            img.src = e.target.result;
        };

        reader.onerror = () => {
            reject(new Error('Error al leer el archivo.'));
        };

        reader.readAsDataURL(file);
    });
}
