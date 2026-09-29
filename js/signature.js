/**
 * Date Receipt Invoice Management System - Signature Canvas Module
 * نظام التوقيع الإلكتروني باللمس والماوس مع دعم رفع صورة التوقيع
 */

class SignaturePad {
    constructor(canvasId, clearBtnId, uploadInputId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.clearBtn = document.getElementById(clearBtnId);
        this.uploadInput = document.getElementById(uploadInputId);
        this.isDrawing = false;
        this.hasSignature = false;

        this.init();
    }

    init() {
        this.setupCanvas();
        this.bindEvents();
    }

    setupCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        // Set higher resolution for retina / crisp lines
        const dpr = window.devicePixelRatio || 1;
        const width = this.canvas.parentElement.clientWidth || 300;
        const height = 120;

        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';

        this.ctx.scale(dpr, dpr);
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.lineWidth = 2.5;
        this.ctx.strokeStyle = '#1a365d'; // Deep royal blue ink color matching the photo
    }

    bindEvents() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        window.addEventListener('mouseup', () => this.stopDrawing());

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startDrawing(e.touches[0]);
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.draw(e.touches[0]);
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopDrawing();
        }, { passive: false });

        // Clear button
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.clear();
            });
        }

        // Upload signature image
        if (this.uploadInput) {
            this.uploadInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        this.loadFromDataURL(event.target.result);
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Window resize
        window.addEventListener('resize', () => {
            const currentData = this.isEmpty() ? null : this.toDataURL();
            this.setupCanvas();
            if (currentData) {
                this.loadFromDataURL(currentData);
            }
        });
    }

    getPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    startDrawing(e) {
        this.isDrawing = true;
        const pos = this.getPos(e);
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
    }

    draw(e) {
        if (!this.isDrawing) return;
        const pos = this.getPos(e);
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();
        this.hasSignature = true;
    }

    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.ctx.closePath();
        }
    }

    clear() {
        const dpr = window.devicePixelRatio || 1;
        this.ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
        this.hasSignature = false;
        if (this.uploadInput) {
            this.uploadInput.value = '';
        }
    }

    isEmpty() {
        return !this.hasSignature;
    }

    toDataURL() {
        if (this.isEmpty()) return '';
        return this.canvas.toDataURL('image/png');
    }

    loadFromDataURL(dataUrl) {
        if (!dataUrl) {
            this.clear();
            return;
        }
        const img = new Image();
        img.onload = () => {
            this.clear();
            const dpr = window.devicePixelRatio || 1;
            const width = this.canvas.width / dpr;
            const height = this.canvas.height / dpr;
            
            // Maintain aspect ratio
            const scale = Math.min(width / img.width, height / img.height, 1);
            const w = img.width * scale;
            const h = img.height * scale;
            const x = (width - w) / 2;
            const y = (height - h) / 2;
            
            this.ctx.drawImage(img, x, y, w, h);
            this.hasSignature = true;
        };
        img.src = dataUrl;
    }
}

window.SignaturePad = SignaturePad;
