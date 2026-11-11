import type { ImagePixels } from '../core/ImagePattern';

interface NativeImage {
  width: number;
  height: number;
  src: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
}

type PickerRequest<Result> = {
  count: number;
  sourceType: ['album'];
  success(result: Result): void;
  fail(error: { errMsg?: string }): void;
};
interface WeChatImagePort {
  chooseMedia?(options: PickerRequest<{ tempFiles: { tempFilePath: string; size: number }[] }> & {
    mediaType: ['image']; sizeType: ['original'];
  }): void;
  chooseImage?(options: PickerRequest<{ tempFilePaths: string[]; tempFiles?: { size: number }[] }> & {
    sizeType: ['original'];
  }): void;
  createCanvas?(): HTMLCanvasElement;
  createImage?(): NativeImage;
}

const maxBytes = 20 * 1024 * 1024;
const getWeChat = (): WeChatImagePort | undefined => (globalThis as { wx?: WeChatImagePort }).wx;

export function canPickPatternImage(): boolean {
  const wx = getWeChat();
  if (wx) return Boolean((wx.chooseMedia || wx.chooseImage) && wx.createCanvas && wx.createImage);
  return typeof document !== 'undefined' && typeof URL.createObjectURL === 'function';
}

function decode(image: NativeImage, src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('图片打不开，请换一张 JPG 或 PNG'));
    image.src = src;
  });
}

function pixels(canvas: HTMLCanvasElement, image: NativeImage, width: number, height: number): ImagePixels {
  if (!width || !height || width * height > 32_000_000) throw new Error('图片太大，请选择较小的图片');
  const ratio = Math.min(1, 512 / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前设备无法读取图片');
  context.drawImage(image as unknown as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  const result = context.getImageData(0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height, data: result.data };
}

function chooseBrowserFile(): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.hidden = true;
    const finish = (): void => {
      const file = input.files?.[0] ?? null;
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', finish, { once: true });
    input.addEventListener('cancel', finish, { once: true });
    document.body.append(input);
    input.click();
  });
}

function chooseWeChatFile(wx: WeChatImagePort): Promise<{ path: string; size: number } | null> {
  return new Promise((resolve, reject) => {
    const fail = (error: { errMsg?: string }): void => {
      if (/cancel/i.test(error.errMsg ?? '')) resolve(null);
      else reject(new Error('无法打开相册，请检查权限后重试'));
    };
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1, sourceType: ['album'], mediaType: ['image'], sizeType: ['original'], fail,
        success: ({ tempFiles }) => resolve(tempFiles[0] ? { path: tempFiles[0].tempFilePath, size: tempFiles[0].size } : null),
      });
    } else if (wx.chooseImage) {
      wx.chooseImage({
        count: 1, sourceType: ['album'], sizeType: ['original'], fail,
        success: ({ tempFilePaths, tempFiles }) => resolve(tempFilePaths[0] ? {
          path: tempFilePaths[0], size: tempFiles?.[0]?.size ?? 0,
        } : null),
      });
    } else {
      reject(new Error('当前设备无法打开相册'));
    }
  });
}

export async function pickPatternImage(): Promise<{ title: string; image: ImagePixels } | null> {
  const wx = getWeChat();
  if (wx) {
    if (!wx.createImage || !wx.createCanvas) throw new Error('当前设备无法读取图片');
    const file = await chooseWeChatFile(wx);
    if (!file) return null;
    if (file.size > maxBytes) throw new Error('图片超过 20 MB，请换一张');
    const image = wx.createImage();
    await decode(image, file.path);
    return { title: '我的图纸', image: pixels(wx.createCanvas(), image, image.width, image.height) };
  }

  const file = await chooseBrowserFile();
  if (!file) return null;
  if (file.size > maxBytes) throw new Error('图片超过 20 MB，请换一张');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await decode(image as unknown as NativeImage, url);
    const title = file.name.replace(/\.[^.]+$/, '').trim().slice(0, 28) || '我的图纸';
    return {
      title,
      image: pixels(document.createElement('canvas'), image as unknown as NativeImage, image.naturalWidth, image.naturalHeight),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
