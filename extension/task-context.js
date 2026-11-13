/* Reads only the currently displayed question, never scripts or answer state. */
(() => {
  function extract(doc=document,view=window) {
    if(!/(^|\.)vgaranov\.ru$/i.test(view.location.hostname))return null;
    const root=doc.querySelector('#div_question');
    if(!root)return null;
    const box=root.getBoundingClientRect();
    if(box.width<=0 || box.height<=0)return null;
    const tables=Array.from(root.querySelectorAll('table')).filter(table=>!table.querySelector?.('table')).map(table=>Array.from(table.rows,row=>Array.from(row.cells,cell=>(cell.innerText || '').trim())));
    const code=Array.from(root.querySelectorAll('pre'),el=>(el.innerText || '').trim());
    let diagram=null;
    for(const img of root.querySelectorAll('img')){
      try{
        if(!img.complete||!img.naturalWidth||new URL(img.src).origin!==view.location.origin)continue;
        const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),canvas=doc.createElement('canvas');
        canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);
        const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
        diagram=canvas.toDataURL('image/png');if(diagram.length>2000000)diagram=null;break;
      }catch{/* Screenshot still contains the figure if canvas access is unavailable. */}
    }
    const formulas=Array.from(root.querySelectorAll('p[align="center"],b,math'),el=>(el.innerText || el.textContent || '').trim())
      .filter(text=>/[¬∧∨→≡↔⊕]/.test(text) && !/[а-яё]{4}/i.test(text));
    const text=(root.innerText || '').trim().slice(0,24000);
    if(!text)return null;
    return {text,tables,code,diagram,formula:formulas.sort((a,b)=>b.length-a.length)[0] || '',
      viewport:{width:view.innerWidth,height:view.innerHeight},
      rect:{x:box.x,y:box.y,width:box.width,height:box.height},
      clipped:box.top<0 || box.bottom>view.innerHeight || box.left<0 || box.right>view.innerWidth};
  }
  globalThis.GrTaskContext=Object.freeze({extract});
})();
