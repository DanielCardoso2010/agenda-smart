// Traduz erros do Supabase Auth (e erros do próprio app) para mensagens em português.
const POR_CODIGO={
 invalid_credentials:"E-mail ou senha incorretos.",
 email_not_confirmed:"Confirme seu e-mail antes de entrar.",
 user_already_exists:"Este e-mail já está cadastrado.",
 email_exists:"Este e-mail já está cadastrado.",
 weak_password:"Senha muito fraca (mínimo 6 caracteres).",
 same_password:"A nova senha deve ser diferente da atual.",
 over_request_rate_limit:"Muitas tentativas. Aguarde um pouco.",
 over_email_send_rate_limit:"Muitos e-mails enviados. Aguarde um pouco e tente de novo.",
 otp_expired:"Link expirado ou já utilizado. Peça um novo.",
 signup_disabled:"Cadastros desativados no momento.",
 session_not_found:"Sua sessão expirou. Entre novamente.",
 email_address_invalid:"E-mail inválido.",
 validation_failed:"Dados inválidos. Confira os campos."
};
const POR_TEXTO=[
 [/invalid login credentials/i,POR_CODIGO.invalid_credentials],
 [/email not confirmed/i,POR_CODIGO.email_not_confirmed],
 [/user already registered/i,POR_CODIGO.user_already_exists],
 [/password should be at least|weak password/i,POR_CODIGO.weak_password],
 [/different from the old password|same password/i,POR_CODIGO.same_password],
 [/session missing/i,"Sessão ausente ou link expirado. Entre novamente ou peça um novo link em Esqueci a senha."],
 [/invalid or has expired|otp.*expired/i,POR_CODIGO.otp_expired],
 [/rate limit|too many requests/i,POR_CODIGO.over_request_rate_limit],
 [/email.*invalid|invalid.*email/i,POR_CODIGO.email_address_invalid],
 [/fetch|network/i,"Falha de conexão. Verifique a internet."]
];

export function mensagemErro(error){
 if(error?.code&&POR_CODIGO[error.code])return POR_CODIGO[error.code];
 const texto=error?.message||"";
 for(const[regra,mensagem]of POR_TEXTO)if(regra.test(texto))return mensagem;
 return texto||"Erro inesperado.";
}
