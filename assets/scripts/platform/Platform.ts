import { sys } from 'cc';
import { StoragePort } from '../core/SaveRepository';
interface WxPort {
  getStorageSync(key: string): unknown; setStorageSync(key: string, value: string): void;
  getWindowInfo?(): { windowWidth: number; windowHeight: number; safeArea?: { top: number; bottom: number } };
}
export class PlatformStorage implements StoragePort {
  private wx = (globalThis as unknown as { wx?: WxPort }).wx;
  get(key: string): string | null {
    const result = this.wx ? this.wx.getStorageSync(key) : sys.localStorage.getItem(key);
    if (result == null || result === '') return null;
    if (typeof result !== 'string') throw new Error('存储格式无效');
    return result;
  }
  set(key: string, value: string): void { if (this.wx) this.wx.setStorageSync(key,value); else sys.localStorage.setItem(key,value); }
  safeInsets(logicalWidth: number): { top: number; bottom: number } {
    const info = this.wx?.getWindowInfo?.();
    if (!info?.safeArea) return { top: 0, bottom: 0 };
    const ratio=logicalWidth/info.windowWidth;
    return { top: info.safeArea.top*ratio, bottom: Math.max(0,info.windowHeight-info.safeArea.bottom)*ratio };
  }
}
