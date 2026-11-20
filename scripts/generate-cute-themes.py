"""Draw original bead-native chibi patterns. No raster conversion or external assets."""
from pathlib import Path
import json,math,uuid
OUT=Path(__file__).resolve().parents[1]/'assets/resources/levels'; OUT.mkdir(parents=True,exist_ok=True)
COLORS={
 'K':('D01','可可描边','#49344F'),'W':('W01','奶油白','#FFF4D9'),'w':('W02','暖白阴影','#E6D8CC'),
 'P':('P01','蜜桃粉','#FF8FB5'),'p':('P02','草莓红','#F05D86'),'T':('T01','湖水蓝','#42CDBD'),'t':('T02','深薄荷','#249FAD'),
 'B':('B01','晴空蓝','#62C5F8'),'b':('B02','靛蓝','#5367B7'),'Y':('Y01','布丁黄','#FFD261'),'y':('Y02','焦糖橙','#E59A4B'),
 'O':('O01','橘子糖','#FFAB60'),'o':('O02','奶茶棕','#C88753'),'G':('G01','嫩叶绿','#8ED45D'),'g':('G02','森林绿','#3B9B6A'),
 'L':('L01','葡萄紫','#B098E7'),'l':('L02','紫罗兰','#8563BD'),'N':('N01','夜空蓝','#405574')}
class Art:
 def __init__(self):self.a=[['.' for x in range(28)]for y in range(28)]
 def dot(self,x,y,c):
  if 0<=x<28 and 0<=y<28:self.a[y][x]=c
 def rect(self,x,y,w,h,c):
  for j in range(y,y+h):
   for i in range(x,x+w):self.dot(i,j,c)
 def ellipse(self,x,y,w,h,c):
  for j in range(y,y+h):
   for i in range(x,x+w):
    if ((i+.5-x-w/2)/(w/2))**2+((j+.5-y-h/2)/(h/2))**2<=1:self.dot(i,j,c)
 def oval(self,x,y,w,h,c):self.ellipse(x,y,w,h,'K');self.ellipse(x+1,y+1,w-2,h-2,c)
 def box(self,x,y,w,h,c):
  self.rect(x+2,y,w-4,h,'K');self.rect(x,y+2,w,h-4,'K');self.rect(x+1,y+1,w-2,h-2,'K');self.rect(x+2,y+1,w-4,h-2,c);self.rect(x+1,y+2,w-2,h-4,c)
 def line(self,x,y,x2,y2,c):
  n=max(abs(x2-x),abs(y2-y))
  for i in range(n+1):self.dot(round(x+(x2-x)*i/max(n,1)),round(y+(y2-y)*i/max(n,1)),c)
 def face(self,x=14,y=14,blush=True):
  for dx in [-4,3]:self.rect(x+dx,y,2,3,'K');self.dot(x+dx,y,'W')
  if blush:self.rect(x-6,y+3,3,2,'P');self.rect(x+4,y+3,3,2,'P')
  self.dot(x-1,y+4,'K');self.dot(x+1,y+4,'K');self.dot(x,y+5,'K')
 def star(self,x,y,c='Y'):
  self.dot(x,y-1,c);self.rect(x-1,y,3,1,c);self.dot(x,y+1,c)
 def heart(self,x,y,c='p'):
  for dx,dy in [(0,0),(2,0),(-1,1),(0,1),(1,1),(2,1),(3,1),(0,2),(1,2),(2,2),(1,3)]:self.dot(x+dx,y+dy,c)
 def save(self,id,title,theme,order):
  used=[c for c in COLORS if any(c in row for row in self.a)];ids={c:i+1 for i,c in enumerate(used)}
  assert len(used)<=14,(id,len(used))
  obj=dict(schemaVersion=1,id=id,revision=1,order=order,title=title,themeId=theme,width=28,height=28,palette=[dict(id=ids[c],code=COLORS[c][0],name=COLORS[c][1],hex=COLORS[c][2])for c in used],cells=[ids.get(c,0) for row in self.a for c in row])
  (OUT/(id+'.json')).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
  (OUT/(id+'.json.meta')).write_text(json.dumps(dict(ver='2.0.1',importer='json',imported=True,uuid=str(uuid.uuid5(uuid.NAMESPACE_URL,'bead-studio/'+id)),files=['.json'],subMetas={},userData={}),indent=2)+'\n')
  return obj
