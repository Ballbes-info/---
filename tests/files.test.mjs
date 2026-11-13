import test from 'node:test';import assert from 'node:assert/strict';
import '../extension/task-files.js';
import {deflateRawSync} from 'node:zlib';
const task={text:'В файле содержится последовательность целых чисел. Пусть N – минимальное по абсолютной величине число в последовательности, кратное 6. Определите количество пар элементов последовательности, в которых оба числа не кратны N. В ответе запишите количество найденных пар, затем абсолютное значение максимальной из сумм элементов таких пар. Под парой подразумевается два идущих подряд элемента последовательности.',links:[{href:'https://vgaranov.ru/download/task_e17/example.txt'}]};
test('sequences use consecutive pairs and signed extrema correctly',()=>{
 assert.equal(GrTaskFiles.sequence(task,'6 -11 -5 7 13 12'),'3 20');
 assert.equal(GrTaskFiles.sequence({...task,text:task.text.replace('максимальной','минимальной')},'6 -11 -5 7 13 12'),'3 16');
});
test('public file is downloaded once; arbitrary domains are rejected',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return new Response('6 -11 -5 7 13 12');};
 assert.equal(await GrTaskFiles.solve(task,fetcher),'3 20');assert.equal(await GrTaskFiles.solve(task,fetcher),'3 20');assert.equal(calls,1);
 assert.equal(await GrTaskFiles.solve({...task,links:[{href:'https://evil.example/test.txt'}]},fetcher),null);assert.equal(calls,1);
});
test('products join goods, movements and stores and respect date limits',()=>{
 const book={'Движение товаров':[['ID операции','Дата','ID магазина','Артикул','Количество упаковок, шт','Тип операции'],[1,45140,'M1',1,5,'Продажа'],[2,45141,'M1',1,7,'Продажа'],[3,45140,'M2',1,50,'Продажа']],
 'Товар':[['Артикул','Отдел','Наименование товара','Ед_изм','Количество в упаковке','Цена за упаковку'],[1,'Конфеты','Мармелад','грамм',250,100]],
 'Магазин':[['ID магазина','Район','Адрес'],['M1','Лесной','просп. Мира, 10'],['M2','Лесной','Иная улица']]};
 const text='Используя информацию, определите, на какую сумму (в рублях) было продано мармелада в магазинах на проспекте Мира за период с 1 по 22 августа включительно. Примечание: в названии есть слово «мармелад».';
 assert.equal(GrTaskFiles.products({text},book),'1200');
});
test('XLSX reader inflates workbook and preserves shared and inline strings',async()=>{
 const files={
  'xl/workbook.xml':'<workbook><sheets><sheet name="Товар" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Target="/xl/worksheets/sheet1.xml"/></Relationships>',
  'xl/sharedStrings.xml':'<sst><si><t>Артикул</t></si></sst>',
  'xl/worksheets/sheet1.xml':'<worksheet><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>Название</t></is></c></row><row><c r="A2"><v>7</v></c><c r="B2" t="inlineStr"><is><t>Мармелад &amp; конфеты</t></is></c></row></sheetData></worksheet>'
 };
 const locals=[],centrals=[];let offset=0;
 for(const [name,text] of Object.entries(files)){
  const filename=Buffer.from(name),data=Buffer.from(text),compressed=deflateRawSync(data);let crc=0xffffffff;
  for(const byte of data){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
  const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(8,8);h.writeUInt32LE(crc,14);h.writeUInt32LE(compressed.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(filename.length,26);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(8,10);c.writeUInt32LE(crc,16);c.writeUInt32LE(compressed.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(filename.length,28);c.writeUInt32LE(offset,42);
  locals.push(h,filename,compressed);centrals.push(c,filename);offset+=h.length+filename.length+compressed.length;
 }
 const directory=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
 const result=await GrTaskFiles.workbook(new Uint8Array(Buffer.concat([...locals,directory,end])));
 assert.deepEqual(result['Товар'],[['Артикул','Название'],[7,'Мармелад & конфеты']]);
});
