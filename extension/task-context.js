/* Reads only the currently displayed question, never scripts or answer state. */
(() => {
  function extract(doc=document,view=window) {
    if(!/(^|\.)vgaranov\.ru$/i.test(view.location.hostname))return null;
    const root=doc.querySelector('#div_question');
    if(!root)return null;
    const box=root.getBoundingClientRect();
    if(box.width<=0 || box.height<=0)return null;
    const tables=Array.from(root.querySelectorAll('table'),table=>Array.from(table.rows,row=>Array.from(row.cells,cell=>(cell.innerText || '').trim())));
    const formulas=Array.from(root.querySelectorAll('p[align="center"],b,math'),el=>(el.innerText || el.textContent || '').trim())
      .filter(text=>/[¬∧∨→≡↔⊕]/.test(text) && !/[а-яё]{4}/i.test(text));
    const text=(root.innerText || '').trim().slice(0,24000);
    if(!text)return null;
    return {text,tables,formula:formulas.sort((a,b)=>b.length-a.length)[0] || '',
      viewport:{width:view.innerWidth,height:view.innerHeight},
      rect:{x:box.x,y:box.y,width:box.width,height:box.height},
      clipped:box.top<0 || box.bottom>view.innerHeight || box.left<0 || box.right>view.innerWidth};
  }
  globalThis.GrTaskContext=Object.freeze({extract});
})();
