'use strict';
(() => {
  const main={query:'',records:[],page:1,pages:0,total:0,loading:false,error:'',index:null,sequence:0};
  const scoped={query:'',jid:null,records:[],page:1,pages:0,total:0,loading:false,error:'',index:null,sequence:0};
  let mainTimer,scopedTimer,indexTimer;
  const fold=value=>String(value||'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR');
  function highlight(value,query){const words=(fold(query).match(/[\p{L}\p{N}_]+/gu)||[]);return String(value||'').split(/([\p{L}\p{N}_]+)/gu).map(part=>words.some(w=>fold(part).startsWith(w))?'<mark>'+esc(part)+'</mark>':esc(part)).join('');}
  function snippet(m,query){const value=m.text||m.fileName||preview(m),plain=fold(value),tokens=fold(query).match(/[\p{L}\p{N}_]+/gu)||[];const found=tokens.map(w=>plain.indexOf(w)).filter(i=>i>=0);const at=found.length?Math.min(...found):0,start=Math.max(0,at-45),end=Math.min(value.length,start+170);return (start?'…':'')+highlight(value.slice(start,end),query)+(end<value.length?'…':'');}
  function name(m){return contactName(state.chats.find(c=>c.jid===m.jid||c.aliases?.includes(m.jid))||{jid:m.jid,name:''});}
  function progress(search){if(search.loading)return 'Pesquisando mensagens…';if(search.error)return search.error;if(search.index?.error)return search.index.error;if(search.index&&!search.index.ready)return 'Preparando o histórico'+(search.index.total?' · '+Math.min(search.index.indexed,search.index.total).toLocaleString('pt-BR')+' / '+search.index.total.toLocaleString('pt-BR'):'')+'. Resultados parciais.';return search.total+' mensagem(ns) encontrada(s)';}
  function hits(search,context){return search.records.map((m,i)=>`<button class="keyword-hit" data-search-context="${context}" data-hit-index="${i}" aria-label="Abrir mensagem encontrada em ${esc(name(m))}"><div class="keyword-hit-top"><strong>${context==='main'?highlight(name(m),search.query):m.fromMe?'Você':esc(m.sender||'Mensagem recebida')}</strong><time>${new Date(m.timestamp*1000).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'})} ${chatTime(m.timestamp).includes(':')?chatTime(m.timestamp):''}</time></div><span>${snippet(m,search.query)}</span></button>`).join('');}
  function render(){
    let area=$('main-keyword-results');
    $('chat-list').querySelector('.contact-results-heading')?.remove();
    if(!main.query){area?.remove();return;}
    const first=$('chat-list').querySelector('[data-jid]');
    if(first){const heading=document.createElement('div');heading.className='contact-results-heading';heading.textContent='Contatos e conversas';$('chat-list').prepend(heading);}else{const empty=$('chat-list').querySelector('.list-message');if(empty)empty.textContent='Nenhum contato com esse nome ou número.';}
    const signature=JSON.stringify([main.query,main.records,main.loading,main.error,main.index?.ready,main.index?.indexed,main.total,main.page,main.pages]);
    if(area?.dataset.signature===signature)return;
    if(!area){area=document.createElement('section');area.id='main-keyword-results';area.className='keyword-results';$('chat-list').append(area);}
    area.dataset.signature=signature;
    area.innerHTML='<h2>Mensagens</h2><p class="keyword-progress" role="status">'+esc(progress(main))+'</p>'+hits(main,'main')+(!main.records.length&&!main.loading&&!main.error?'<p class="keyword-empty">Nenhuma mensagem encontrada.</p>':'')+(main.page<main.pages?'<button class="load-older" id="more-global-results">Mostrar mais mensagens</button>':'');
    $('more-global-results')?.addEventListener('click',()=>searchMain(true));
  }
  const bar=document.createElement('section');bar.id='conversation-search';bar.className='conversation-search';bar.hidden=true;
  bar.innerHTML='<div class="conversation-search-input"><svg><use href="#i-search"/></svg><input type="search" id="conversation-query" placeholder="Pesquisar" aria-label="Pesquisar nesta conversa" maxlength="200" autocomplete="off"><button type="button" class="icon" id="close-conversation-search" aria-label="Fechar pesquisa da conversa">×</button></div><div id="conversation-search-results" class="conversation-keyword-results"></div>';
  document.querySelector('.chat-header').after(bar);
  function renderScoped(){const area=$('conversation-search-results');if(!scoped.query){area.innerHTML='<p class="keyword-progress">Pesquise palavras-chave nas mensagens desta conversa.</p>';return;}area.innerHTML='<p class="keyword-progress" role="status">'+esc(progress(scoped))+'</p>'+hits(scoped,'scoped')+(!scoped.records.length&&!scoped.loading&&!scoped.error?'<p class="keyword-empty">Nenhuma mensagem encontrada nesta conversa.</p>':'')+(scoped.page<scoped.pages?'<button class="load-older" id="more-conversation-results">Mostrar mais resultados</button>':'');$('more-conversation-results')?.addEventListener('click',()=>searchScoped(true));}
  async function searchMain(more=false,refresh=false){
    const token=main.sequence,query=main.query;if(!query)return render();if(main.loading&&more)return;
    main.loading=true;main.error='';render();const page=refresh?main.page:more?main.page+1:1;
    try{let d,records=[];for(let p=refresh?1:page;p<=page;p++){d=await call('search',{query,page:p});if(token!==main.sequence||query!==main.query)return;records.push(...d.records);if(p>=d.pages)break;}main.records=more?[...main.records,...records]:records;Object.assign(main,{page:d.page,pages:d.pages,total:d.total,index:d.index});}
    catch(e){if(token===main.sequence)main.error=e.message;}
    finally{if(token===main.sequence){main.loading=false;render();}}
  }
  function mainInput(){clearTimeout(mainTimer);main.sequence++;main.query=$('search').value.trim();main.records=[];main.total=0;main.page=1;main.pages=0;main.error='';main.loading=!!main.query;state.search=main.query;visibleContacts=main.query?5:150;chatRenderKey='';renderChats();$('chat-list').scrollTop=0;if(main.query)mainTimer=setTimeout(()=>searchMain(),280);}
  $('search').maxLength=200;$('search').oninput=mainInput;
  $('search').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();clearTimeout(mainTimer);searchMain();}if(e.key==='Escape'){e.preventDefault();$('search').value='';mainInput();}});
  async function searchScoped(more=false,refresh=false){
    const token=scoped.sequence,query=scoped.query,jid=state.active?.jid;scoped.jid=jid;if(!query)return renderScoped();if(scoped.loading&&more)return;
    scoped.loading=true;scoped.error='';renderScoped();const page=refresh?scoped.page:more?scoped.page+1:1;
    try{let d,records=[];for(let p=refresh?1:page;p<=page;p++){d=await call('search',{query,jid,page:p});if(token!==scoped.sequence||jid!==state.active?.jid)return;records.push(...d.records);if(p>=d.pages)break;}scoped.records=more?[...scoped.records,...records]:records;Object.assign(scoped,{page:d.page,pages:d.pages,total:d.total,index:d.index});}
    catch(e){if(token===scoped.sequence)scoped.error=e.message;}
    finally{if(token===scoped.sequence){scoped.loading=false;renderScoped();}}
  }
  function scopedInput(){clearTimeout(scopedTimer);scoped.sequence++;scoped.query=$('conversation-query').value.trim();scoped.jid=state.active?.jid;scoped.records=[];scoped.total=0;scoped.page=1;scoped.pages=0;scoped.error='';scoped.loading=!!scoped.query;renderScoped();if(scoped.query)scopedTimer=setTimeout(()=>searchScoped(),250);}
  $('conversation-query').oninput=scopedInput;
  $('conversation-query').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();clearTimeout(scopedTimer);searchScoped();}if(e.key==='Escape')closeScoped();};
  function closeScoped(){clearTimeout(scopedTimer);scoped.sequence++;bar.hidden=true;scoped.query='';scoped.records=[];scoped.loading=false;$('conversation-query').value='';}
  $('close-conversation-search').onclick=closeScoped;
  $('chat-search').onclick=()=>{if(!state.active)return;if(!bar.hidden){closeScoped();return;}bar.hidden=false;scoped.jid=state.active.jid;renderScoped();$('conversation-query').focus();};
  async function openHit(m,scopedResult=false){if(!m)return;try{await businessUI.openHit(m,true);if(scopedResult&&!bar.hidden)$('conversation-query').focus();}catch(e){toast(e.message);}}
  $('chat-list').addEventListener('click',e=>{const hit=e.target.closest('[data-search-context="main"]');if(hit)openHit(main.records[Number(hit.dataset.hitIndex)]);});
  $('conversation-search-results').addEventListener('click',e=>{const hit=e.target.closest('[data-search-context="scoped"]');if(hit)openHit(scoped.records[Number(hit.dataset.hitIndex)],true);});
  function clear(){clearTimeout(mainTimer);main.sequence++;Object.assign(main,{query:'',records:[],total:0,page:1,pages:0,loading:false,error:''});chatRenderKey='';renderChats();}
  window.chatSearch={render,clear,selected:()=>closeScoped(),event:e=>{if(e.event==='search.index'){main.index=e.index;scoped.index=e.index;render();if(!bar.hidden)renderScoped();if(e.index.ready){clearTimeout(indexTimer);indexTimer=setTimeout(()=>{if(main.query&&!main.loading)searchMain(false,true);if(scoped.query&&!scoped.loading)searchScoped(false,true);},200);}}else if(['incoming.message','send.message','identities.update'].includes(e.event)){clearTimeout(indexTimer);indexTimer=setTimeout(()=>{if(main.query&&!main.loading)searchMain(false,true);if(scoped.query&&!scoped.loading)searchScoped(false,true);},500);}}};
  render();
})();
