// Lógica dos lembretes por e-mail (sem dependência de Deno, para poder ser testada).
// Fluxo: pega lembretes 'pendente' com horario_envio <= agora, "reserva" cada um (pendente -> enviando),
// envia pelo Resend e marca 'enviado'. Falhas voltam a 'pendente' até 3 tentativas, depois 'falhou'.
const FUSO="America/Fortaleza";
const LOTE=50, MAX_TENTATIVAS=3, PRESO_MIN=10;

export const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uma_linha=s=>String(s??"").replace(/[\r\n]+/g," ").trim();
const quando=iso=>new Intl.DateTimeFormat("pt-BR",{timeZone:FUSO,dateStyle:"full",timeStyle:"short"}).format(new Date(iso));

export function faltam(inicio,agora){
 const min=Math.max(0,Math.round((new Date(inicio)-agora)/60000));
 if(min<60)return `em ${min} min`;
 if(min<24*60){const h=Math.round(min/60);return `em ${h} ${h===1?"hora":"horas"}`}
 const d=Math.round(min/1440);return `em ${d} ${d===1?"dia":"dias"}`;
}

export function montarEmail(c,agora){
 const titulo=uma_linha(c.titulo);
 const fim=c.fim?` até ${new Intl.DateTimeFormat("pt-BR",{timeZone:FUSO,timeStyle:"short"}).format(new Date(c.fim))}`:"";
 return {
  subject:`Lembrete: ${titulo}`,
  html:`<div style="font-family:Arial,sans-serif;max-width:520px"><h2>Lembrete: ${esc(titulo)}</h2>
<p>Começa <b>${esc(faltam(c.inicio,agora))}</b>.</p>
<p><b>Quando:</b> ${esc(quando(c.inicio))}${esc(fim)} (Fortaleza)<br><b>Categoria:</b> ${esc(c.categoria)} · <b>Prioridade:</b> ${esc(c.prioridade)}</p>
<p>${esc(c.descricao)||"<i>Sem descrição.</i>"}</p>
<p style="color:#666;font-size:12px">Agenda Smart. Você pode desativar estes e-mails em Configurações.</p></div>`
 };
}

export async function processarLembretes({supabase,enviarEmail,agora=()=>new Date()}){
 const r={reativados:0,vencidos:0,enviados:0,ignorados:0,falhas:0};
 const lem=()=>supabase.from("lembretes");
 const marcar=(id,campos)=>lem().update(campos).eq("id",id);

 // lembretes presos em 'enviando' (função interrompida) voltam para a fila
 const corte=new Date(agora().getTime()-PRESO_MIN*60000).toISOString();
 const{data:presos,error:ePresos}=await lem().update({status:"pendente"}).eq("status","enviando").lt("updated_at",corte).select("id");
 if(ePresos)throw ePresos; r.reativados=presos?.length||0;

 const{data:vencidos,error:eVenc}=await lem().select("id,user_id,compromisso_id,antecedencia_minutos,tentativas")
  .eq("status","pendente").lte("horario_envio",agora().toISOString()).order("horario_envio").limit(LOTE);
 if(eVenc)throw eVenc; r.vencidos=vencidos.length;

 for(const l of vencidos){
  // reserva atômica: só quem conseguir trocar pendente -> enviando envia
  const{data:res,error:eRes}=await lem().update({status:"enviando",tentativas:l.tentativas+1}).eq("id",l.id).eq("status","pendente").select("id");
  if(eRes||!res?.length)continue;
  const tentativa=l.tentativas+1;
  const ignorar=async motivo=>{await marcar(l.id,{status:"falhou",erro:`ignorado: ${motivo}`});r.ignorados++};
  try{
   const{data:c}=await supabase.from("compromissos").select("titulo,descricao,categoria,prioridade,inicio,fim,status").eq("id",l.compromisso_id).maybeSingle();
   if(!c){await ignorar("compromisso não existe mais");continue}
   if(c.status!=="pendente"){await ignorar(`compromisso ${c.status}`);continue}
   if(new Date(c.inicio)<=agora()){await ignorar("compromisso já começou");continue}
   const{data:u}=await supabase.auth.admin.getUserById(l.user_id);
   const email=u?.user?.email;
   if(!email||!u.user.email_confirmed_at){await ignorar("e-mail ausente ou não verificado");continue}
   const{data:p}=await supabase.from("preferencias").select("email_ativo").eq("user_id",l.user_id).maybeSingle();
   if(p&&p.email_ativo===false){await ignorar("e-mails desativados nas preferências");continue}
   const msg=montarEmail(c,agora());
   const enviado=await enviarEmail({to:email,subject:msg.subject,html:msg.html,idempotencyKey:l.id});
   await marcar(l.id,{status:"enviado",resend_id:enviado?.id??null,enviado_em:agora().toISOString(),erro:null});
   r.enviados++;
  }catch(e){
   r.falhas++;
   const erro=String(e?.message||e).slice(0,300);
   await marcar(l.id,{status:tentativa>=MAX_TENTATIVAS?"falhou":"pendente",erro});
  }
 }
 return r;
}
