import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check } from 'lucide-react';
import './ImageCropper.css';

interface ImageCropperProps {
    imageSrc: string;
    onCropComplete: (croppedImageBlob: Blob) => void;
    onCancel: () => void;
}

export function ImageCropper({ imageSrc, onCropComplete, onCancel }: ImageCropperProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    const onCropChange = (crop: { x: number; y: number }) => {
        setCrop(crop);
    };

    const onZoomChange = (zoom: number) => {
        setZoom(zoom);
    };

    const onCropCompleteHandler = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const createImage = (url: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
            const image = new Image();
            image.addEventListener('load', () => resolve(image));
            image.addEventListener('error', (error) => reject(error));
            image.setAttribute('crossOrigin', 'anonymous');
            image.src = url;
        });

    const getCroppedImg = async (
        imageSrc: string,
        pixelCrop: any,
        rotation = 0
    ): Promise<Blob | null> => {
        const image = await createImage(imageSrc);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            return null;
        }

        const maxSize = Math.max(image.width, image.height);
        const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

        canvas.width = safeArea;
        canvas.height = safeArea;

        ctx.translate(safeArea / 2, safeArea / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-safeArea / 2, -safeArea / 2);

        ctx.drawImage(
            image,
            safeArea / 2 - image.width * 0.5,
            safeArea / 2 - image.height * 0.5
        );

        const data = ctx.getImageData(
            0,
            0,
            safeArea,
            safeArea
        );

        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;

        ctx.putImageData(
            data,
            0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x,
            0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y
        );

        // Resizing to avoid huge files if unnecessary, but keeping quality high
        // Or strictly cutting to the crop
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = pixelCrop.width;
        croppedCanvas.height = pixelCrop.height;
        const croppedCtx = croppedCanvas.getContext('2d');

        if (!croppedCtx) return null;

        croppedCtx.drawImage(
            canvas,
            0,
            0,
            canvas.width,
            canvas.height,
            0,
            0,
            pixelCrop.width,
            pixelCrop.height
        );

        return new Promise((resolve) => {
            croppedCanvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg', 0.9);
        });
    };

    const handleSave = async () => {
        try {
            const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels, 0);
            if (croppedImageBlob) {
                onCropComplete(croppedImageBlob);
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="cropper-overlay">
            <div className="cropper-container">
                <div className="cropper-header">
                    <h3>Ajustar Foto</h3>
                    <button className="close-btn" onClick={onCancel}>
                        <X size={20} />
                    </button>
                </div>

                <div className="cropper-area">
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        cropShape="round"
                        showGrid={false}
                        onCropChange={onCropChange}
                        onZoomChange={onZoomChange}
                        onCropComplete={onCropCompleteHandler}
                    />
                </div>

                <div className="cropper-controls">
                    <div className="zoom-control">
                        <span className="control-label">Zoom</span>
                        <input
                            type="range"
                            value={zoom}
                            min={1}
                            max={3}
                            step={0.1}
                            aria-labelledby="Zoom"
                            onChange={(e) => {
                                setZoom(Number(e.target.value));
                            }}
                            className="zoom-range"
                        />
                    </div>

                    <button className="btn btn-primary save-crop-btn" onClick={handleSave}>
                        <Check size={18} />
                        Salvar Foto
                    </button>
                </div>
            </div>
        </div>
    );
}
