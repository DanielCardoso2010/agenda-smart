// Camada de dados do painel: tabelas compromissos, preferencias e perfis no Supabase.
// A segurança é feita por RLS no banco (cada usuário só enxerga as próprias linhas);
// aqui só se traduz entre o formato da tela e o do banco.
import {supabase} from "./supabaseClient.js";

const FUSO="America/Fortaleza";
const OFFSET="-03:00"; // Fortaleza não tem horário de verão
const PAGINA=1000;     // limite de linhas por consulta do Supabase

const STATUS_BANCO={Pendente:"pendente","Concluído":"concluido",Cancelado:"cancelado"};
const STATUS_TELA=Object.fromEntries(Object.entries(STATUS_BANCO).map(([tela,banco])=>[banco,tela]));
const COLUNAS="id,titulo,descricao,inicio,fim,categoria,prioridade,status,lembrete_min";

const falhar=(error,fallback)=>{if(error)throw error;if(fallback)throw new Error(fallback)};

function partesNoFuso(iso){
 const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:FUSO,hourCycle:"h23",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).formatToParts(new Date(iso)).map(x=>[x.type,x.value]));
 return {data:`${p.year}-${p.month}-${p.day}`,hora:`${p.hour}:${p.minute}`};
}

function paraTela(l){
 const ini=partesNoFuso(l.inicio);
 return {id:l.id,titulo:l.titulo,descricao:l.descricao||"",categoria:l.categoria,prioridade:l.prioridade,
  status:STATUS_TELA[l.status]||"Pendente",lembreteMin:l.lembrete_min,inicio:l.inicio,
  data:ini.data,inicioHora:ini.hora,fimHora:l.fim?partesNoFuso(l.fim).hora:""};
}

function paraBanco(c){
 return {titulo:c.titulo,descricao:c.descricao,inicio:new Date(`${c.data}T${c.inicioHora}:00${OFFSET}`).toISOString(),
  fim:c.fimHora?new Date(`${c.data}T${c.fimHora}:00${OFFSET}`).toISOString():null,
  categoria:c.categoria,prioridade:c.prioridade,status:STATUS_BANCO[c.status],lembrete_min:c.lembreteMin};
}

export async function listarCompromissos(){
 const todos=[];
 for(let de=0;;de+=PAGINA){
  const{data,error}=await supabase.from("compromissos").select(COLUNAS).order("inicio",{ascending:true}).range(de,de+PAGINA-1);
  falhar(error);
  todos.push(...data);
  if(data.length<PAGINA)break;
 }
 return todos.map(paraTela);
}

export async function salvarCompromisso(compromisso,id){
 const linha=paraBanco(compromisso);
 const consulta=id?supabase.from("compromissos").update(linha).eq("id",id):supabase.from("compromissos").insert(linha);
 const{data,error}=await consulta.select("id");
 falhar(error,!data?.length&&"Compromisso não encontrado ou sem permissão.");
}

export async function mudarStatus(id,status){
 const{data,error}=await supabase.from("compromissos").update({status:STATUS_BANCO[status]}).eq("id",id).select("id");
 falhar(error,!data?.length&&"Compromisso não encontrado ou sem permissão.");
}

export async function excluirCompromisso(id){
 const{data,error}=await supabase.from("compromissos").delete().eq("id",id).select("id");
 falhar(error,!data?.length&&"Compromisso não encontrado ou sem permissão.");
}

// antecedencias_minutos é uma lista; o painel usa uma antecedência padrão só.
export async function lerPreferencias(){
 const{data,error}=await supabase.from("preferencias").select("email_ativo,antecedencias_minutos").maybeSingle();
 falhar(error);
 if(!data)return {};
 const lista=data.antecedencias_minutos||[];
 const antecedencia=lista.length===1?lista[0]:lista.includes(60)?60:lista[0]||60;
 return {emailAtivo:data.email_ativo,antecedencia};
}

export async function salvarPreferencias({emailAtivo,antecedencia}){
 const{data:{session}}=await supabase.auth.getSession();
 if(!session)throw new Error("Sessão expirada. Entre novamente.");
 const{error}=await supabase.from("preferencias").upsert(
  {user_id:session.user.id,email_ativo:emailAtivo,antecedencias_minutos:[antecedencia]},{onConflict:"user_id"});
 falhar(error);
}

export async function salvarNome(nome){
 const{data:{session}}=await supabase.auth.getSession();
 if(!session)throw new Error("Sessão expirada. Entre novamente.");
 const{data,error}=await supabase.from("perfis").update({nome}).eq("id",session.user.id).select("id");
 falhar(error,!data?.length&&"Perfil não encontrado.");
}
