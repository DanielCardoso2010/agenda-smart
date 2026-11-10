// Edge Function chamada pelo pg_cron (a cada 5 min). Segredos vêm de variáveis de ambiente da função:
//   CRON_SECRET     — senha que o agendador envia em "Authorization: Bearer ..."
//   RESEND_API_KEY  — chave do Resend (segredo da função; NUNCA no frontend)
//   MAIL_FROM       — remetente verificado no Resend (ex.: "Agenda Smart <avisos@seudominio.com>")
//   SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY — injetadas pelo Supabase (uso só no servidor).
// Deploy com verify_jwt = false (a autenticação é o CRON_SECRET acima).
import {createClient} from "npm:@supabase/supabase-js@2";
import {processarLembretes} from "./lembretes.js";

const env=(k:string)=>Deno.env.get(k)??"";
const iguais=(a:string,b:string)=>{ // comparação em tempo constante
  if(a.length!==b.length)return false;
  let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;
};

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return new Response("method not allowed",{status:405});
  const [cron,resend,servico,url]=[env("CRON_SECRET"),env("RESEND_API_KEY"),env("SUPABASE_SERVICE_ROLE_KEY"),env("SUPABASE_URL")];
  if(!cron||!resend||!servico||!url)return Response.json({erro:"configuração ausente"},{status:500});
  if(!iguais(req.headers.get("Authorization")??"",`Bearer ${cron}`))return new Response("unauthorized",{status:401});

  const supabase=createClient(url,servico,{auth:{persistSession:false,autoRefreshToken:false}});
  const from=env("MAIL_FROM")||"Agenda Smart <onboarding@resend.dev>";
  const enviarEmail=async({to,subject,html,idempotencyKey}:{to:string,subject:string,html:string,idempotencyKey:string})=>{
    const r=await fetch("https://api.resend.com/emails",{method:"POST",
      headers:{Authorization:`Bearer ${resend}`,"Content-Type":"application/json","Idempotency-Key":idempotencyKey},
      body:JSON.stringify({from,to:[to],subject,html})});
    const corpo=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(`Resend ${r.status}: ${corpo?.message??"erro"}`);
    return corpo;
  };
  try{return Response.json(await processarLembretes({supabase,enviarEmail}))}
  catch(e){console.error("falha no ciclo de lembretes",e);return Response.json({erro:"falha no ciclo"},{status:500})}
});