arts=[]
# Rabbit: long pink ears, tiny paws, turquoise scarf and carrot.
a=Art();a.oval(6,2,6,13,'W');a.oval(16,1,6,14,'W');a.ellipse(8,4,2,8,'P');a.ellipse(18,3,2,9,'P');a.oval(7,16,14,10,'W');a.oval(4,9,20,14,'W');a.ellipse(5,16,18,6,'w');a.ellipse(6,10,16,10,'W');a.face(14,13);a.box(8,21,12,3,'T');a.rect(17,23,3,3,'t');a.oval(6,23,6,4,'W');a.oval(17,23,6,4,'W');a.star(3,6);a.star(25,13);arts.append(a.save('animal-001','薄荷围巾兔兔','animal',7))
# Cat: peach ears and cream muzzle, lavender bow and curled tail.
a=Art();a.oval(20,18,6,8,'O');a.ellipse(20,20,3,4,'.');a.box(7,16,14,10,'O');a.line(5,11,6,3,'K');a.line(6,3,13,9,'K');a.line(6,5,11,11,'O');a.line(7,6,9,9,'P');a.line(15,9,22,3,'K');a.line(22,3,23,12,'K');a.line(17,10,21,5,'O');a.line(19,9,21,6,'P');a.oval(4,7,20,15,'O');a.ellipse(9,15,10,7,'W');a.rect(7,5,2,4,'O');a.rect(19,5,2,4,'O');a.face(14,11);a.rect(11,7,2,3,'y');a.rect(15,7,2,3,'y');a.rect(2,15,4,1,'K');a.rect(22,15,4,1,'K');a.oval(7,22,6,5,'W');a.oval(15,22,6,5,'W');a.rect(10,21,8,2,'L');a.rect(9,20,3,4,'l');a.rect(16,20,3,4,'l');a.star(25,5);arts.append(a.save('animal-002','蝴蝶结小猫','animal',8))
# Shiba: floppy amber ears, white cheeks and red bandana.
a=Art();a.oval(7,17,14,10,'O');a.oval(3,4,8,11,'o');a.oval(17,4,8,11,'o');a.oval(4,6,20,17,'O');a.ellipse(6,14,16,8,'W');a.rect(8,10,3,1,'W');a.rect(17,10,3,1,'W');a.face(14,12);a.rect(13,16,3,2,'K');a.rect(12,18,5,1,'K');a.rect(9,22,10,2,'p');a.line(11,24,16,24,'p');a.rect(12,25,3,1,'p');a.oval(6,23,6,4,'W');a.oval(17,23,6,4,'W');a.heart(2,1);arts.append(a.save('animal-003','元气柴柴','animal',9))
# Panda hugs bamboo. Round ears, short legs and bright green plant.
a=Art();a.oval(7,16,14,11,'N');a.ellipse(9,18,10,7,'W');a.oval(4,3,7,7,'N');a.oval(17,3,7,7,'N');a.oval(4,5,20,17,'W');a.ellipse(7,10,6,7,'N');a.ellipse(15,10,6,7,'N');a.rect(9,12,2,3,'K');a.dot(9,12,'W');a.rect(17,12,2,3,'K');a.dot(17,12,'W');a.rect(6,17,3,2,'P');a.rect(19,17,3,2,'P');a.rect(13,17,2,1,'K');a.dot(14,18,'K');a.oval(6,23,6,4,'N');a.oval(16,23,6,4,'N');a.rect(20,17,2,9,'g');a.rect(20,20,2,1,'G');a.ellipse(21,16,5,3,'G');a.ellipse(16,18,5,3,'G');a.oval(17,21,5,4,'N');a.star(3,9);arts.append(a.save('animal-004','抱竹竹的熊猫','animal',10))
# Honey bear holds a heart, cream muzzle, tiny paw pads.
a=Art();a.oval(4,3,7,7,'o');a.ellipse(6,5,3,3,'P');a.oval(17,3,7,7,'o');a.ellipse(19,5,3,3,'P');a.oval(7,16,14,10,'O');a.oval(4,5,20,16,'O');a.ellipse(9,13,10,7,'W');a.face(14,10);a.rect(13,14,2,1,'o');a.oval(5,22,7,5,'O');a.oval(16,22,7,5,'O');a.rect(8,24,2,1,'P');a.rect(18,24,2,1,'P');a.heart(12,20,'p');a.oval(5,19,6,5,'O');a.oval(17,19,6,5,'O');a.star(25,11);arts.append(a.save('animal-005','爱心小熊','animal',11))
# Penguin with blue cap, white belly and little orange feet.
a=Art();a.oval(3,15,7,10,'N');a.oval(18,15,7,10,'N');a.oval(5,5,18,21,'N');a.ellipse(8,10,12,15,'W');a.ellipse(7,9,7,10,'W');a.ellipse(14,9,7,10,'W');a.face(14,12);a.rect(12,16,4,2,'Y');a.rect(13,18,2,1,'O');a.oval(6,24,7,4,'Y');a.oval(15,24,7,4,'Y');a.box(6,3,16,7,'B');a.rect(5,8,18,3,'b');a.ellipse(11,0,6,5,'P');a.rect(8,4,2,3,'W');a.star(25,5);arts.append(a.save('animal-006','蓝帽小企鹅','animal',12))
# Strawberry milk tea with a friendly cup, floating tapioca pearls.
a=Art();a.rect(17,1,3,10,'K');a.rect(18,2,1,9,'P');a.box(6,8,16,17,'P');a.rect(8,11,12,11,'W');a.rect(8,19,12,4,'O');a.rect(7,23,14,2,'p');a.box(4,6,20,5,'T');a.rect(7,7,14,1,'W');a.face(14,12);a.rect(10,21,2,2,'K');a.rect(16,21,2,2,'K');a.dot(14,20,'K');a.star(3,13);a.heart(23,3);arts.append(a.save('daily-001','草莓啵啵奶茶','daily',13))
# Mint camera with big glass lens and strawberry grip.
a=Art();a.box(10,4,8,5,'T');a.rect(19,6,4,2,'p');a.box(2,8,24,16,'T');a.rect(3,18,22,4,'t');a.box(5,10,5,4,'W');a.rect(6,11,3,1,'Y');a.oval(9,10,13,13,'W');a.oval(11,12,9,9,'b');a.ellipse(13,14,5,5,'B');a.rect(13,14,2,2,'W');a.rect(22,11,2,3,'P');a.rect(5,17,2,2,'K');a.rect(22,17,2,2,'K');a.rect(4,20,3,1,'P');a.rect(22,20,2,1,'P');a.dot(7,21,'K');a.star(3,4);arts.append(a.save('daily-002','薄荷拍立得','daily',14))
# Lavender pocket console. Screen contains a face, pink buttons and d-pad.
a=Art();a.box(5,2,18,25,'L');a.rect(7,24,14,2,'l');a.box(7,5,14,12,'b');a.rect(9,7,10,8,'T');a.rect(10,9,2,2,'K');a.rect(16,9,2,2,'K');a.rect(11,12,2,1,'P');a.rect(17,12,1,1,'P');a.rect(13,13,3,1,'K');a.rect(9,18,2,6,'K');a.rect(7,20,6,2,'K');a.ellipse(16,19,3,3,'p');a.ellipse(20,17,2,3,'P');a.rect(15,24,4,1,'K');a.star(2,9);a.star(25,6);arts.append(a.save('daily-003','心动游戏机','daily',15))
# Smiling pink flower in an orange pot; chunky leaf silhouettes.
a=Art();a.rect(13,10,2,10,'g');a.ellipse(6,11,8,4,'G');a.line(7,11,12,14,'g');a.ellipse(14,10,8,5,'G');a.line(15,14,20,11,'g');a.oval(10,1,8,7,'p');a.oval(6,5,8,7,'p');a.oval(14,5,8,7,'p');a.oval(10,9,8,7,'p');a.oval(10,5,8,7,'Y');a.rect(12,7,1,2,'K');a.rect(16,7,1,2,'K');a.rect(13,10,3,1,'O');a.box(7,18,14,8,'O');a.rect(9,24,10,1,'y');a.box(6,17,16,4,'Y');a.rect(10,22,2,2,'K');a.rect(17,22,2,2,'K');a.rect(13,24,3,1,'K');a.star(24,14);arts.append(a.save('daily-004','微笑花花盆栽','daily',16))
# Bunny alarm clock, cream face, little heart hands, pink bells.
a=Art();a.oval(3,2,8,7,'P');a.oval(17,2,8,7,'P');a.rect(12,2,4,2,'K');a.line(7,21,5,26,'K');a.line(20,21,22,26,'K');a.oval(3,5,22,20,'P');a.oval(5,7,18,16,'W');a.rect(13,8,2,2,'y');a.rect(6,14,2,2,'y');a.rect(20,14,2,2,'y');a.rect(13,21,2,1,'y');a.line(14,15,14,10,'K');a.line(14,15,18,13,'K');a.rect(13,14,3,3,'p');a.rect(8,17,2,2,'K');a.rect(18,17,2,2,'K');a.rect(7,20,3,1,'P');a.rect(18,20,3,1,'P');a.dot(13,20,'K');a.dot(15,20,'K');a.dot(14,21,'K');a.star(25,10);arts.append(a.save('daily-005','早安兔兔闹钟','daily',17))
# Sunny backpack with a face pocket, buckles and a small flower badge.
a=Art();a.box(9,1,10,7,'T');a.rect(12,3,4,3,'.');a.box(2,12,5,12,'T');a.box(21,12,5,12,'T');a.box(5,5,18,22,'Y');a.rect(7,6,2,11,'W');a.rect(20,8,2,16,'y');a.box(8,16,12,9,'T');a.rect(9,17,10,1,'W');a.rect(10,20,2,2,'K');a.rect(16,20,2,2,'K');a.rect(9,22,3,1,'P');a.rect(16,22,3,1,'P');a.rect(13,23,2,1,'K');a.rect(11,11,6,2,'o');a.rect(11,10,2,4,'O');a.rect(15,10,2,4,'O');a.heart(18,7,'p');a.star(2,5);arts.append(a.save('daily-006','向日葵小书包','daily',18))
# An SVG catalog renders the exact cells used by the game, for visual review.
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="850" viewBox="0 0 1200 850"><rect width="1200" height="850" fill="#ecf6ff"/><text x="40" y="45" font-family="sans-serif" font-size="26" font-weight="bold" fill="#49344f">云上新朋友 · 12 张新关卡图纸</text>']
for i,l in enumerate(arts):
 x=28+(i%6)*198;y=80+(i//6)*370;pal={c['id']:c['hex']for c in l['palette']}
 svg.append(f'<rect x="{x}" y="{y}" width="186" height="330" rx="20" fill="white"/>')
 for idx,c in enumerate(l['cells']):
  if c:svg.append(f'<rect x="{x+9+idx%28*6}" y="{y+30+idx//28*6}" width="6" height="6" fill="{pal[c]}"/>')
 svg.append(f'<text x="{x+93}" y="{y+235}" text-anchor="middle" font-family="sans-serif" font-size="17" fill="#49344f">{l["title"]}</text><text x="{x+93}" y="{y+266}" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#777">{len([c for c in l["cells"]if c])} 颗 · {len(l["palette"])} 色</text>')
svg.append('</svg>');Path('/private/tmp/pindou-new-themes.svg').write_text(''.join(svg))
print([(l['id'],l['title'],len([v for v in l['cells']if v]),len(l['palette']))for l in arts])
