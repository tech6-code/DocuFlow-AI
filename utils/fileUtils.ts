
// Define a shape that matches what the components expect (Part from @google/genai)
export interface Part {
    inlineData: {
        mimeType: string;
        data: string;
    };
}

export const fileToPart = (file: File): Promise<Part> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const result = event.target?.result as string;
            const base64 = result.split(',')[1];
            resolve({ inlineData: { data: base64, mimeType: file.type || 'image/jpeg' } });
        };
        reader.onerror = reject;
    });
};

const fileToJpegPart = (file: File): Promise<Part> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            if (!event.target?.result) return reject(new Error('Could not read file.'));
            const img = new Image();
            img.src = event.target.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;
                const MAX_DIM = 1800;
                if (width > height) {
                    if (width > MAX_DIM) {
                        height *= MAX_DIM / width;
                        width = MAX_DIM;
                    }
                } else if (height > MAX_DIM) {
                    width *= MAX_DIM / height;
                    height = MAX_DIM;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('Could not get canvas context.'));
                ctx.drawImage(img, 0, 0, width, height);
                const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
                resolve({ inlineData: { data: base64, mimeType: 'image/jpeg' } });
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

export const convertFileToParts = async (file: File): Promise<Part[]> => {
    if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        // @ts-ignore
        if (typeof window !== 'undefined' && window.pdfjsLib) {
            // @ts-ignore
            const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const parts: Part[] = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 2.0 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                if (context) {
                    await page.render({ canvasContext: context, viewport }).promise;
                    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
                    parts.push({ inlineData: { data: base64, mimeType: 'image/jpeg' } });
                }
            }
            return parts;
        } else {
            // Fallback if pdfjsLib is not loaded, though it should be in index.html or imported.
            console.warn("pdfjsLib not found, falling back to simple file read");
            return [await fileToPart(file)];
        }
    } else if (file.type.startsWith('image/')) {
        try {
            return [await fileToJpegPart(file)];
        } catch (error) {
            console.warn("Image compression failed, falling back to raw image data.", error);
            return [await fileToPart(file)];
        }
    } else {
        return [await fileToPart(file)];
    }
};

export const generatePreviewUrls = async (files: File[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of files) {
        if (file.type === 'application/pdf') {
            try {
                const arrayBuffer = await file.arrayBuffer();
                // @ts-ignore
                if (typeof window !== 'undefined' && window.pdfjsLib) {
                    // @ts-ignore
                    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const viewport = page.getViewport({ scale: 1.5 });
                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d');
                        canvas.width = viewport.width;
                        canvas.height = viewport.height;
                        if (context) {
                            await page.render({ canvasContext: context, viewport }).promise;
                            urls.push(canvas.toDataURL('image/jpeg', 0.8));
                        }
                    }
                } else {
                    urls.push('error-pdf-lib-missing');
                }
            } catch (e) {
                console.error("Error generating PDF preview", e);
                urls.push('error-pdf');
            }
        } else if (file.type.startsWith('image/')) {
            urls.push(URL.createObjectURL(file));
        } else {
            urls.push('error-unsupported');
        }
    }
    return urls;
};
