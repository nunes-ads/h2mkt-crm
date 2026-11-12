export type Product={ref:string;desc:string;grupo:string;estoque:number;av:number;parcelas:number[];litro:number|null};
export const coefficients={av:0.813092, x:[0.837484,0.850047,0.862609,0.875548,0.888487,0.901814,0.915142,0.928869,0.942596,0.966161,0.970874,0.985437]};
export function decodeCatalog(raw:unknown[][]):Product[]{return raw.map(r=>({ref:String(r[0]),desc:String(r[1]),grupo:String(r[2]),estoque:Number(r[3]),av:Number(r[4]),parcelas:Array.isArray(r[5])?r[5].map(Number):[],litro:r[6]==null?null:Number(r[6])}));}
const outside=new Set(['SERVIÇO DE GEOMETRIA','SERVIÇO ALINHAMENTO','SERVIÇO BORRACHARIA','SERVIÇO DE MANUTENÇÃO','SERVIÇO TROCA DE ÓLEO','SERVIÇO TROCA DE FILTRO','CARCAÇAS','CHUMBO','VOLTAS','EQUIP / FERRAMENTAS','MATERIAIS DE CONSUMO']);
const gifts=/BRINDE|CAMISETA|\bBON[EÉ]\b|CALENDARIO|COOLER|^COPO MOTUL|GARRAFA|TOTEM|EXPOSITOR|^ADESIVO$|CANETA|CANIVETE|FOLDER|FLYER|CHAVEIRO|MOCHILA|CANECA|ECOBAG|GUARDA.?SOL|BANDEIRA|PROMOCIONAL|MINIATURA/i;
const round=(v:number)=>Number(v.toFixed(2));
export function importCatalog(rows:Record<string,unknown>[],previous:Product[]) {
 const get=(r:Record<string,unknown>,...keys:string[])=>{const k=Object.keys(r).find(k=>keys.some(x=>x.toLowerCase()===k.trim().toLowerCase()));return k?r[k]:undefined;};
 const num=(v:unknown)=>Number(String(v??0).replace(',','.'))||0;
 const map=new Map<string,{ref:string;desc:string;grupo:string;stock:number;price:number|null}>();let inactive=0;
 for(const r of rows){const name=String(get(r,'Nome','Descricao','Produto')??'').trim();if(!name)continue;const center=String(get(r,'nomeCE','Loja','Centro')??'');if(/INATIV|ESCRITORIO/i.test(center)){inactive++;continue;}const ref=String(get(r,'Referencia','Referência','Ref')??`COD${get(r,'Codigo','Código')??''}-${name.toUpperCase().replace(/\W/g,'').slice(0,6)}`);const item=map.get(ref)??{ref,desc:name,grupo:String(get(r,'Grupo','DescricaoGrupo')??''),stock:0,price:null};const price=num(get(r,'PrecoVenda','Preço','Preco'));if(String(get(r,'TipoNegociacao','Tipo')??'CONSUMIDOR').toUpperCase()==='CONSUMIDOR'&&price>0&&item.price===null)item.price=price;item.stock+=num(get(r,'QTD','Estoque','Quantidade'));map.set(ref,item);}
 let removed=0;const valid:Product[]=[];
 for(const p of map.values()){
 const fallback=previous.find(i=>i.ref===p.ref);const price=p.price??(fallback?fallback.av/coefficients.av:0);
 if(outside.has(p.grupo)||/BUJ[AÃ]O/i.test(p.desc)||gifts.test(p.desc)||price<=0||p.stock<1){removed++;continue;}
 const av=round(price*coefficients.av);let litro:number|null=null;
 if(p.grupo.startsWith('EMBALAGEM')){const ml=p.desc.match(/(\d+(?:[.,]\d+)?)\s*ML\b/i);const liters=[...p.desc.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:L|LT|LTS|LITROS?)\b/gi)].at(-1);const volume=ml?num(ml[1])/1000:liters?num(liters[1]):1;const bulk=/ECOL|\bECO\b|TAMBOR|AGRANEL|\bEMB\b/i.test(p.desc)||volume>=60;litro=bulk?av:round(av/(volume||1));if(!ml&&volume>=1.5&&litro<18)litro=av;}
 valid.push({ref:p.ref,desc:p.desc,grupo:p.grupo,estoque:round(p.stock),av,parcelas:coefficients.x.map(f=>round(price*f)),litro});
 }
 if(!valid.length)throw new Error('Nenhum produto válido. Confira Nome, Grupo, PrecoVenda e QTD.');
 const ids=new Set(valid.map(i=>i.ref));const zeroed=previous.filter(i=>!ids.has(i.ref)).map(i=>({...i,estoque:0}));
 return {products:[...valid.sort((a,b)=>a.grupo.localeCompare(b.grupo)||a.desc.localeCompare(b.desc)),...zeroed],stats:{lines:rows.length,inactive,valid:valid.length,removed,zeroed:zeroed.length}};
}
