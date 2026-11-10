import {supabase,manterConectado} from "./supabaseClient.js";
import {mensagemErro} from "./erros.js";

const $=s=>document.querySelector(s);
const PAGINAS=["login","cadastro","recuperar","redefinir"];
const PAINEL="dashboard.html";

// Parâmetros que o Supabase coloca na URL (hash ou query) nos links de e-mail.
const consulta=new URLSearchParams(location.search);
const fragmento=new URLSearchParams(location.hash.slice(1));
const pegar=k=>fragmento.get(k)||consulta.get(k);

let recuperando=pegar("type")==="recovery"||consulta.has("redefinir");
let cadastrando=false;
const linkComErro=!!(pegar("error")||pegar("error_code")||pegar("error_description"));

function mostrar(form,texto,ok=false){
 const el=form.querySelector(".erro");
 el.textContent=texto;
 el.classList.toggle("ok",ok);
}

function rota(){
 const pedida=location.hash.slice(1);
 const pagina=recuperando?"redefinir":PAGINAS.includes(pedida)?pedida:"login";
 for(const f of PAGINAS)$("#f-"+f).hidden=f!==pagina;
}
addEventListener("hashchange",rota);

if(linkComErro){
 const eraRecuperacao=consulta.has("redefinir");
 recuperando=false;
 if(eraRecuperacao)history.replaceState(null,"",location.pathname+"#recuperar");
 rota();
 mostrar($(eraRecuperacao?"#f-recuperar":"#f-login"),"Link inválido, expirado ou já utilizado. Peça um novo.");
}else rota();

$("#l-ver").onchange=e=>$("#l-senha").type=e.target.checked?"text":"password";

async function run(form,fn){
 const botao=form.querySelector("button");
 mostrar(form,"");
 botao.disabled=true;
 try{await fn()}
 catch(e){mostrar(form,mensagemErro(e))}
 finally{botao.disabled=false}
}

supabase.auth.onAuthStateChange((evento,sessao)=>{
 if(evento==="PASSWORD_RECOVERY"){recuperando=true;rota();return}
 if(sessao&&!cadastrando&&!recuperando)location.replace(PAINEL);
});

$("#f-login").onsubmit=e=>{
 e.preventDefault();
 run(e.target,async()=>{
  manterConectado($("#l-manter").checked);
  const{error}=await supabase.auth.signInWithPassword({
   email:$("#l-email").value.trim(),
   password:$("#l-senha").value
  });
  if(error)throw error;
  location.replace(PAINEL);
 });
};

$("#f-cadastro").onsubmit=e=>{
 e.preventDefault();
 run(e.target,async()=>{
  const nome=$("#c-nome").value.trim();
  if(nome.length<3)throw new Error("Informe o nome completo.");
  if($("#c-senha").value!==$("#c-conf").value)throw new Error("As senhas não coincidem.");

  cadastrando=true;
  try{
   const{data,error}=await supabase.auth.signUp({
    email:$("#c-email").value.trim(),
    password:$("#c-senha").value,
    options:{data:{name:nome},emailRedirectTo:location.origin+location.pathname}
   });
   if(error)throw error;
   if(data.session)return location.replace(PAINEL);
   // Mensagem igual para e-mail novo e já existente: o Supabase não revela se a conta existe.
   mostrar(e.target,"Enviamos um link de confirmação para o seu e-mail. Se não chegar, veja o spam. Se você já tem conta, use Entrar ou Esqueci a senha.",true);
  }finally{
   cadastrando=false;
  }
 });
};

$("#f-recuperar").onsubmit=e=>{
 e.preventDefault();
 run(e.target,async()=>{
  const{error}=await supabase.auth.resetPasswordForEmail($("#r-email").value.trim(),{
   redirectTo:location.origin+location.pathname+"?redefinir=1"
  });
  if(error)throw error;
  mostrar(e.target,"Se o e-mail existir, o link de recuperação foi enviado.",true);
 });
};

$("#f-redefinir").onsubmit=e=>{
 e.preventDefault();
 run(e.target,async()=>{
  if($("#n-senha").value!==$("#n-conf").value)throw new Error("As senhas não coincidem.");
  const{error}=await supabase.auth.updateUser({password:$("#n-senha").value});
  if(error)throw error;
  mostrar(e.target,"Senha atualizada. Redirecionando...",true);
  setTimeout(()=>location.replace(PAINEL),1200);
 });
};
