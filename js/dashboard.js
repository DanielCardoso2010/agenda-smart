import {supabase} from "./supabaseClient.js";
import {mensagemErro} from "./erros.js";
import * as dados from "./dados.js";
const $=s=>document.querySelector(s),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad=n=>String(n).padStart(2,"0"),iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
function toast(m,er){const t=document.createElement("div");t.className="toast"+(er?" er":"");t.textContent=m;$("#toasts").append(t);setTimeout(()=>t.remove(),3500)}
let user,items=[],editId=null,cfg={emailAtivo:true,antecedencia:60,tema:"claro",nav:false},mes=new Date(),selDia="",dadosOk=false,erroDados="";
function tema(t){document.documentElement.dataset.tema=t==="escuro"?"escuro":""}
const NOTIF="Notification" in window; // iOS/Safari sem suporte não pode quebrar a tela
const lerNav=()=>{try{return localStorage.getItem("nav")==="1"}catch(e){return false}},gravarNav=v=>{try{localStorage.setItem("nav",v?"1":"0")}catch(e){}};
const lerTema=()=>{try{return localStorage.getItem("tema")}catch(e){return null}},gravarTema=t=>{try{localStorage.setItem("tema",t)}catch(e){}};
tema(lerTema());
const nomeDe=u=>u?.user_metadata?.name||"";
const irParaLogin=()=>location.replace("login.html");
supabase.auth.onAuthStateChange(evento=>{if(evento==="SIGNED_OUT")irParaLogin()});
async function iniciar(){
 const{data:{session}}=await supabase.auth.getSession();
 if(!session)return irParaLogin();
 // Confirma a sessão no servidor; só falha de rede mantém a sessão local (uso offline).
 const{data,error}=await supabase.auth.getUser();
 if(error&&error.name!=="AuthRetryableFetchError"){await supabase.auth.signOut({scope:"local"});return irParaLogin()}
 user=data?.user||session.user;
 $("#saudacao").textContent=`Olá, ${(nomeDe(user)||"usuário").split(" ")[0]}!`;
 $("#data").textContent=new Date().toLocaleDateString("pt-BR",{dateStyle:"full",timeZone:"America/Fortaleza"});
 cfg={...cfg,tema:lerTema()||cfg.tema,nav:lerNav()};tema(cfg.tema);
 try{cfg={...cfg,...await dados.lerPreferencias()}}catch(e){toast("Não foi possível carregar as preferências: "+mensagemErro(e),1)}
 try{items=await dados.listarCompromissos();dadosOk=true}catch(e){items=[];dadosOk=false;erroDados=mensagemErro(e)}
 render();
}
iniciar().catch(err=>{console.warn(err);toast("Falha ao iniciar o painel: "+mensagemErro(err),1)});
async function recarregar(){items=await dados.listarCompromissos();render()}
const hoje=()=>iso(new Date());
function filtrados(){const q=$("#q").value.toLowerCase(),c=$("#fc").value,p=$("#fp").value,s=$("#fs").value,d=$("#fd").value||selDia;
 return items.filter(i=>(!q||i.titulo.toLowerCase().includes(q))&&(!c||i.categoria===c)&&(!p||i.prioridade===p)&&(!s||i.status===s)&&(!d||i.data===d)).sort((a,b)=>(a.data+a.inicioHora).localeCompare(b.data+b.inicioHora))}
