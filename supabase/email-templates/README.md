# Recuperacao de senha

## Fluxo padrao, sem SMTP proprio

O template padrao do Supabase usa `{{ .ConfirmationURL }}` e nao precisa ser editado.
A aplicacao envia o destino `/auth/callback?next=/redefinir-senha` para
`resetPasswordForEmail`. Depois da verificacao, o Supabase redireciona para esse callback,
que troca o codigo por uma sessao e encaminha o usuario para `/redefinir-senha`.

Em **Authentication > URL Configuration**, configure:

- **Site URL**: a URL publica de producao, por exemplo `https://bolao.example.com`.
- **Redirect URLs**:
  - `https://bolao.example.com/auth/callback?next=/redefinir-senha`
  - `http://localhost:3000/auth/callback?next=/redefinir-senha` para desenvolvimento
    local.

Na hospedagem da aplicacao, defina:

```dotenv
NEXT_PUBLIC_SITE_URL=https://bolao.example.com
```

Se o destino enviado pela aplicacao nao estiver na lista de Redirect URLs, o Supabase usa
o Site URL como fallback. Por isso um Site URL ainda configurado como
`http://localhost:3000` faz o link do e-mail voltar para localhost.

## Template personalizado

O arquivo `password-recovery.html` e opcional. Para usa-lo no projeto hospedado, primeiro
e necessario configurar **Custom SMTP** em
**Authentication > Emails > SMTP Settings**. Depois, copie o HTML para o template
**Reset password**.

Esse template personalizado usa `{{ .RedirectTo }}` e `{{ .TokenHash }}` para chamar
`/auth/confirm`. Se ele for habilitado, altere o destino da API de `/auth/callback` para
`/auth/confirm` e cadastre essa URL na allowlist.
