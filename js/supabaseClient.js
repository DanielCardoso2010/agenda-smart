import {createClient} from "https://esm.sh/@supabase/supabase-js@2";

// Chave PUBLISHABLE: pode ficar no frontend (a proteção dos dados é feita por RLS no banco).
// NUNCA coloque aqui a sb_secret / service_role.
const supabaseUrl="https://mkgdhpdioxrifjdisnpg.supabase.co";
const supabasePublishableKey="sb_publishable_nIj6ULIod30jUoVBGERrkg_UR2vx9jK";

// "Permanecer conectado": marcado (padrão) guarda a sessão em localStorage;
// desmarcado guarda em sessionStorage (some ao fechar o navegador).
const FLAG="agenda-smart:manter-conectado";
const lerFlag=()=>{try{return localStorage.getItem(FLAG)}catch{return null}};
const principal=()=>lerFlag()==="0"?sessionStorage:localStorage;
const secundario=()=>lerFlag()==="0"?localStorage:sessionStorage;

const armazenamento={
 getItem:k=>{try{return principal().getItem(k)}catch{return null}},
 setItem:(k,v)=>{try{principal().setItem(k,v);secundario().removeItem(k)}catch{}},
 removeItem:k=>{try{localStorage.removeItem(k);sessionStorage.removeItem(k)}catch{}}
};

export const manterConectado=sim=>{try{localStorage.setItem(FLAG,sim?"1":"0")}catch{}};

export const supabase=createClient(supabaseUrl,supabasePublishableKey,{
 auth:{storage:armazenamento,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
});