function render(){
 const h=hoje();$("#s-hoje").textContent=items.filter(i=>i.data===h&&i.status==="Pendente").length;
 $("#s-fut").textContent=items.filter(i=>i.data>h&&i.status==="Pendente").length;
 $("#s-ok").textContent=items.filter(i=>i.status==="Concluído").length;
 const l=filtrados();
 $("#lista").innerHTML=l.length?l.map(i=>`<div class="item ${esc(i.prioridade)} ${esc(i.status)}"><b>${esc(i.titulo)}</b> <small>(${esc(i.categoria)} · ${esc(i.prioridade)} · ${esc(i.status)})</small><br><small>${i.data.split("-").reverse().join("/")} ${esc(i.inicioHora)}${i.fimHora?"–"+esc(i.fimHora):""}${i.lembreteMin?" · ✉ lembrete":""}</small><p style="margin:.3rem 0">${esc(i.descricao)}</p><button class="btn sm" data-a="ok" data-id="${esc(i.id)}">Concluir</button> <button class="btn sm sec" data-a="ed" data-id="${esc(i.id)}">Editar</button> <button class="btn sm sec" data-a="ca" data-id="${esc(i.id)}">Cancelar</button> <button class="btn sm red" data-a="ex" data-id="${esc(i.id)}">Excluir</button></div>`).join(""):`<p style="color:var(--mut)">${dadosOk?'Nenhum compromisso encontrado. Clique em "Novo compromisso" para começar.':"Não foi possível carregar seus compromissos: "+esc(erroDados)+". Recarregue a página."}</p>`;
 calendario();
}
function calendario(){
 const y=mes.getFullYear(),m=mes.getMonth();$("#mes").textContent=mes.toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
 let h="DSTQQSS".split("").map(d=>`<small>${d}</small>`).join("");
 for(let i=0;i<new Date(y,m,1).getDay();i++)h+="<span></span>";
 for(let d=1;d<=new Date(y,m+1,0).getDate();d++){const k=`${y}-${pad(m+1)}-${pad(d)}`;h+=`<button data-d="${k}" class="${k===hoje()?"hoje ":""}${k===selDia?"sel ":""}${items.some(i=>i.data===k)?"tem":""}">${d}</button>`}
 $("#cal").innerHTML=h;
}
$("#cal").onclick=e=>{const d=e.target.dataset.d;if(d){selDia=selDia===d?"":d;$("#fd").value="";render()}};
$("#cal").ondblclick=e=>{if(e.target.dataset.d)abrir(null,e.target.dataset.d)};
$("#ant").onclick=()=>{mes=new Date(mes.getFullYear(),mes.getMonth()-1,1);calendario()};
$("#prox").onclick=()=>{mes=new Date(mes.getFullYear(),mes.getMonth()+1,1);calendario()};
for(const s of ["#q","#fc","#fp","#fs","#fd"])$(s).oninput=render;
$("#limpar").onclick=()=>{for(const s of ["#q","#fc","#fp","#fs","#fd"])$(s).value="";selDia="";render()};
function abrir(i,data){if(!dadosOk)return toast("Compromissos indisponíveis no momento. Recarregue a página.",1);
 editId=i?.id||null;$("#dt").textContent=i?"Editar compromisso":"Novo compromisso";
 $("#titulo").value=i?.titulo||"";$("#desc").value=i?.descricao||"";$("#data-c").value=i?.data||data||hoje();$("#ini").value=i?.inicioHora||"";$("#fim").value=i?.fimHora||"";
 $("#cat").value=i?.categoria||"Estudos";$("#pri").value=i?.prioridade||"Média";$("#sta").value=i?.status||"Pendente";
 $("#lem").value=String(i?i.lembreteMin||0:(cfg.emailAtivo?cfg.antecedencia:0));$("#dlg").showModal()}
$("#novo").onclick=()=>abrir();
document.addEventListener("click",e=>{if(e.target.dataset.fechar!==undefined)e.target.closest("dialog").close()});
$("#form").onsubmit=async e=>{e.preventDefault();
 const titulo=$("#titulo").value.trim(),data=$("#data-c").value,ini=$("#ini").value,fim=$("#fim").value,sta=$("#sta").value;
 if(!titulo||!data||!ini)return toast("Preencha título, data e início.",1);
 if(fim&&fim<=ini)return toast("O término deve ser depois do início.",1);
 const inicio=new Date(`${data}T${ini}:00-03:00`);
 if(isNaN(inicio))return toast("Data ou horário inválido.",1);
 if(sta==="Pendente"&&inicio<new Date()&&!editId)return toast("Não é possível criar compromisso pendente no passado.",1);
 const compromisso={titulo,descricao:$("#desc").value.trim(),data,inicioHora:ini,fimHora:fim,inicio:inicio.toISOString(),categoria:$("#cat").value,prioridade:$("#pri").value,status:sta,lembreteMin:+$("#lem").value};
 const b=e.submitter;if(b)b.disabled=true;
 try{await dados.salvarCompromisso(compromisso,editId);toast(editId?"Compromisso atualizado.":"Compromisso criado.");$("#dlg").close();await recarregar()}catch(err){toast("Erro ao salvar: "+mensagemErro(err),1)}
 if(b)b.disabled=false};
