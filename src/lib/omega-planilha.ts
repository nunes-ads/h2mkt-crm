import Papa from 'papaparse';
export async function readSheet(file:File, preferred?:string):Promise<Record<string,unknown>[]> {
 if (/\.csv$/i.test(file.name)) {
  const parsed=Papa.parse<Record<string,string>>(await file.text(),{header:true,skipEmptyLines:true,transformHeader:h=>h.trim()});
  if(parsed.errors.length)throw new Error('CSV inválido: confira separadores e colunas.');
  return parsed.data;
 }
 if(!/\.xlsx$/i.test(file.name))throw new Error('Use uma planilha .xlsx ou .csv.');
 const {default:readXlsx}=await import('read-excel-file/browser');
 const sheets=await readXlsx(file);const sheet=sheets.find(s=>s.sheet===preferred)??sheets[0];
 if(!sheet)throw new Error('Planilha vazia.');
 const rows=sheet.data;const headers=rows[0]?.map(x=>String(x??'').trim())??[];
 return rows.slice(1).map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]??''])));
}
