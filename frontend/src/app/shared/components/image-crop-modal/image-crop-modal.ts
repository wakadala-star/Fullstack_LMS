import { Component, ElementRef, EventEmitter, Input, Output, signal, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-image-crop-modal',
  templateUrl: './image-crop-modal.html',
  styleUrl: './image-crop-modal.css'
})
export class ImageCropModalComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() imageFile!: File;
  @Output() cropComplete = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<void>();

  isCropping = signal(false);

  private ctx!: CanvasRenderingContext2D;
  private img = new Image();
  private canvasWidth = 320;
  private canvasHeight = 320;

  private cropX = 0;
  private cropY = 0;
  private cropSize = 0;
  private isDragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private imageLoaded = false;

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = this.canvasWidth;
    canvas.height = this.canvasHeight;
    this.ctx = canvas.getContext('2d')!;
    this.loadImage();
  }

  ngOnDestroy() {
    URL.revokeObjectURL(this.img.src);
  }

  private loadImage() {
    const url = URL.createObjectURL(this.imageFile);
    this.img.onload = () => {
      this.imageLoaded = true;
      this.fitImageToCanvas();
      this.setupEvents();
      this.draw();
    };
    this.img.src = url;
  }

  private fitImageToCanvas() {
    const scale = Math.min(
      this.canvasWidth / this.img.naturalWidth,
      this.canvasHeight / this.img.naturalHeight
    ) * 0.85;
    const w = this.img.naturalWidth * scale;
    const h = this.img.naturalHeight * scale;
    this.cropSize = Math.min(w, h) * 0.8;
    this.cropX = (this.canvasWidth - this.cropSize) / 2;
    this.cropY = (this.canvasHeight - this.cropSize) / 2;
  }

  private setupEvents() {
    const canvas = this.canvasRef.nativeElement;

    canvas.addEventListener('mousedown', (e) => this.onPointerDown(e.offsetX, e.offsetY));
    canvas.addEventListener('mousemove', (e) => this.onPointerMove(e.offsetX, e.offsetY));
    canvas.addEventListener('mouseup', () => this.onPointerUp());
    canvas.addEventListener('mouseleave', () => this.onPointerUp());

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      this.onPointerDown(touch.clientX - rect.left, touch.clientY - rect.top);
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      this.onPointerMove(touch.clientX - rect.left, touch.clientY - rect.top);
    }, { passive: false });
    canvas.addEventListener('touchend', () => this.onPointerUp());
  }

  private onPointerDown(x: number, y: number) {
    if (
      x >= this.cropX && x <= this.cropX + this.cropSize &&
      y >= this.cropY && y <= this.cropY + this.cropSize
    ) {
      this.isDragging = true;
      this.dragOffsetX = x - this.cropX;
      this.dragOffsetY = y - this.cropY;
    }
  }

  private onPointerMove(x: number, y: number) {
    if (!this.isDragging) return;
    this.cropX = Math.max(0, Math.min(this.canvasWidth - this.cropSize, x - this.dragOffsetX));
    this.cropY = Math.max(0, Math.min(this.canvasHeight - this.cropSize, y - this.dragOffsetY));
    this.draw();
  }

  private onPointerUp() {
    this.isDragging = false;
  }

  private draw() {
    const ctx = this.ctx;
    const canvas = this.canvasRef.nativeElement;

    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    const scale = Math.min(
      this.canvasWidth / this.img.naturalWidth,
      this.canvasHeight / this.img.naturalHeight
    ) * 0.85;
    const drawW = this.img.naturalWidth * scale;
    const drawH = this.img.naturalHeight * scale;
    const drawX = (this.canvasWidth - drawW) / 2;
    const drawY = (this.canvasHeight - drawH) / 2;

    ctx.drawImage(this.img, drawX, drawY, drawW, drawH);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    ctx.save();
    ctx.beginPath();
    ctx.rect(this.cropX, this.cropY, this.cropSize, this.cropSize);
    ctx.clip();
    ctx.drawImage(this.img, drawX, drawY, drawW, drawH);
    ctx.restore();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.cropX, this.cropY, this.cropSize, this.cropSize);

    const third = this.cropSize / 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.cropX + third, this.cropY);
    ctx.lineTo(this.cropX + third, this.cropY + this.cropSize);
    ctx.moveTo(this.cropX + third * 2, this.cropY);
    ctx.lineTo(this.cropX + third * 2, this.cropY + this.cropSize);
    ctx.moveTo(this.cropX, this.cropY + third);
    ctx.lineTo(this.cropX + this.cropSize, this.cropY + third);
    ctx.moveTo(this.cropX, this.cropY + third * 2);
    ctx.lineTo(this.cropX + this.cropSize, this.cropY + third * 2);
    ctx.stroke();

    const cornerLen = 14;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    const corners: [number, number, number, number, number, number][] = [
      [this.cropX, this.cropY + cornerLen, this.cropX, this.cropY, this.cropX + cornerLen, this.cropY],
      [this.cropX + this.cropSize - cornerLen, this.cropY, this.cropX + this.cropSize, this.cropY, this.cropX + this.cropSize, this.cropY + cornerLen],
      [this.cropX + this.cropSize, this.cropY + this.cropSize - cornerLen, this.cropX + this.cropSize, this.cropY + this.cropSize, this.cropX + this.cropSize - cornerLen, this.cropY + this.cropSize],
      [this.cropX + cornerLen, this.cropY + this.cropSize, this.cropX, this.cropY + this.cropSize, this.cropX, this.cropY + this.cropSize - cornerLen],
    ];
    for (const c of corners) {
      ctx.beginPath();
      ctx.moveTo(c[0], c[1]);
      ctx.lineTo(c[2], c[3]);
      ctx.lineTo(c[4], c[5]);
      ctx.stroke();
    }
  }

  onCrop() {
    if (!this.imageLoaded) return;
    this.isCropping.set(true);

    const scale = Math.min(
      this.canvasWidth / this.img.naturalWidth,
      this.canvasHeight / this.img.naturalHeight
    ) * 0.85;
    const drawW = this.img.naturalWidth * scale;
    const drawH = this.img.naturalHeight * scale;
    const drawX = (this.canvasWidth - drawW) / 2;
    const drawY = (this.canvasHeight - drawH) / 2;

    const srcCropX = (this.cropX - drawX) / scale;
    const srcCropY = (this.cropY - drawY) / scale;
    const srcCropSize = this.cropSize / scale;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = 400;
    outCanvas.height = 400;
    const outCtx = outCanvas.getContext('2d')!;
    outCtx.drawImage(
      this.img,
      srcCropX, srcCropY, srcCropSize, srcCropSize,
      0, 0, 400, 400
    );

    const base64 = outCanvas.toDataURL('image/jpeg', 0.9);
    this.cropComplete.emit(base64);
  }

  onCancel() {
    this.cancel.emit();
  }
}
