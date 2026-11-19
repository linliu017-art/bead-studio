/** Shared vector illustrations for the web welcome screen and the Cocos town. */
export type Animal = 'bunny' | 'bear' | 'cat';
export type Shape =
  | { kind: 'ellipse'; x: number; y: number; rx: number; ry: number; fill: string; stroke?: string }
  | { kind: 'box'; x: number; y: number; w: number; h: number; r: number; fill: string; stroke?: string }
  | { kind: 'path'; points: number[][]; fill?: string; stroke?: string; width?: number; closed?: boolean };
const ink = '#825c50';
export function illustration(type: Animal | 'party' | 'flower' | 'beads'): Shape[] {
  const s: Shape[] = [];
  const oval = (x:number,y:number,rx:number,ry:number,fill:string,stroke?:string) => s.push({kind:'ellipse',x,y,rx,ry,fill,stroke});
  const box = (x:number,y:number,w:number,h:number,r:number,fill:string,stroke?:string) => s.push({kind:'box',x,y,w,h,r,fill,stroke});
  const path = (points:number[][],fill?:string,stroke?:string,width=1.7) => s.push({kind:'path',points,fill,stroke,width,closed:!!fill});
  const bead = (x:number,y:number,r:number,fill:string) => {
    oval(x,y+1.7,r,r, '#d9bca2'); oval(x,y,r,r,fill); oval(x-1,y-1,r*.3,r*.3,'#fff6df');
    oval(x-r*.33,y-r*.4,r*.18,r*.12,'#ffffff');
  };
  const flower = (x:number,y:number,r:number,fill:string) => {
    for(let i=0;i<5;i++){const a=i*Math.PI*.4-Math.PI/2;oval(x+Math.cos(a)*r*.6,y+Math.sin(a)*r*.6,r*.42,r*.42,fill);}
    oval(x,y,r*.32,r*.32,'#f6c567');
  };
  const animal = (kind:Animal,x:number,y:number,k=1) => {
    const start=s.length;
    const fur=kind==='bear'?'#d6a176':kind==='cat'?'#ffdda2':'#fffaf0';
    oval(0,40,31,7,'#d5b793');
    oval(0,16,24,29,fur,ink);
    oval(0,22,15,18,kind==='bear'?'#ffe4b7':'#fff4de');
    oval(-17,36,11,7,fur,ink); oval(17,36,11,7,fur,ink);
    if(kind==='bunny'){
      oval(-15,-48,10,28,fur,ink);oval(15,-48,10,28,fur,ink);
      oval(-15,-49,4.5,19,'#f7b8b3');oval(15,-49,4.5,19,'#f7b8b3');
    }else if(kind==='bear'){
      oval(-25,-35,12,12,fur,ink);oval(25,-35,12,12,fur,ink);
      oval(-25,-35,6,6,'#edbd9b');oval(25,-35,6,6,'#edbd9b');
    }else{
      path([[-30,-19],[-29,-51],[-9,-34]],fur,ink);path([[9,-34],[29,-51],[30,-19]],fur,ink);
      path([[-24,-25],[-24,-41],[-14,-31]],'#f7b8b3');path([[14,-31],[24,-41],[24,-25]],'#f7b8b3');
    }
    oval(0,-16,35,29,fur,ink);
    if(kind==='cat'){
      path([[-6,-43],[-3,-32],[0,-42]],'#d99d64');path([[6,-42],[9,-32],[12,-40]],'#d99d64');
    }
    oval(-23,-9,8,4.3,'#efaaa1');oval(23,-9,8,4.3,'#efaaa1');
    if(kind==='bear')oval(0,-6,13,10,'#ffe6bd');
    oval(-12,-20,3.1,4.2,ink);oval(12,-20,3.1,4.2,ink);
    oval(-12.6,-21.7,.9,1,'#ffffff');oval(11.4,-21.7,.9,1,'#ffffff');
    path([[-3,-10],[3,-10],[0,-7]],'#a56f66');
    path([[0,-7],[0,-3],[-4,0],[-7,-2]],undefined,ink,1.5);
    path([[0,-3],[4,0],[7,-2]],undefined,ink,1.5);
    if(kind==='cat'){
      path([[-25,-8],[-37,-11]],undefined,ink,1);path([[-25,-3],[-37,-2]],undefined,ink,1);
      path([[25,-8],[37,-11]],undefined,ink,1);path([[25,-3],[37,-2]],undefined,ink,1);
    }
    box(-21,7,42,10,5,kind==='bunny'?'#ed8997':kind==='bear'?'#86b6a0':'#a8a2cf',ink);
    box(8,12,10,16,3,kind==='bunny'?'#ed8997':kind==='bear'?'#86b6a0':'#a8a2cf');
    oval(-24,18,8,12,fur,ink);oval(24,18,8,12,fur,ink);
    for(let i=start;i<s.length;i++){
      const shape=s[i];
      if(shape.kind==='path')shape.points=shape.points.map(([px,py])=>[px*k+x,py*k+y]);
      else {shape.x=shape.x*k+x;shape.y=shape.y*k+y;if(shape.kind==='ellipse'){shape.rx*=k;shape.ry*=k;}else{shape.w*=k;shape.h*=k;shape.r*=k;}}
    }
  };
  if(type==='flower'){flower(0,0,14,'#f5b2b2');return s;}
  if(type==='beads'){
    box(-25,-17,50,34,8,'#f6d9be',ink);box(-21,-13,42,24,5,'#fff3dc');
    ['#e88899','#85b9a2','#b0a8d6','#efc363'].forEach((c,i)=>bead(-13+i*9,-2+(i%2)*5,5,c));return s;
  }
  if(type!=='party'){animal(type,0,0);return s;}
  // A little outdoor craft workshop, drawn in a 360 × 220 coordinate space.
  oval(0,1,167,92,'#e4efd9');oval(2,70,160,33,'#d3e3bb');
  oval(-105,-50,35,12,'#fffdf3');oval(-116,-58,17,14,'#fffdf3');oval(-89,-59,16,12,'#fffdf3');
  oval(111,-61,26,10,'#fffdf3');oval(105,-67,13,12,'#fffdf3');
  path([[-158,-71],[-100,-91],[-32,-82],[38,-91],[102,-81],[159,-97]],undefined,'#b59c7d',1.2);
  [[-124,-83],[-65,-87],[7,-86],[77,-85],[135,-91]].forEach(([x,y],i)=>path([[x-7,y],[x+8,y-1],[x+1,y+15]],['#f0a8a6','#edc76e','#a4c9b0','#b9acd5','#f0a8a6'][i]));
  animal('bear',-89,17,.92);animal('bunny',0,0,1.12);animal('cat',88,18,.9);
  // Table shadows and short wooden legs.
  box(-105,51,210,32,14,'#b38867',ink);box(-88,72,14,29,5,'#c59b73',ink);box(74,72,14,29,5,'#c59b73',ink);
  box(-112,33,224,34,14,'#edc8a0',ink);box(-108,33,216,22,10,'#ffe3b6');
  box(-43,11,86,48,7,'#fff5df','#c49a77');
  const heart=['0110110','1111111','1111111','0111110','0011100','0001000'];
  heart.forEach((row,j)=>row.split('').forEach((v,i)=>{if(v==='1')bead(-25+i*8,18+j*6.2,3.3,j<2?'#f4a1ab':'#dd7185');else oval(-25+i*8,18+j*6.2,1,1,'#e1caaa');}));
  box(-94,24,38,25,5,'#a4c7b5',ink);box(-90,27,30,12,3,'#e4f0de');
  for(let i=0;i<5;i++)bead(-85+i*5.3,31+(i%2)*5,3.4,['#e8a2b0','#eec96f','#aea4d4'][i%3]);
  box(65,19,28,30,5,'#fff6e5',ink);oval(79,18,14,5,'#edbd90',ink);oval(79,18,10,3,'#b98865');
  path([[92,25],[101,25],[102,36],[92,39]],undefined,ink,3);
  bead(49,46,5,'#b2a3d5');bead(58,35,4,'#e8a2b0');bead(-49,48,4,'#edc76e');
  // Plants, flowers and loose treasures frame the characters.
  path([[-145,52],[-145,22]],undefined,'#80a17a',3);oval(-152,33,10,5,'#9bbc8d');oval(-139,25,9,5,'#80aa82');
  box(-156,48,24,24,5,'#efb3a0',ink);flower(-145,17,13,'#f9df93');
  path([[144,63],[144,38]],undefined,'#80a17a',3);oval(152,48,10,5,'#9bbc8d');box(132,60,24,20,5,'#b4a7d1',ink);flower(144,34,12,'#f2b1b2');
  flower(-122,87,10,'#fff9ef');flower(119,91,10,'#fff9ef');
  bead(-62,90,5,'#e6a0b0');bead(58,87,5,'#eec96f');
  return s;
}

export function illustrationSvg(type: Animal | 'party' | 'flower' | 'beads', viewBox='-180 -110 360 220'):string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" aria-hidden="true">${illustration(type).map(s=>{
    const style=`fill="${s.fill??'none'}" stroke="${s.stroke??'none'}" stroke-width="${s.kind==='path'?s.width??1.7:1.7}" stroke-linejoin="round" stroke-linecap="round"`;
    if(s.kind==='ellipse')return `<ellipse cx="${s.x}" cy="${s.y}" rx="${s.rx}" ry="${s.ry}" ${style}/>`;
    if(s.kind==='box')return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r}" ${style}/>`;
    return `<path d="M${s.points.map(p=>p.join(',')).join(' L')}${s.closed?' Z':''}" ${style}/>`;
  }).join('')}</svg>`;
}
