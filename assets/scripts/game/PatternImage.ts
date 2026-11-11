import { _decorator, Component, Node, Sprite, SpriteFrame, Texture2D, UITransform } from 'cc';
import type { ImagePixels } from '../core/ImagePattern';

@_decorator.ccclass('PatternImage')
export class PatternImage extends Component {
  private frame?: SpriteFrame;
  private texture?: Texture2D;

  static show(node: Node, image: ImagePixels, width: number, height: number): void {
    const imageView = node.addComponent(PatternImage);
    imageView.texture = new Texture2D();
    imageView.texture.reset({ width: image.width, height: image.height, format: Texture2D.PixelFormat.RGBA8888 });
    imageView.texture.uploadData(image.data);
    imageView.frame = new SpriteFrame();
    imageView.frame.texture = imageView.texture;
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = imageView.frame;
    const ratio = Math.min(width / image.width, height / image.height);
    node.getComponent(UITransform)!.setContentSize(image.width * ratio, image.height * ratio);
  }

  onDestroy(): void {
    this.frame?.destroy();
    this.texture?.destroy();
  }
}
