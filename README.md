# Conta Leilão — Web

Projeto Angular que reutiliza o **mesmo backend Supabase** do app Flutter (teste-cursor): Auth, tabela `profiles` e demais recursos.

## Configurar Supabase

Use as mesmas credenciais do app Flutter:

1. No projeto **teste-cursor**, copie os valores de `SUPABASE_URL` e `SUPABASE_ANON_KEY` do arquivo `.env`.
2. No projeto **conta-leilao-web**, edite `src/environments/environment.ts` e preencha:

```ts
export const environment = {
  production: false,
  supabaseUrl: 'https://seu-projeto.supabase.co',
  supabaseAnonKey: 'sua-anon-public-key-aqui',
};
```

Para produção, preencha também `src/environments/environment.prod.ts` ou use variáveis de ambiente no seu pipeline de build.

### Login com Google (OAuth)

1. No **Supabase Dashboard**: Authentication > Providers > Google — ative e preencha Client ID e Client Secret (Google Cloud Console).
2. Em **Authentication > URL Configuration > Redirect URLs**, adicione a URL de retorno (ex.: `http://localhost:4200/` para dev e a URL da sua aplicação em produção).
3. O botão "Continuar com o Google" na tela de login redireciona para o Google e, após o login, o usuário volta para a aplicação já autenticado.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
