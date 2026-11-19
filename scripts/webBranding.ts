/** The initial web loading view shares the actual in-game scene and logo assets. */
export function brandWebPage(html:string):string {
 if(!html.includes('GameCanvas'))throw new Error('网页入口缺少 GameCanvas，拒绝覆盖');
 if(html.includes('id="bead-welcome"'))return html;
 const welcome=`
<style>
@font-face{font-family:TownQ;src:url('q-font.ttf') format('truetype');font-display:swap}body{background:#087af3!important}
#bead-welcome{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;overflow:hidden;background:#087af3 url('pixel-world.png') center/cover no-repeat;image-rendering:pixelated;color:#fff4ce;font-family:TownQ,sans-serif;transition:opacity .2s}
#bead-welcome *{box-sizing:border-box}
.welcome-logo{position:absolute;top:9%;width:min(90vw,360px);height:auto;image-rendering:pixelated}
.welcome-sub{position:absolute;top:25%;font-size:13px;font-weight:bold;letter-spacing:1px;text-shadow:2px 2px #15317c,-1px -1px #15317c}
.welcome-ticket{width:min(84vw,330px);text-align:center;margin:0 0 max(35px,env(safe-area-inset-bottom));padding:17px 15px;background:#16367cec;border:4px solid #90d9ff;box-shadow:5px 5px #13174e}
.welcome-dots{display:flex;justify-content:center;gap:9px;margin-bottom:15px}.welcome-dots i{width:12px;height:12px;background:#ffdc59;box-shadow:2px 2px #bb7744;animation:welcome-dot 1.2s steps(3) infinite}.welcome-dots i:nth-child(2){animation-delay:.15s}.welcome-dots i:nth-child(3){animation-delay:.3s}
#welcome-status{font-size:13px;line-height:1.6;margin:8px 0}.welcome-hint{color:#a5dcff;font-size:10px;margin:10px 0 0}
#welcome-retry{margin:15px auto 0;padding:11px 24px;border:3px solid #8e3554;box-shadow:3px 3px #101b65;background:#ff713c;color:#fff7db;font:inherit;font-weight:bold;cursor:pointer}#welcome-retry[hidden]{display:none}
.welcome-out{opacity:0;pointer-events:none}
@keyframes welcome-dot{50%{transform:translateY(-5px)}}
@media(prefers-reduced-motion:reduce){.welcome-dots i{animation:none}#bead-welcome{transition:none}}
@media(min-aspect-ratio:1/1){#bead-welcome{background-image:url('pixel-world-wide.png');background-size:cover;background-color:#087af3}}
@media(max-height:560px){.welcome-logo{top:5%;width:260px}.welcome-sub{top:26%}.welcome-ticket{padding:8px 15px;margin-bottom:15px}.welcome-hint{display:none}}
</style>
<section id="bead-welcome" aria-label="拼拼豆豆儿正在加载">
<img class="welcome-logo" src="pixel-title.png" alt="拼拼豆豆儿">
<p class="welcome-sub">一颗颗拼出你的小世界</p>
<div class="welcome-ticket">
<div class="welcome-dots" aria-hidden="true"><i></i><i></i><i></i></div>
<p id="welcome-status" role="status" aria-live="polite">正在前往云上小岛…</p>
<p class="welcome-hint">进度保存在本机，随时回来接着拼</p>
<button id="welcome-retry" hidden type="button">重新出发</button>
</div></section>
<script>
(function(){
 var layer=document.getElementById('bead-welcome'),status=document.getElementById('welcome-status'),retry=document.getElementById('welcome-retry');
 retry.onclick=function(){location.reload()};
 var slow=setTimeout(function(){if(layer.isConnected){status.textContent='打开较慢或加载遇到问题，可以重试';retry.hidden=false;}},20000);
 function failed(){clearTimeout(slow);status.textContent='小岛暂时没打开，请检查网络后重试';retry.hidden=false;}
 function resourceError(e){if(e.target&&e.target.tagName==='SCRIPT')failed();}
 window.addEventListener('bead-boot-error',failed);window.addEventListener('error',resourceError,true);
 window.addEventListener('bead-game-ready',function(){clearTimeout(slow);layer.classList.add('welcome-out');setTimeout(function(){layer.remove();window.removeEventListener('bead-boot-error',failed);window.removeEventListener('error',resourceError,true);},220);},{once:true});
})();
</script>`;
 return html.replace(/<title>[^<]*<\/title>/,'<title>拼拼豆豆儿 · 云上像素冒险</title>').replace(/<body([^>]*)>/,`<body$1>${welcome}`).replace('console.error(err);',"console.error(err);window.dispatchEvent(new Event('bead-boot-error'));");
}
