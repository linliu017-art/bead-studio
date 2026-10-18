import { existsSync, readFileSync, mkdirSync, createWriteStream } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];
if (!['web', 'wechat'].includes(target)) throw new Error('Usage: node scripts/build.mjs web|wechat');
const editor = process.env.COCOS_EDITOR || resolve(root, '.tools/CocosCreator.app/Contents/MacOS/CocosCreator');
if (!existsSync(editor)) throw new Error('请安装 Cocos Creator 3.8.8，并把 COCOS_EDITOR 设置为编辑器可执行文件的绝对路径。');
const config = resolve(root, 'config', target === 'web' ? 'build-web.json' : 'build-wechat.test.json');
const output = resolve(root, 'build', target === 'web' ? 'first-level' : 'wechatgame');
mkdirSync(resolve(root, 'logs'), { recursive: true });
const log = createWriteStream(resolve(root, 'logs', `build-${target}.log`));
const child = spawn(editor, ['--project', root, '--build', `configPath=${config}`], { cwd: root });
let capture = '';
for (const stream of [child.stdout, child.stderr]) stream.on('data', bytes => { log.write(bytes); capture += bytes.toString(); });
child.on('error', error => { log.end(); console.error(error.message); process.exitCode = 1; });
child.on('close', code => {
  log.end();
  try {
    // Creator uses 36 for a successful command-line build.
    if (code !== 36) throw new Error(`Cocos 构建退出码 ${code}，请检查 logs/build-${target}.log`);
    if (/Can not find the importer |当前初始场景不存在/.test(capture)) throw new Error('资源导入未就绪，拒绝交付不完整构建。');
    const settingsPath = resolve(output, 'src/settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    if (!settings.engine?.builtinAssets?.length || !settings.launch?.launchScene) throw new Error('构建缺少引擎资源或启动场景。');
    const scene = JSON.parse(readFileSync(resolve(root, 'assets/scenes/Game.scene.meta'), 'utf8'));
    if (scene.importer !== 'scene') throw new Error('场景导入器异常。');
    if (target === 'wechat' && !existsSync(resolve(output, 'game.js'))) throw new Error('微信入口缺失。');
    console.log(`已导出 ${output}\n资源完整性检查通过；请继续执行实际试玩。`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
});