$("#lista").onclick=async e=>{const id=e.target.dataset.id,a=e.target.dataset.a;if(!id)return;const i=items.find(x=>x.id===id);if(!i)return;
 try{if(a==="ed")abrir(i);
 if(a==="ok"){await dados.mudarStatus(id,"Concluído");toast("Compromisso concluído.");await recarregar()}
 if(a==="ca"){await dados.mudarStatus(id,"Cancelado");toast("Compromisso cancelado.");await recarregar()}
 if(a==="ex"&&confirm(`Excluir "${i.titulo}"?`)){await dados.excluirCompromisso(id);toast("Compromisso excluído.");await recarregar()}}catch(err){toast("Erro: "+mensagemErro(err),1)}};
$("#sair").onclick=async()=>{
 let{error}=await supabase.auth.signOut();
 if(error)({error}=await supabase.auth.signOut({scope:"local"})); // sem rede: encerra ao menos neste aparelho
 if(error)return toast("Não foi possível sair: "+mensagemErro(error),1);
 irParaLogin()};
$("#cfg").onclick=async()=>{
 const{data}=await supabase.auth.getUser();if(data?.user)user=data.user;
 $("#p-nome").value=nomeDe(user);$("#p-email").value=user.email||"";$("#p-criada").textContent="Conta criada em "+new Date(user.created_at).toLocaleDateString("pt-BR");
 $("#p-em").checked=!!cfg.emailAtivo;$("#p-ant").value=String([30,60,1440].includes(+cfg.antecedencia)?+cfg.antecedencia:60);$("#p-tema").value=cfg.tema==="escuro"?"escuro":"claro";
 $("#p-nav").disabled=!NOTIF;$("#p-nav").checked=!!cfg.nav&&NOTIF&&Notification.permission==="granted";
 const verificado=!!user.email_confirmed_at;
 $("#p-ver").textContent=verificado?"✔ E-mail verificado: lembretes por e-mail liberados.":"⚠ E-mail não verificado: os lembretes por e-mail só são enviados depois da verificação.";$("#p-reenviar").hidden=verificado;
 $("#dcfg").showModal()};
$("#p-reenviar").onclick=async()=>{const{error}=await supabase.auth.resend({type:"signup",email:user.email,options:{emailRedirectTo:new URL("login.html",location.href).href}});
 toast(error?"Falha ao enviar: "+mensagemErro(error):"E-mail de verificação enviado. Confira a caixa de entrada e o spam.",!!error)};
$("#fcfg").onsubmit=async e=>{e.preventDefault();const nome=$("#p-nome").value.trim();if(nome.length<3)return toast("Nome inválido.",1);
 const b=e.submitter;if(b)b.disabled=true;
 let nav=$("#p-nav").checked;
 if(nav){try{if(!NOTIF||(Notification.permission!=="granted"&&await Notification.requestPermission()!=="granted")){nav=false;toast("Permissão de notificações negada ou indisponível.",1)}}catch(err){nav=false}}
 const n={emailAtivo:$("#p-em").checked,antecedencia:+$("#p-ant").value,tema:$("#p-tema").value==="escuro"?"escuro":"claro",nav};
 tema(n.tema);gravarTema(n.tema);gravarNav(n.nav);cfg={...cfg,...n}; // tema e notificações ficam guardados neste aparelho
 let ok=true;
 try{await dados.salvarPreferencias(n)}catch(err){ok=false;toast("Não foi possível salvar as preferências: "+mensagemErro(err),1)}
 if(nome!==nomeDe(user)){const{data,error}=await supabase.auth.updateUser({data:{name:nome}});
  if(error){ok=false;toast("Nome não atualizado: "+mensagemErro(error),1)}
  else{user=data.user;$("#saudacao").textContent=`Olá, ${nome.split(" ")[0]}!`;try{await dados.salvarNome(nome)}catch(err){ok=false;toast("Nome do perfil não atualizado: "+mensagemErro(err),1)}}}
 if(ok){toast("Configurações salvas.");$("#dcfg").close()}
 if(b)b.disabled=false};
const avisados=new Set();
setInterval(()=>{if(!NOTIF||!cfg.nav||Notification.permission!=="granted")return;const agora=Date.now();
 for(const i of items){if(i.status!=="Pendente"||!i.inicio)continue;const dt=new Date(i.inicio).getTime()-agora;if(dt>0&&dt<=30*60000&&!avisados.has(i.id)){avisados.add(i.id);new Notification("Agenda Smart",{body:`${i.titulo} começa às ${i.inicioHora}`,icon:"assets/logo.svg"})}}},60000);
addEventListener("offline",()=>toast("Sem conexão com a internet.",1));
